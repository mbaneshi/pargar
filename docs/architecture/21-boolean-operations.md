# Architecture Decision: Boolean Operations

> ## Status: PARKED under SD-05 (2026-04-29)
>
> Forward-looking 3D execution is paused until AutoCAD 2D parity ships. 2D boolean guidance (HATCH boundary handling, polyline operations) stays in force. Lifting SD-05 in `DECISIONS.md` reactivates downstream work.

> Priority: 2 of 10 — highest crash risk, blocks 3D entirely
> Risk if wrong: booleans are the #1 crash source in every CAD app. Wrong architecture = no 3D.
> Audience: All agents and developers working on NEXUS

---

## The Problem

Boolean operations (union, difference, intersection) are the core of 3D solid modeling. They're also the single most failure-prone operation in every CAD application. The question isn't whether your booleans will fail — it's how often, and what happens when they do.

NEXUS needs a boolean strategy that:
1. Works in WASM (browser-native)
2. Handles the failure modes gracefully (not crash, not corrupt)
3. Supports both interactive preview (fast, approximate) and export (exact, slow)
4. Scales from simple 2D region booleans (v0.1) to full 3D solid booleans (v0.2+)

---

## Five Approaches from Five Apps

### 1. BRL-CAD — Ray-Based Segment Weaving (Implicit, Lazy)

**How it works:**
1. Fire a ray through the CSG tree
2. Each primitive's `ft_shot()` returns a list of IN/OUT segment pairs (where the ray enters and exits that primitive)
3. `rt_boolweave()` merges all segments into a sorted partition list along the ray
4. `rt_boolfinal()` walks the partition list and evaluates the CSG boolean tree at each partition:
   - At a leaf: is this primitive's segment present? → TRUE/FALSE
   - UNION: left OR right
   - INTERSECT: left AND right
   - SUBTRACT: left AND NOT right

**Key data structures:**
- `struct seg` — IN/OUT hit pair for one primitive on one ray
- `struct partition` — span of ray with accumulated segment list from all overlapping primitives
- `union tree` — binary tree with `OP_UNION`, `OP_INTERSECT`, `OP_SUBTRACT` at nodes, `OP_SOLID` at leaves

**Strengths:**
- No explicit solid output to corrupt. The CSG tree IS the model.
- Works directly on implicit/analytic geometry (quadrics, NURBS) — no tessellation needed
- Each ray is independent → embarrassingly parallel
- No coplanar face problem — segments overlap exactly and are fused by tolerance
- Handles zero-thickness partitions (thin features) explicitly

**Weaknesses:**
- No exportable solid. Every query (rendering, mass properties) requires re-tracing rays.
- Cannot produce a mesh/B-Rep result for downstream use
- Visualization quality depends on ray density

**When it fails:** Near-miss handling for BREP surfaces uses a 5-category classification (CLEAN_HIT, NEAR_HIT, NEAR_MISS, CRACK_HIT, CLEAN_MISS) with `BREP_EDGE_MISS_TOLERANCE = 5e-3`. When an odd number of hits occurs, the system walks the hit list trying to resolve NEAR_MISS pairs. This can still produce artifacts near trim boundaries.

### 2. FreeCAD/OCCT — B-Rep General Fuse (Exact Topology)

**How it works:**
1. **Intersection phase (BOPAlgo_PaveFiller):** Find all face-face, edge-edge, vertex-face intersections. Compute intersection curves. Store as Pave blocks.
2. **Building phase (BOPAlgo_Builder):** Split edges along pave points. Split faces along intersection curves. Produce face-fragments.
3. **Classification:** Sample a point on each fragment, test inside/outside the other solid. Keep/discard based on operation type.
4. **Assembly:** Rebuild shells and solids from selected fragments.

**When it fails (documented failure modes):**
- **Tangent surfaces:** Intersection curve degenerates to a point/cusp. Most common crash in FreeCAD. Two equal-diameter cylinders at an angle → failure.
- **Coplanar faces:** Surface-surface intersection solver oscillates or returns empty.
- **Tolerance accumulation:** After 10+ booleans, vertex tolerances grow, faces overlap. ShapeFix can't always repair.
- **Self-intersecting input:** Undefined behavior (crash or nonsense).
- **Thin features:** Produce edges/faces near tolerance, causing downstream fillet/mesh failure.

**Fuzzy booleans:** `SetFuzzyValue()` adds extra tolerance beyond per-entity tolerances. Partially mitigates tolerance mismatch from import.

