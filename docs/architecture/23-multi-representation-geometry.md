# Architecture Decision: Multi-Representation Geometry

> ## Status: PARKED under SD-05 (2026-04-29)
>
> Multi-representation (B-Rep + mesh + NURBS) is a 3D concern. Execution is paused until AutoCAD 2D parity ships. Lifting SD-05 in `DECISIONS.md` reactivates this work.

> Priority: 4 of 10 — determines what the kernel stores and computes
> Risk if wrong: precision loss on export, or computation too slow for interactive use
> Audience: All agents and developers working on NEXUS

---

## The Problem

The same geometric object needs different representations for different purposes:
- **Editing:** Exact, parametric (B-Rep with NURBS)
- **Display:** Tessellated mesh (triangles for GPU)
- **Analysis:** Ray-traceable implicit (for mass properties, interference)
- **Export:** Format-dependent (B-Rep for STEP, mesh for STL, wireframe for DXF)

The question: which representation is the source of truth, which are cached/derived, and when does recomputation happen?

---

## How Reference Apps Handle It

### BRL-CAD: CSG Tree Is Truth, Everything Else Is Derived

| Layer | Role | Stored? | Cached? |
|-------|------|---------|---------|
| CSG Tree (analytic primitives + booleans) | Source of truth | YES (.g file) | — |
| Ray evaluation (intersection points) | On-demand query | NO | NO — each ray is independent |
| NMG/BoT mesh (tessellation) | Explicit conversion | YES (as new object) | NO |

Tessellation only happens on explicit user request (`facetize` command). The CSG tree is never modified by tessellation. No automatic cache invalidation because there's no cache — everything is recomputed from the tree.

### FreeCAD/OCCT: B-Rep Is Truth, Tessellation Is Cached On Shape

| Layer | Role | Stored? | Cached? |
|-------|------|---------|---------|
| TopoDS_Shape (B-Rep) | Source of truth | YES (in feature) | — |
| Poly_Triangulation (mesh) | Display | Stored on Shape | YES — per-face, keyed by deflection |

OCCT caches tessellation directly on topological entities (`Poly_Triangulation` on each `TopoDS_Face`). When a face's underlying surface changes, its cached tessellation is invalidated. The incremental mesher (`BRepMesh_IncrementalMesh`) only re-tessellates faces whose deflection exceeds the requested quality.

**Deflection parameter:** Maximum chord distance between mesh and true surface. Two controls: linear deflection (absolute distance) and angular deflection (max angle between adjacent segments, default 12-20°).

### Blender: Base Mesh + Modifiers Is Truth, Evaluated Mesh Is CoW Cache

| Layer | Role | Stored? | Cached? |
|-------|------|---------|---------|
| Base Mesh (DNA datablock) | Source of truth | YES | — |
| Modifier stack (ordered list) | Transform instructions | YES | — |
| Evaluated Mesh (CoW copy) | Display | On depsgraph copy | YES — invalidated by dirty tags |

Blender's depsgraph decomposes each object into components (TRANSFORM, GEOMETRY, ANIMATION, etc.) and tracks dirty flags per component. Changing base mesh geometry tags GEOMETRY dirty, which propagates to all modifier operation nodes. Only dirty nodes re-evaluate.

**Critical insight:** Evaluation works on Copy-on-Write copies. Original data is never modified during eval. The display engine reads the evaluated copy.

### OpenSCAD: Script/Node Tree Is Truth, Geometry Is Cached by Subtree Hash

| Layer | Role | Stored? | Cached? |
|-------|------|---------|---------|
| .scad source / node tree | Source of truth | YES (.scad file) | — |
| CGAL Nef / Manifold mesh | Evaluated geometry | NO | YES — keyed by subtree string hash |

Cache key = canonical dump of entire subtree rooted at each node. If a leaf parameter changes, every ancestor's cache key changes, but sibling subtrees are unaffected. Cost-based eviction when cache exceeds budget.

---

## Decision for NEXUS

### The Representation Pipeline

```
User Intent (Parametric Feature Tree)
    ↓  [rebuild — triggered by dimension change, feature edit]
B-Rep (Exact Geometry — source of truth for 3D)
    ↓  [tessellate — triggered by display, zoom, export]
Mesh (Display Geometry — cached, invalidated per-face)
    ↓  [render — triggered by viewport redraw]
GPU Buffers (Three.js scene — owned by TypeScript)
```

