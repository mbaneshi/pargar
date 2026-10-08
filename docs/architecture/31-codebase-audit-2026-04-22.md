# Codebase Audit Report — 2026-04-22

> **STATUS: BASELINE SNAPSHOT.** All 10 audit items resolved as of 2026-04-23 (v0.2.0).
> For current state, see ROADMAP.md and recent git history.
>
> Originally verified against `dev` branch at commit `5f4fb1d`. Every claim cites file:line.

---

## Status Key

- **FIXED** — resolved by recent work on dev
- **PARTIALLY FIXED** — root cause addressed but residual debt remains
- **VALID** — confirmed in current code, needs fix
- **VALID (DEFERRED)** — confirmed but acceptable for current phase

---

## 1. ECS Dual Store — HashMap Still Leads

**Status: PARTIALLY FIXED**

**What was fixed (ECS cache unification, merged to dev):**
- `editing.rs` — 6 functions migrated from `&mut HashMap` to `&mut NexusWorld`
- `styles.rs` — 4 functions migrated
- `undo.rs` — undo/redo now writes via NexusWorld (hecs + cache dual-write)
- `validation.rs`, `snap_queries.rs` — migrated to `get_entity_cloned()`
- `world.rs` — `set_geometry`, `set_style`, `set_layer`, `translate`, `rotate`, `scale` now dual-write to both hecs and cache
- `lib.rs` — zero direct `.cache` field access in production code (all through `cache_ref()`, `as_map_mut()`, or NexusWorld methods)

**What remains:**

| Location | Issue |
|----------|-------|
| `lib.rs:203,551,575,922` | 3 `sync_cache_to_hecs()` calls for geometry_ops paths |
| `geometry_ops.rs` (all calls via `as_map_mut()`) | Biggest file still writes through HashMap bridge |
| `constraint_ops.rs:141` | Reads `cache.values().cloned()` |
| `create.rs:295,307` | Reads `cache.get()` for circle TTR |
| `text_styles.rs:109,140` | Iterates `cache` directly |
| `dispatch.rs:814,827` | Passes `cache` to `fillet_polyline`, `offset_through` |
| Zero hecs component queries in production | No `world.query::<(&Geometry, &BIMProperties)>()` anywhere |

**Metric:** 56 direct `ecs_world.cache` references before migration → ~24 remaining (mostly in geometry_ops callers and test code).

**Fix plan scope:** Migrate `geometry_ops.rs` functions to `NexusWorld` — largest single task, ~30 functions. After that, remove `sync_cache_to_hecs()` entirely.

---

## 2. Event Sourcing is Mutate-Then-Log

**Status: VALID**

The pattern across the kernel is: mutate state first, then push event as a record.

```rust
// editing.rs:30-44 — current code on dev
pub(crate) fn move_entity(world: &mut NexusWorld, ...) -> bool {
    let old_geometry = world.get_entity_cloned(id)...;
    world.translate_entity(id, dx, dy);          // ← mutate first
    event_store.push(CadEvent::EntityMoved{…});  // ← log after
    ...
}
```

Undo reverses by applying inverse operations (`undo.rs` calls `world.set_geometry(id, old_geometry)`), not by replaying events from a checkpoint. You cannot reconstruct current state from the event log alone — events store deltas but the replay path is manual reversal, not forward application.

**What this costs:**
- No deterministic replay from event log
- No crash recovery from persisted events
- No AI replay of design history
- Undo works by manual reversal (correct but not event-sourced)

**What this does NOT cost right now:**
- Undo/redo works correctly (tested, 434 Rust tests pass)
- Event log is hash-chained (`events.rs:110-121`) with actor attribution
- EventEnvelope has seq, timestamp, actor, schema_version, prev_hash

**Fix plan scope:** This is an architectural choice, not a bug. True event sourcing (event → apply → state) requires inverting the mutation flow. Estimated effort: 2-3 days for core commands. Decision needed: is replay a v0.2 requirement or v0.4+?

---

## 3. Spatial Index Used Partially — Main Paths Bypass It

**Status: VALID**

The R-tree (`spatial_index.rs` via rstar) is rebuilt after every entity mutation (`lib.rs:174-177`). It IS used for:
- Perpendicular snap: `snap_queries.rs:28` — `self.spatial_idx.query_window()`
- WASM exports: `lib.rs:182,187` — `query_spatial_window()`, `query_spatial_nearest()`