### 3. Blender — Exact Solver (Mesh Arrangements)

**How it works (Zhou, Grinspun, Zorin, Jacobson, SIGGRAPH 2016):**
1. Find all triangle-triangle intersection pairs via BVH
2. Compute intersection segments using **exact rational arithmetic** (mpq3)
3. Subdivide intersecting triangles along intersection edges → arrangement
4. Assign winding number vector `(w_A, w_B)` per 3D cell
5. Select cells: Union = `w_A + w_B ≥ 1`, Intersection = `w_A ≥ 1 AND w_B ≥ 1`, Difference = `w_A ≥ 1 AND w_B = 0`
6. Extract boundary faces of selected cells

**Strengths:** Exact arithmetic. No tolerance. Handles coplanar, self-intersecting, non-manifold input. Variadic (any number of inputs).

**Weaknesses:** 2-10x slower than approximate methods. Triangle-count dependent. Requires manifold or near-manifold input for good results.

### 4. Manifold — Float + Symbolic Perturbation

**How it works:**
1. Morton-code spatial sorting for broad-phase collision
2. Triangle-triangle intersection with double precision
3. Face splitting and re-triangulation
4. **Symbolic perturbation** resolves exact-on-plane cases deterministically (perturb first mesh in ±normal direction depending on operation)
5. Winding number classification for non-overlapping regions
6. Topological cleanup: split pinched vertices, dedup edges, remove degenerate triangles

**Strengths:** 5-30x faster than CGAL. Guaranteed manifold output. Handles coplanar faces via perturbation.

**Weaknesses:** Not mathematically exact. Rare failures on perfectly coincident faces. Requires manifold input.

### 5. csgrs/BSP — BSP Tree Polygon Clipping

**How it works:**
1. Build BSP tree from polygon faces using splitting planes
2. For union: `a.clipTo(b); b.clipTo(a); b.clipTo(a); merge`
3. Each clip operation classifies polygons as FRONT/BACK/COPLANAR/SPANNING relative to splitting planes
4. SPANNING polygons are split using Sutherland-Hodgman clipping

**Strengths:** Simple algorithm. Pure Rust. WASM-compatible. f64.

**Weaknesses:** Polygon proliferation (each split creates more polygons → exponential growth on deep trees). Coplanar classification is fragile. Output is polygon soup (not guaranteed manifold). O(n*m) worst case.

---

## What NEXUS Needs

### Phase 1: 2D Region Booleans (v0.1)

For 2D drafting, boolean operations on closed polygonal regions are needed for:
- Hatching (clip line pattern against boundary)
- Complex area calculation (polygon with holes)
- Region subtract (door opening in wall)

**Decision: Use `i_overlay` (3M downloads).**

It uses integer arithmetic internally for robustness, handles holes and self-intersections, and is WASM-compatible. This is the right tool for 2D.

No architecture risk here — 2D polygon booleans are a solved problem.

### Phase 2: 3D Solid Booleans (v0.2)

This is the hard decision. The options:

**Option A — truck-shapeops only:**
Pure Rust B-Rep booleans. WASM-native. But: transversal intersections only (tangent faces fail), single maintainer, boolean robustness unknown at scale.

**Option B — csgrs (BSP mesh booleans) only:**
Pure Rust mesh booleans. WASM-native. But: polygon proliferation on deep trees, output not manifold, precision loss from mesh approximation.

**Option C — opencascade.js only:**
30 years proven, handles everything. But: ~5MB WASM, LGPL license, Emscripten (not Rust-native), separate memory space.

**Option D — Dual kernel (truck + csgrs):**
Use truck for B-Rep (exact topology), fall back to csgrs for mesh preview. But: two code paths, runtime switching logic, undefined "failure" detection.

**Option E — Dual kernel (truck + Manifold WASM):**
Use truck for B-Rep, fall back to Manifold for mesh. Manifold has better robustness guarantees than csgrs (symbolic perturbation, guaranteed manifold output). But: Manifold is C++ compiled to WASM, adding an external dependency.

### Decision: Option E with explicit failure protocol