For 2D (v0.1), the pipeline is simpler:
```
Geometry2d Enum (source of truth)
    ↓  [serialize — on every command]
JSON (crosses WASM boundary)
    ↓  [render — Three.js creates lines/circles/arcs directly]
GPU Buffers
```

### Source of Truth by Phase

| Phase | Source of Truth | Derived |
|-------|----------------|---------|
| v0.1 (2D) | `GeometryType` enum in Rust kernel | Three.js display objects (via JSON sync) |
| v0.2 (3D) | `BrepGeometry(BrepHandle)` component | `MeshGeometry(MeshHandle)` — tessellated cache |
| v0.3+ (BIM/GIS) | B-Rep + domain components | Multiple meshes at different LODs |

### Cache Strategy

**Per-face tessellation caching (OCCT model, adapted for WASM):**

```rust
struct TessellationCache {
    /// Map from (face_id, deflection) → tessellated mesh
    entries: HashMap<(FaceId, OrderedFloat<f64>), CachedMesh>,
    /// Total triangle count across all entries
    total_cost: usize,
    /// Maximum triangle count before eviction
    max_cost: usize,  // e.g., 500K triangles
}

struct CachedMesh {
    vertices: Vec<Point3d>,
    normals: Vec<Vec3d>,
    indices: Vec<[u32; 3]>,
    generation: u64,  // B-Rep generation when this was computed
    last_used: Instant,
}
```

**Staleness detection:**

```rust
fn is_stale(cache_entry: &CachedMesh, brep: &BrepGeometry) -> bool {
    cache_entry.generation < brep.generation()
}
```

When the B-Rep changes (boolean, fillet, parametric rebuild), its generation counter increments. All cached meshes for that B-Rep become stale.

**Staleness handling (browser-specific — must not block UI):**

1. **Immediate:** Display stale mesh with visual indicator (stippled or translucent rendering)
2. **Background:** Start tessellation in Web Worker
3. **Swap:** When tessellation completes, swap in fresh mesh, remove visual indicator
4. **Timeout:** If tessellation takes > 5 seconds, show progress indicator

**Cache eviction (memory budget):**

When `total_cost > max_cost`:
1. Sort entries by `last_used` (LRU)
2. Evict oldest entries until `total_cost < max_cost * 0.8` (evict to 80% to avoid thrashing)
3. Evicted meshes are regenerated on next access

### WASM Boundary for Geometry Data

**For 2D (v0.1):** JSON is fine. 10K simple entities → ~3MB JSON → ~35-70ms roundtrip. With delta sync (only changed entities), this drops to <1ms per frame.

**For 3D mesh data (v0.2+):** JSON is NOT acceptable for mesh buffers. A 50K triangle mesh = ~2.4MB of vertex/index data. JSON encoding bloats this to ~8MB+ and parse time exceeds frame budget.

**Solution:** Transfer mesh buffers as `ArrayBuffer` via `postMessage` with ownership transfer (zero-copy):

```
Rust (WASM):
  - Tessellate B-Rep → Vec<f32> positions, Vec<f32> normals, Vec<u32> indices
  - Write to WASM linear memory
  - Return pointer + length to JS

TypeScript:
  - Create Float32Array/Uint32Array views into WASM memory
  - Copy to transferable ArrayBuffer (one copy, ~0.5ms for 2.4MB)
  - Transfer to Three.js BufferGeometry (zero-copy)
```

This keeps geometry data transfer under 1ms for typical meshes.

### What NOT to Do

1. **Do NOT tessellate on every frame.** Tessellation is expensive (10-100ms per solid). Cache and invalidate.

2. **Do NOT store mesh as source of truth.** Mesh loses precision. If a user changes a dimension, you need the B-Rep to rebuild, not the mesh.

3. **Do NOT send full entity state across WASM boundary on every command.** Use delta sync (dirty tracking). NEXUS already does this with `flush_changes()` — keep this pattern for 3D.

4. **Do NOT block the main thread on tessellation.** Always tessellate in a Web Worker. Display stale geometry while waiting.

5. **Do NOT cache unlimited tessellation.** WASM has 2-4GB memory. A cost-based LRU cache prevents memory exhaustion.