It is NOT used for:
- **Hit testing:** `CadRenderer.ts:1428-1431` → `SelectionManager.hitTest()` — O(n) iteration over `entityMeshes` Map in TypeScript
- **Object snap (endpoint, midpoint, center, etc.):** `InteractionShell.svelte.ts:786` → `snapEngine.findSnap()` — O(n) over `cachedEntities` array in TypeScript
- **Window/crossing selection:** `SelectionManager.ts:148-185` — O(n) bounding box check on all `entityMeshes`

**Cost:** R-tree rebuild is O(n log n) per command. At 10k entities, ~14ms per rebuild (benchmarked). The TS-side O(n) scans add per-frame cost during mouse movement.

**Fix plan scope:** Two options:
1. Move hit-test and snap to kernel side using the existing R-tree (WASM call per mouse move — latency concern)
2. Build a JS-side spatial index (e.g., rbush) for the renderer

Option 1 aligns with Rule 5 (Rust for computation). Option 2 is pragmatic for frame-rate-sensitive operations.

---

## 4. Constraint Solver Drains All Entities

**Status: VALID**

```rust
// lib.rs:645-650 — current code on dev
pub(crate) fn solve_constraints_inner(&mut self) -> bool {
    let cache = self.ecs_world.as_map_mut();
    let mut vec: Vec<Entity> = cache.drain().map(|(_, e)| e).collect();
    let result = self.constraint_solver.solve(&mut vec);
    let cache = self.ecs_world.as_map_mut();
    *cache = vec.into_iter().map(|e| (e.id.clone(), e)).collect();
```

Every solve drains the entire HashMap, passes ALL entities to the solver, then re-inserts ALL. The solver itself (`constraints.rs`) only operates on constrained entities, but receives all of them.

**Cost:** O(n) allocation + copy per solve, regardless of constrained entity count. At 50k entities with 2 constraints, copies 50k entities twice.

**Fix plan scope:** Pass only constrained entity IDs to the solver. The solver already tracks which entities have constraints — filter before passing.

---

## 5. CadRenderer Leaks ResizeObserver and DOM Listeners

**Status: VALID (partial)**

`dispose()` exists at `CadRenderer.ts:1801-1816` and correctly cleans up:
- RAF loop (`cancelAnimationFrame`)
- Selection visuals, preview, selection rect
- Entity meshes (disposed via `disposeObject`)
- Material cache (all materials disposed)
- WebGL renderer (`.dispose()` + DOM element removed)

**Not cleaned up:**

| Leak | Location | Impact |
|------|----------|--------|
| ResizeObserver | `CadRenderer.ts:104` — created but never stored in a field | Observer survives dispose, keeps firing on removed element |
| wheel listener | `CadRenderer.ts:98` — `addEventListener('wheel', ...)` | Fires on disposed canvas |
| mousedown listener | `CadRenderer.ts:99` | Same |
| mousemove listener | `CadRenderer.ts:100` | Same |
| mouseup listener | `CadRenderer.ts:101` | Same |
| click listener | `CadRenderer.ts:102` | Same |

**Fix plan scope:** Store ResizeObserver in a field, disconnect in `dispose()`. Store bound listener references, remove in `dispose()`. ~20 lines of code.

---

## 6. No Viewport Culling

**Status: VALID (DEFERRED)**

`syncEntities()` (`CadRenderer.ts:1160-1250`) creates Three.js geometry for every entity in the kernel, regardless of whether it's in the viewport. The render loop renders the full scene every dirty frame.

Three.js does perform GPU-level frustum culling by default (`Object3D.frustumCulled = true`), so objects outside the viewport are skipped at draw time. The issue is on the JS/parse side: all entities are parsed from JSON and converted to geometry on every sync, even if off-screen.

**Cost at scale:** At 10k entities, `syncEntities` parses ~2-5MB of JSON and creates 10k Three.js objects. This blocks the main thread during sync but doesn't affect frame rate between syncs.

**Fix plan scope:** Defer to post-v0.1. When entity count exceeds 5k, implement incremental sync (only update dirty entities) rather than full re-parse. The `dirty_ids` set from the kernel already tracks what changed.

---

## 7. Hardcoded Test Geometry in CanvasViewport

**Status: VALID**

```svelte
<!-- CanvasViewport.svelte:120-152 -->
app.executeCommand({ type: 'CreateLine', x1: -10, y1: -10, x2: 10, y2: -10, layer_id: 'default' });
app.executeCommand({ type: 'CreateLine', x1: 10, y1: -10, x2: 10, y2: 10, layer_id: 'default' });
app.executeCommand({ type: 'CreateLine', x1: 10, y1: 10, x2: -10, y2: 10, layer_id: 'default' });
app.executeCommand({ type: 'CreateLine', x1: -10, y1: 10, x2: -10, y2: -10, layer_id: 'default' });
app.executeCommand({ type: 'CreateCircle', cx: 0, cy: 0, radius: 5, layer_id: 'default' });
```

