# Rust CAD Ecosystem & Architecture Upgrade Seams

> Professional architecture from day one: design the seams now, swap implementations when thresholds are crossed.

**Date:** 2026-04-14
**Status:** Active reference — review quarterly against crate ecosystem changes

---

## Part 1: Rust CAD Ecosystem Map

### What Exists (Validated for WASM/Browser)

| Crate | Domain | WASM Ready | License | Notes |
|-------|--------|-----------|---------|-------|
| **truck** | BREP/NURBS kernel, STEP I/O | Yes | Apache 2.0 | Pure Rust, used by CADmium. No fillet/chamfer yet. |
| **manifold** | Mesh booleans (union/diff/intersect) | Yes (JS/WASM) | Apache 2.0 | C++ core, official WASM bindings. Fast, reliable. |
| **opencascade-rs** | Rust bindings to OpenCascade | Partial | LGPL 2.1 | 20yr battle-tested kernel. ~5MB WASM. Fillets, NURBS, STEP native. |
| **planegcs** | 2D geometric constraint solver | Yes (WASM) | AGPL 3.0 | Used by FreeCAD/Ondsel. 22+ constraint types. |
| **parry2d/parry3d** | Collision detection, spatial queries | Yes | Apache 2.0 | Point-in-polygon, distance queries, BVH spatial index. |
| **lyon** | 2D path tessellation | Yes | MIT/Apache 2.0 | GPU-ready triangle meshes from paths. |
| **kurbo** | 2D geometry primitives | Yes | MIT/Apache 2.0 | Bezier curves, arc length, area calculations. |
| **glam** | 3D linear algebra | Yes | MIT/Apache 2.0 | Bevy ecosystem standard. SIMD-optimized. |
| **bevy_ecs** | Entity-Component-System | Yes | MIT/Apache 2.0 | Standalone crate, proven WASM. Archetypal storage. |
| **acadrust** | DXF/DWG read/write | Yes | MIT | Pure Rust, 30+ entity types, R12–2018+. |
| **dxf** | DXF/DXB read/write | Yes | MIT/Apache 2.0 | Widely used, good stability. |
| **postcard** | Binary serialization | Yes | MIT/Apache 2.0 | No-std, ~10x faster than serde_json for WASM boundary. |
| **slotmap** | Generational arena allocator | Yes | Zlib | Safe entity references, no dangling IDs. |
| **fornjot** | BREP CAD kernel (pure Rust) | Partial | MIT/Apache 2.0 | Early stage, code-first modeling. |
| **cadk** | CSG + BREP kernel | Partial | MIT | Research-grade, tessellation support. |
| **wgpu** | WebGPU abstraction | Yes | MIT/Apache 2.0 | Rust-native GPU, compiles to WebGPU in browser. |

### What We Currently Use

| Dependency | Where | Purpose |
|-----------|-------|---------|
| `wasm-bindgen` | kernel | Rust↔JS bridge |
| `serde` + `serde_json` | kernel | Command/event serialization |
| `dxf-parser` (npm) | file-io | DXF import |
| `three.js` | renderer | WebGL rendering |

### Ecosystem Gaps (Nothing Exists)

- **Civil engineering alignment tools** — horizontal/vertical curves, superelevation. Must build custom.
- **IFC writer in Rust** — `web-ifc` (C++/WASM) exists for reading, no pure Rust writer.
- **Browser-native CRS transforms** — `proj` has Rust bindings but WASM size is large (~2MB).

---

## Part 2: Architecture Upgrade Seams

Six specific places in the current codebase where a small interface change today prevents a painful rewrite later. **Don't implement the upgrades — just maintain the seams.**

### Seam 1: Command Wire Format

**File:** `packages/kernel/src/lib.rs:1311`
**Current:** `execute_command(command_json: &str) -> String` — JSON string in, JSON string out.

**Why it matters:** At 10k+ entities with batch operations, JSON serde becomes the bottleneck. But JSON is perfect for debugging and MCP tool schemas right now.

**The seam:** A second entry point alongside JSON, not replacing it.

```rust
#[wasm_bindgen]
pub fn execute_command_bytes(&mut self, command_bytes: &[u8]) -> Vec<u8> {
    // Future: postcard::from_bytes / to_allocvec
    // Today: delegate to JSON path
    let json = std::str::from_utf8(command_bytes).unwrap_or("{}");
    self.execute_command(json).into_bytes()
}
```

**Upgrade path:** JSON → `postcard` binary → batched binary commands
**Trigger:** Profiling shows >2ms per command dispatch.

---

### Seam 2: Entity Storage

**File:** `packages/kernel/src/lib.rs:25`
**Current:** `entities: Vec<Entity>` with `.find(|e| e.id == id)` linear scan (O(n) per lookup).

**Why it matters:** At 10k entities, every command and every constraint solve iteration does a linear scan. Constraint solving with 50 iterations × n constraints × O(n) lookup = catastrophic.

**The seam:** Never access `self.entities` directly in `execute()`. Always go through accessor methods (`find_entity`, `find_entity_mut`). Then swap internals.