**Primary path: truck-shapeops for B-Rep booleans.**
- Used for all extrude/revolve + boolean combinations
- Produces exact B-Rep topology (faces, edges, vertices with NURBS geometry)
- Required for STEP export (mesh booleans can't produce B-Rep)

**Fallback path: Manifold WASM for mesh booleans.**
- Used when truck-shapeops returns `None` (failure)
- Used for preview/STL export where exact topology isn't needed
- Lazy-loaded (~1MB) on first boolean operation

**The failure protocol (what the CAD agent critique asked for):**

```
1. User requests boolean (union/difference/intersection)
2. Tessellate both operands to mesh (for Manifold fallback)
3. Attempt truck-shapeops boolean on B-Rep
4. IF truck succeeds:
   → Store B-Rep result (primary geometry)
   → Tessellate for display
   → Log success
5. IF truck returns None:
   → Execute Manifold boolean on tessellated meshes
   → Store mesh result (display geometry only — NO B-Rep)
   → Mark entity with `BooleanFallback` component
   → Show user warning: "Result is approximate (mesh). 
      Downstream operations requiring exact geometry 
      (fillet, chamfer, STEP export) may fail."
   → Log failure reason for debugging
6. IF Manifold also fails:
   → Show user error: "Boolean operation failed."
   → Suggest: simplify geometry, check for self-intersections,
      try different operation order
   → Log full diagnostic
```

**The `BooleanFallback` component:**
```rust
pub struct BooleanFallback {
    pub reason: String,           // why truck failed
    pub mesh_only: bool,          // true = no B-Rep, mesh only
    pub original_operands: [Entity; 2],  // for retry
}
```

This is a proper design, not a hand-wave. The UX tells the user what happened. The data model tracks the fallback. Downstream operations check for `BooleanFallback` before attempting topology-dependent operations.

### What NOT to do

1. **Do NOT silently fall back.** Users must know when they have approximate geometry. Hiding failures causes worse failures later (fillet on mesh geometry → crash with no explanation).

2. **Do NOT run both engines on every operation.** Only invoke Manifold when truck fails. Running both doubles computation time for zero benefit on success.

3. **Do NOT store the Manifold result as B-Rep.** Manifold produces a triangle mesh. Do not attempt to reconstruct B-Rep topology from it — that's a research problem (surface fitting), not an engineering task.

4. **Do NOT use csgrs as the mesh fallback.** Its BSP algorithm has known polygon proliferation and robustness issues. Manifold's symbolic perturbation and guaranteed manifold output are worth the ~1MB WASM overhead.

5. **Do NOT defer this design to "when we get there."** The `BooleanFallback` component must be in the ECS component design from day one, even if it's empty until v0.2.

### Failure Mode Coverage

| Failure Mode | truck | Manifold | Combined Coverage |
|-------------|-------|----------|------------------|
| Coplanar faces | FAILS | HANDLES (perturbation) | Covered by fallback |
| Tangent surfaces | FAILS | HANDLES (perturbation) | Covered by fallback |
| Self-intersecting input | Unknown | REJECTS | Error reported |
| Thin features/slivers | May produce | Cleaned up | Better with Manifold |
| Non-manifold result | May produce | Guaranteed manifold | Better with Manifold |
| Tolerance cascade | No (f64 direct) | No (adaptive epsilon) | Not an issue |
| Deep CSG tree (10+ ops) | Each op independent | Each op independent | OK |

### Phase 3+: BRL-CAD Ray-Based CSG (Optional)

When rust-brlcad kernel is integrated (if ever), its ray-based segment weaving provides a third path — one that never fails on implicit geometry. This would be used for:
- High-precision rendering (ray tracing)
- Mass properties (Monte Carlo integration via rays)
- Interference checking (fire rays, count overlaps)

It does NOT replace B-Rep or mesh booleans for interactive display or export. It's a complementary analysis tool.

---

## Rust Crate Summary for Booleans

| Crate | Algorithm | WASM | Robustness | Output | When to Use |
|-------|-----------|------|-----------|--------|-------------|
| **i_overlay** (3M) | Polygon clipping (integer) | YES | Excellent | 2D polygons | v0.1: 2D region booleans |
| **truck-shapeops** (6.5K) | B-Rep General Fuse | YES | Transversal only | B-Rep solid | v0.2: primary 3D path |
| Manifold (via WASM) | Symbolic perturbation | YES | Good | Manifold mesh | v0.2: fallback path |
| **csgrs** (34K) | BSP tree | YES | Fair | Polygon soup | Preview/prototyping only |
| **parry3d-f64** (5M) | Collision detection | YES | N/A | Contact points | NOT for booleans |