Runs on every `onMount` — users cannot start with a blank canvas.

**Fix plan scope:** Remove the block or gate it behind a `?demo` query param. 5 minutes of work.

---

## 8. DXF Round-Trip Entity Coverage

**Status: VALID (DEFERRED)**

Supported in `dxf-import.ts`: POINT, LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, TEXT, MTEXT.

Not supported: SPLINE, HATCH, INSERT/BLOCK, DIMENSION (imported as decomposed LINE+TEXT), ELLIPSE, LEADER, MLEADER, VIEWPORT.

Rectangles export as closed LWPOLYLINE (correct DXF representation, but semantic Rectangle type is lost on re-import).

**Fix plan scope:** This is feature work, not a bug. Each entity type is 50-200 lines of import code. Priority order for AutoCAD parity: DIMENSION (semantic), ELLIPSE, SPLINE, HATCH, BLOCK/INSERT.

---

## 9. Vitest Version Mismatch

**Status: VALID**

| Package | Version |
|---------|---------|
| Root workspace | `^2.1.9` |
| `@nexus/app` | (inherits root) |
| `@nexus/renderer` | `^2.1.9` |
| `@nexus/file-io` | `^2.1.9` |
| `@nexus/logger` | `^2.1.9` |
| `@nexus/mcp` | **`^3.1.1`** |

Vitest 3.x has breaking changes in snapshot format, assertion chaining, and config API.

**Fix plan scope:** Align `@nexus/mcp` to `^2.1.9` or upgrade all packages to `^3.1.1`. 5 minutes.

---

## 10. Pervasive `any` at Critical Boundaries

**Status: VALID**

| Location | Usage |
|----------|-------|
| `SelectionSet.svelte.ts:20-21` | `private renderer: any`, `private kernel: any` |
| `CadRenderer.ts:1424` | `getEntitiesForSnap(): any[]` |
| `CadRenderer.ts:58` | `geometry: any` in entity interface |
| Tool handler tests | Cast to `any` for kernel/renderer mocks |
| `kernel-bridge.ts` | JSON string boundary between kernel WASM and TS |

The kernel↔renderer boundary passes JSON strings parsed with `JSON.parse()` — runtime types only. TypeScript strict mode is enabled but bypassed at the most critical interfaces.

**Fix plan scope:** Define shared types in `@nexus/core` for Entity, GeometryType, EntityStyle, Layer. Import in both renderer and app. Replace `any` with concrete types. The kernel already emits typed JSON via tsify — the types exist in `nexus_kernel.d.ts` (WASM output). Medium effort (~1 day).

---

## Priority Matrix

| # | Issue | Severity | Effort | When |
|---|-------|----------|--------|------|
| 7 | Hardcoded test geometry | Low | 5 min | **Now** |
| 9 | Vitest mismatch | Low | 5 min | **Now** |
| 5 | Renderer memory leaks | Medium | 30 min | **Now** |
| 4 | Constraint solver drain | High at scale | 2 hrs | **Before Phase 6** |
| 3 | Spatial index underused | Medium | 1 day | **Before 10k entities** |
| 1 | ECS migration residual | Medium | 2 days | **Before BIM** |
| 10 | `any` types at boundaries | Medium | 1 day | **Before team grows** |
| 6 | No viewport culling | High at scale | 2 days | **Before 5k entities** |
| 2 | Event sourcing is logging | Architectural | 3 days | **Decision needed** |
| 8 | DXF entity coverage | Feature gap | Ongoing | **Per entity type** |

---

## Recommendations

**Batch 1 — Do today (trivial):**
- Remove hardcoded geometry from CanvasViewport (#7)
- Align vitest versions (#9)
- Fix renderer dispose leaks (#5)

**Batch 2 — Before Phase 6 constraint solver upgrade:**
- Fix constraint solver drain (#4) — only pass constrained entities
- Finish geometry_ops migration (#1 residual) — remove last `sync_cache_to_hecs` calls

**Batch 3 — Before scaling past demo:**
- Type the kernel↔renderer boundary (#10)
- Add JS-side spatial index for hit-test/snap (#3)
- Implement incremental entity sync (#6)

**Decision needed:**
- Event sourcing (#2) — is deterministic replay a requirement before v0.3 (collaboration)? If yes, invert the mutation flow. If no, document the current pattern as intentional and defer.