**Upgrade path:**
1. `Vec<Entity>` → `HashMap<String, Entity>` — O(1) lookup, 30-minute change
2. `HashMap` → `slotmap::SlotMap` — generational IDs, no dangling references
3. `slotmap` → ECS (`bevy_ecs` or custom) — component queries across domains

**Trigger:** Entity count regularly exceeds 5k, or second domain (3D/BIM) is added.

---

### Seam 3: Constraint Solver

**File:** `packages/kernel/src/constraints.rs`
**Current:** Hand-rolled iterative solver. 8 constraint types. 50 max iterations. No over-constraint detection.

**Why it matters:** This is the biggest architectural risk. The current solver will fail on:
- Over-constrained systems (no detection, silent failure)
- Tangent and angle constraints (not implemented, can't be added to iterative approach)
- Circular constraint dependencies
- Non-linear constraints (e.g., point-on-curve)

**The seam:** The `ConstraintSolver` struct is already the seam. Formalize it as a trait:

```rust
pub trait ConstraintSolverBackend {
    fn add_constraint(&mut self, ct: ConstraintType) -> String;
    fn remove_constraint(&mut self, id: &str) -> bool;
    fn solve(&self, entities: &mut Vec<Entity>) -> bool;
    fn is_over_constrained(&self) -> bool; // planegcs gives this for free
}
```

**Upgrade path:**
1. Keep current solver for v0.1 (works for horizontal/vertical/coincident/distance)
2. Integrate `planegcs` WASM when tangent/angle/radius constraints are needed
3. For 3D assembly constraints: different solver entirely (not planegcs)

**Trigger:** Users request tangent or angle constraints. That's the line the current solver can't cross.

---

### Seam 4: Geometry Representation

**File:** `packages/kernel/src/entity.rs:39-58`
**Current:** `GeometryType` enum with 18 variants. Every operation (translate/rotate/scale) requires exhaustive match arms (~250 lines of match code).

**Why it matters:** Adding 3D types (Extrusion, Revolution, BREP Face, Shell, Solid) into this enum creates combinatorial explosion. The match arms become unmaintainable.

**The seam:** Don't change now — enums with exhaustive match are strictly better than trait objects for 2D (compiler catches missing cases). But know the refactor point:

```rust
// When 3D arrives, GeometryType enum splits into:
trait Geometry: Send + Sync + Serialize + Deserialize {
    fn transform(&mut self, matrix: &Mat4);
    fn bounding_box(&self) -> BBox;
    fn tessellate(&self) -> Mesh;       // for renderer
    fn dimension(&self) -> u8;          // 2 or 3
    fn snap_points(&self) -> Vec<Point3D>;
}

// Entity holds Box<dyn Geometry> or an enum-dispatch wrapper
```

**Upgrade path:**
1. 2D: Keep `GeometryType` enum (current — correct for now)
2. 3D foundation: Split into `Geometry2D` + `Geometry3D` enums, unified via trait
3. Multi-domain: Full trait object / enum_dispatch pattern

**Trigger:** Starting Phase 1 (3D foundation).

---

### Seam 5: Event Store Compaction

**File:** `packages/kernel/src/events.rs:54-58`
**Current:** Unbounded `Vec<EventEnvelope>`. Truncates future on new push after undo. No snapshots.

**Why it matters:** No checkpointing means:
- Project save must serialize entire kernel state (not incremental)
- Collaboration (Yjs) needs snapshots to sync new clients
- AI replay of long sessions requires replaying from event 0
- Memory grows unbounded during long editing sessions

**The seam:** Add checkpoint hooks without changing the current undo/redo flow.

```rust
pub struct Checkpoint {
    pub at_seq: u64,
    pub snapshot: Vec<u8>,  // serialized kernel state (postcard or bincode)
}

impl EventStore {
    pub fn create_checkpoint(&self, kernel_snapshot: Vec<u8>) -> Checkpoint {
        Checkpoint { at_seq: self.next_seq, snapshot: kernel_snapshot }
    }

    pub fn events_since(&self, seq: u64) -> &[EventEnvelope] {
        let start = self.events.iter()
            .position(|e| e.seq >= seq)
            .unwrap_or(self.events.len());
        &self.events[start..]
    }

    pub fn compact_before(&mut self, seq: u64) {
        // Drop events before checkpoint — they're captured in the snapshot
        self.events.retain(|e| e.seq >= seq);
    }
}
```

**Upgrade path:**
1. Current: no checkpoints (fine for <10k events)
2. Add auto-checkpoint every N events (e.g., 1000)
3. Persist checkpoints to OPFS for fast project load
4. Use checkpoints as Yjs sync baseline for collaboration

**Trigger:** Project save/load exceeds 500ms, or collaboration feature starts.

---

### Seam 6: WASM Bridge (Delta Sync)

**File:** `packages/kernel/src/lib.rs` — `get_entities_json()`, `dirty_ids`, `deleted_ids`
**Current:** Renderer calls `get_entities_json()` which serializes ALL entities. Delta tracking via `dirty_ids`/`deleted_ids` exists but isn't the primary sync path.

**Why it matters:** Full serialization every frame at 10k+ entities = multi-millisecond stalls. The delta pattern is the correct architecture — it just needs to be the primary path.

**The seam:** Formalize `flush_changes()` as the renderer's only sync method.

```rust
#[wasm_bindgen]
pub fn flush_changes(&mut self) -> String {
    // Returns ONLY what changed since last flush
    let delta = ChangeDelta {
        updated: self.dirty_ids.iter()
            .filter_map(|id| self.entities.iter().find(|e| e.id == *id).cloned())
            .collect(),
        deleted: self.deleted_ids.clone(),
    };
    self.dirty_ids.clear();
    self.deleted_ids.clear();
    serde_json::to_string(&delta).unwrap_or_default()
}
```

**Upgrade path:** JSON delta → binary delta (postcard) → SharedArrayBuffer (zero-copy)
**Trigger:** Profiling shows `get_entities_json()` > 1ms per frame.

---

## Part 3: Decision Matrix

```
IF entity count > 5k       → Seam 2: Vec → HashMap → slotmap
IF constraint complexity    → Seam 3: hand-rolled → planegcs WASM
IF starting 3D              → Seam 4: enum → trait objects
IF save/load > 500ms        → Seam 5: add checkpoints
IF dispatch > 2ms           → Seam 1: JSON → postcard binary
IF render sync > 1ms        → Seam 6: full JSON → delta → binary delta
```

**Expected trigger order:** Seam 2 (storage) → Seam 3 (constraints) → Seam 4 (3D geometry) → Seam 6 (delta sync) → Seam 5 (checkpoints) → Seam 1 (binary protocol).

---

## Part 4: Crate Watch List

Review quarterly. Update this table when crate status changes.

| Crate | Watch For | Last Checked | Status |
|-------|-----------|-------------|--------|
| **truck** | v1.0, STEP write, fillet/chamfer | 2026-04-14 | v0.18, read-only STEP, no fillets |
| **manifold** | Official Rust bindings (not just JS) | 2026-04-14 | C++/JS only, community Rust wrapper WIP |
| **planegcs** | Stable WASM build, npm package | 2026-04-14 | Used by Ondsel, WASM works |
| **bevy_ecs** | Standalone WASM binary size | 2026-04-14 | ~200KB WASM, viable |
| **parry2d** | WASM binary size optimization | 2026-04-14 | ~150KB WASM, viable |
| **acadrust** | DWG write support, entity coverage | 2026-04-14 | DXF R12–2018, DWG partial |
| **fornjot** | BREP maturity, boolean operations | 2026-04-14 | Early, active development |
| **wgpu** | WebGPU browser support stability | 2026-04-14 | Chrome stable, Firefox nightly |

---

## Part 5: What We Learned from Reference Projects

### Patterns Worth Adopting (When Ready)

| Pattern | From | Our Upgrade Path |
|---------|------|-----------------|
| Multi-representation geometry (CSG → BREP → Mesh) | BRL-CAD | Phase 1: truck (BREP) + manifold (mesh booleans) |
| Modifier/feature stack | Blender, FreeCAD | Phase 2: event log already captures this — formalize as feature tree |
| Modal editing (G/R/S) | Blender | v0.1: already have tool state machines — add modal shortcuts |
| 22 constraint types | FreeCAD (planegcs) | Seam 3: swap solver when tangent/angle needed |
| Geometry caching/lazy eval | OpenSCAD | Seam 6: delta sync is the caching layer |
| 77 primitive types | BRL-CAD | Seam 4: trait-based geometry extensibility |

### Patterns to Avoid

| Anti-Pattern | From | Why |
|-------------|------|-----|
| Class inheritance for entities | FreeCAD (`Part::Feature` hierarchy) | Violates Rule 3 (ECS). Makes cross-domain queries impossible. |
| Monolithic kernel binary | BRL-CAD (single `librt`) | Violates Rule 5 (lazy-load). WASM budget requires modular loading. |
| Plugin API as afterthought | LibreCAD | Violates Rule 6 (AI-first). Command bus IS the plugin API. |
| File-based state | AutoCAD (.dwg as source of truth) | Violates Rule 2 (event sourcing). Events are truth, files are exports. |

---

## Part 6: Founding Architecture Thesis

> A CAD operation and an AI instruction are the same data structure.

`CreateLine { x1: 0, y1: 0, x2: 100, y2: 0 }` dispatched by a mouse click and dispatched by an AI agent are identical to the kernel. This is not a feature — it's a property of the architecture.

**What this means for every seam:**
- Binary protocol (Seam 1) must preserve this: AI sends the same `Command` enum, just serialized differently.
- Entity storage (Seam 2) must be queryable by both renderer and AI agent.
- Constraint solver (Seam 3) must accept constraints from AI without GUI context.
- Event store (Seam 5) is the AI's training corpus — every human design session is replayable data.

**The moat is not the UI, the rendering, or the WASM kernel. The moat is that the entire design history is a structured, replayable, AI-readable data stream — built this way from day one.**
