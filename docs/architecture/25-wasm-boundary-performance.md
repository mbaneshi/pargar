# Architecture Decision: WASM Boundary & Performance

> ## Status: PARKED under SD-05 (2026-04-29)
>
> The forward roadmap (binary transfer, Web Worker, SharedArrayBuffer) is paused until AutoCAD 2D parity ships. Current main-thread JSON sync stays in force. Lifting SD-05 in `DECISIONS.md` reactivates downstream work.

> Priority: 6 of 10 — browser-native is the whole value prop. Can't be slow.
> Risk if wrong: >10MB bundle = unacceptable load. JSON every frame = 60fps impossible at scale.
> Audience: All agents and developers working on NEXUS

---

## The Numbers

| Operation | Cost | When Acceptable |
|-----------|------|-----------------|
| JSON.stringify 10K simple entities (~3MB) | 15-30ms | NOT per frame. Only on full sync. |
| JSON.parse 10K simple entities | 20-40ms | Same |
| JSON round-trip 50 changed entities (~15KB) | <1ms | Per frame — fine with delta sync |
| ArrayBuffer transfer (1MB, ownership move) | ~0.01ms | Always — near zero-copy |
| ArrayBuffer copy (1MB, structured clone) | ~0.5-1ms | Acceptable for mesh data |
| postMessage overhead (small object) | ~0.1-0.5ms | Fine for commands |
| WASM function call overhead | ~10-100ns | Negligible |

### Bundle Size Estimates

| Crate Combination | Estimated .wasm (gzipped) |
|-------------------|--------------------------|
| serde + wasm-bindgen only (current NEXUS) | ~50-100KB |
| + nalgebra + robust + rstar + roots | ~300-500KB |
| + parry3d-f64 + bvh | ~600-900KB |
| + curvo + truck (full 3D) | ~1.5-2.5MB |
| + csgrs (mesh booleans) | ~2-3MB |
| opencascade.js (separate, lazy-loaded) | ~7-10MB |

**Comparison points:** OpenSCAD WASM ~3-4MB, AutoCAD Web ~5-8MB, Onshape ~3-5MB.

### Memory Limits

| Environment | Practical WASM Memory Limit |
|-------------|----------------------------|
| Desktop Chrome/Firefox | ~4GB (wasm32 hard limit) |
| Desktop Safari | ~2-3GB |
| Mobile Safari (iOS) | ~1.5GB (OS kills page above this, no warning) |
| Mobile Chrome (Android) | ~1-2GB (device-dependent) |

---

## Architecture Decisions

### 1. Delta Sync for Entity State (Keep Current Pattern)

NEXUS already does this correctly with `flush_changes()` returning `{upserted: [...], deleted: [...]}`. This is the right pattern:

```
Command → Kernel mutates → marks dirty IDs → flush_changes() returns JSON of ONLY changed entities
```

For v0.1 (2D, <10K entities), JSON delta sync is fine. Cost is proportional to changes per frame, not total entities.

### 2. Binary Transfer for Mesh Data (v0.2+)

When 3D mesh data crosses the boundary, do NOT use JSON. Use typed array transfer:

```
Rust (WASM):
  fn get_mesh_buffers(entity_id: &str) -> MeshBuffers {
      // Returns pointers into WASM linear memory
      MeshBuffers { 
          positions_ptr, positions_len,  // f32 × 3 × vertex_count
          normals_ptr, normals_len,
          indices_ptr, indices_len,      // u32 × 3 × triangle_count
      }
  }

TypeScript:
  const buffers = kernel.get_mesh_buffers(entityId);
  const positions = new Float32Array(wasmMemory.buffer, buffers.positions_ptr, buffers.positions_len);
  // Copy to transferable buffer (one copy, ~0.5ms for 50K triangles)
  const positionsCopy = new Float32Array(positions);
  // Set as Three.js BufferGeometry attribute (zero additional copy)
  geometry.setAttribute('position', new THREE.BufferAttribute(positionsCopy, 3));
```

**Why copy instead of direct view:** WASM linear memory can grow (via `memory.grow()`), which invalidates all existing views. A copy into a separate ArrayBuffer is safe and one-time.

### 3. Web Worker Architecture (v0.2+)

**Phase 1 (v0.1): Main thread. Keep it simple.**

The kernel runs on the main thread via direct WASM calls. At <10K entities with delta sync, JSON overhead is <1ms per frame. No worker complexity needed.

**Phase 2 (v0.2+): Single worker + postMessage.**

Move the kernel to a Web Worker when 3D computation (booleans, tessellation, rebuild) starts taking >16ms:

```
Main Thread:                          Worker:
├── Three.js rendering                ├── WASM kernel
├── UI (Svelte)                       ├── Boolean operations
├── Event handling                    ├── Tessellation
├── Snap engine (stays here*)         ├── Feature tree rebuild
└── Selection rendering               └── Constraint solving

Communication:
  Main → Worker: postMessage({ type: 'ExecuteCommand', command: {...} })
  Worker → Main: postMessage({ type: 'CommandResult', result: {...}, meshBuffers: [...] })
                 (meshBuffers transferred, not copied)
```

*Snap engine stays on main thread because it needs synchronous cursor response. If snap becomes slow (>5ms), move it to the worker with a cursor position update stream.

**Use Comlink (~5KB gzipped) for ergonomic async RPC:**

```typescript
// Worker setup
import { expose } from 'comlink';
expose(kernel);

// Main thread usage
import { wrap } from 'comlink';
const kernel = wrap<Kernel>(worker);
const result = await kernel.execute_command(JSON.stringify(command));
```

**Phase 3 (v0.3+): SharedArrayBuffer for mesh data.**

When mesh update latency matters (e.g., real-time parametric preview during dimension drag):

- Allocate SharedArrayBuffer for mesh vertex positions
- Kernel writes directly; Three.js reads directly
- No copy, no transfer, no postMessage for mesh data
- Requires COOP/COEP headers:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- Gate behind a "high performance mode" setting

### 4. Bundle Size Strategy

**Feature flags in Cargo.toml:**

```toml
[features]
default = ["2d"]
2d = []                           # Current: ~100KB
3d-basic = ["nalgebra", "parry3d-f64", "bvh", "roots"]  # +400-800KB
3d-brep = ["3d-basic", "truck-modeling", "truck-shapeops"]  # +500KB-1MB
nurbs = ["curvo"]                 # +100-200KB
mesh-boolean = ["csgrs"]          # +200-400KB
step-io = ["truck-stepio"]        # +200KB
all = ["3d-brep", "nurbs", "mesh-boolean", "step-io"]
```

**Lazy loading for heavy optional modules:**

```typescript
// opencascade.js (~7-10MB) loaded only on first fillet/chamfer/STEP-full operation
let occt: OpenCascadeInstance | null = null;

async function getOCCT(): Promise<OpenCascadeInstance> {
    if (!occt) {
        const module = await import('opencascade.js');
        occt = await module.default();
    }
    return occt;
}
```

Cache in Service Worker / Cache API so subsequent loads are instant.

### 5. Memory Budget

**Target memory usage by phase:**

| Phase | Entities | Estimated Memory | Headroom (2GB mobile limit) |
|-------|----------|-----------------|---------------------------|
| v0.1 (2D) | 10K | ~50-150MB | Comfortable |
| v0.2 (3D, simple) | 100 3D + 5K 2D | ~200-500MB | OK |
| v0.2 (3D, complex) | 500 3D parts | ~500MB-1.5GB | Tight on mobile |
| v0.3 (BIM) | 1000 elements | ~300-800MB | OK with LOD |
| v0.4 (Point Cloud) | 1M points | ~100-200MB | OK |
| v0.4 (Point Cloud) | 10M points | ~1-2GB | At limit |

**When approaching limits:**
- LOD: coarse mesh for distant/inactive objects, fine mesh for active editing target
- Out-of-core: stream geometry from IndexedDB, evict unused parts (LRU)
- Tessellation-only mode: discard B-Rep for unedited parts, keep only display mesh

### What If Established Apps Were Browser-Native?

Key architectural shifts they'd make:

1. **Separate parametric tree (small, serializable) from evaluated geometry cache (large, regenerable).** Don't try to keep all geometry in memory — regenerate from the tree on demand.

2. **Server-assisted computation** for heavy operations. This is the Onshape model: interactive editing in browser, booleans/tessellation on server. NEXUS could offer this as optional "cloud compute" mode.

3. **Progressive rendering.** Show wireframe immediately, tessellate in background, refine progressively. Don't block display on full tessellation.

4. **Lazy evaluation.** Don't evaluate the full parametric tree until a specific face is needed for display or export. OpenSCAD's subtree caching approach works here.

### What NOT to Do

1. **Do NOT serialize full entity state as JSON on every frame.** Delta sync only. NEXUS already does this — keep it.

2. **Do NOT load opencascade.js eagerly.** 7-10MB upfront destroys first-load experience. Lazy-load on first fillet/STEP operation.

3. **Do NOT run heavy computation on the main thread in v0.2+.** Booleans can take 100ms-2s. Move to Web Worker.

4. **Do NOT use SharedArrayBuffer in v0.1.** COOP/COEP headers break many third-party integrations (analytics, auth popups, CDN fonts). Only add when performance requires it.

5. **Do NOT assume desktop memory limits.** Mobile Safari kills pages at ~1.5GB with no warning. Design for 1GB safe budget.
