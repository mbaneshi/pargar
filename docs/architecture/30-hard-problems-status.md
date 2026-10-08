# 32 — Hard Problems Status: Geometry, Constraints, Rendering

**Date:** 2026-04-15
**Scope:** Assessment of the three foundational technical challenges in NEXUS — geometry math, constraint solving, and rendering performance — mapped against industry standards and our current implementation.

---

## 1. Geometry Math

### Industry Standard

Mature CAD kernels (OpenCASCADE, Parasolid, ACIS) use:
- **B-Rep topology** with winged-edge or half-edge data structures
- **Exact arithmetic predicates** (Shewchuk orientation tests, GMP rationals) to eliminate floating-point phantom intersections
- **NURBS evaluation** for freeform curves/surfaces with knot insertion, degree elevation, and basis function computation
- **General curve-curve intersection** solvers (subdivision + Newton refinement) supporting line-circle, circle-circle, conic-conic, and spline-spline pairs
- **Configurable tolerance structs** passed through every operation, with per-entity tolerance for imported geometry (ISO 10303 STEP requires this)
- Libraries: `nalgebra`, `geo`, `kurbo`, `robust` (Rust); CGAL, Clipper2 (C++)

### NEXUS Today — Maturity 4/10

**What exists:**
- 15 geometry types in `GeometryType` enum (`packages/kernel/src/entity.rs`) with full transform support (translate, rotate, scale, mirror)
- Offset (lines, circles, polylines), fillet/chamfer (line-line only), trim/extend (line-line only), join (polyline concatenation)
- Measurement: distance (Euclidean), area (shoelace, circle, ellipse)
- 5 tolerance constants as module globals in `packages/kernel/src/tolerance.rs`:
  - `POINT_COINCIDENCE = 1e-8`
  - `ZERO_LENGTH = 1e-10`
  - `PARALLEL_DENOMINATOR = 1e-12`
  - `PARAMETER_EXTENSION = 1e-9`
  - `SOLVER_CONVERGENCE = 1e-6`

**What's missing:**
- **Only line-line intersections** — no circle-line, circle-circle, arc-line, or curve-curve
- **No math libraries** — all hand-coded 2D float arithmetic; `robust`, `nalgebra`, `parry2d` not integrated despite being listed as dependencies in CLAUDE.md
- **Splines are inert** — stored as control points but never evaluated (no basis functions, no tangent computation)
- **No exact arithmetic** — vulnerable to phantom intersections near degeneracies
- **Global tolerance constants** — not configurable per-operation or per-entity; unsuitable for multi-scale models (PCB traces at 1e-4m to GIS at 1e+7m)
- **No B-Rep topology** — entities are flat geometry bags, no face/edge/vertex adjacency

### Critical Next Step

Add `robust` crate for exact orientation/intersection predicates, then implement circle-line and circle-circle intersections. This unblocks: better snapping, trim/extend on arcs, fillet on arc-line pairs, and future boolean operations.

### Upgrade Path

| Phase | Action | Impact |
|-------|--------|--------|
| v0.2 | Add `robust` crate for exact predicates | Eliminates phantom intersections |
| v0.2 | Implement circle-line, circle-circle intersection | Unblocks arc trim/extend/fillet |
| v0.2 | Move tolerance to configurable struct | Multi-scale model support |
| v0.3 | Spline evaluation (basis functions, tangents) | Real curve support |
| v0.3 | Per-entity tolerance for imported geometry | STEP/IFC interop |
| v0.4+ | B-Rep topology via `truck` crate | 3D solid modeling foundation |

---

## 2. Constraint Solving

### Industry Standard

- **FreeCAD:** planegcs (Newton-Raphson with analytic Jacobian, 37 constraint types, DOF tracking, conflict detection). Proven over 20+ years.
- **Onshape / SolidWorks:** Proprietary sparse solvers with full DOF feedback, redundancy detection, and drag-solving (real-time constraint satisfaction during mouse drag).
- **Key requirements:** Tangent, angle, concentric, symmetric constraints; DOF count per sketch (green = under-constrained, black = fully constrained, red = over-constrained); conflict resolution UI.

### NEXUS Today — Maturity 3/10

**What exists (`packages/kernel/src/constraints.rs`, 606 lines):**
- Hand-rolled iterative averaging solver
- 8 constraint types: Fixed, Coincident, Horizontal, Vertical, Distance, Parallel, Perpendicular, EqualLength
- 50 max iterations, 1e-6 convergence tolerance
- 37 tests passing in kernel
- Commands wired for all 8 types via `AddConstraint*` variants
- Properly tiered tolerance: solver 1e-6 vs geometry 1e-8

**What's missing:**
- No DOF counting or overconstrained detection
- No tangent, angle, concentric, symmetric, midpoint, point-on-line, point-on-circle constraints
- No convergence guarantee on complex interleaved systems
- No drag-solving (real-time constraint satisfaction during entity manipulation)
- No constraint visualization (icons showing H/V/||/etc. near entities)

### Prototyped (Not Merged)

**ezpz integration** (worktree `agent-ae1432e5`, `packages/kernel/src/solver_ezpz.rs`, 770 lines):
- Zoo/KittyCAD's pure Rust solver, MIT license, compiles to wasm32-unknown-unknown
- ~20 constraint types including Tangent, Angle, Concentric, PointOnLine, PointOnCircle
- Newton-Raphson with proper Jacobian via `faer` linear algebra
- DOF counting and overconstrained detection
- 8 tests passing, benchmarked
- **Tradeoff:** 31.6x slower than hand-rolled for simple cases (73ms vs 2.3ms for 20 entities, 15 constraints, 100 solves) — but converges in 1 iteration with guarantees

**Decision (AD-14):** Hybrid strategy — keep hand-rolled for <10 constraints (fast path), use ezpz for complex systems where convergence guarantees matter. planegcs WASM as fallback (LGPL license concern for commercial use).

### Critical Next Step

Merge ezpz prototype. Wire DOF feedback into UI (color-coded entity states). This enables parametric sketching — the feature that separates a drafting tool from a real CAD system.

### Upgrade Path

| Phase | Action | Impact |
|-------|--------|--------|
| v0.2 | Merge ezpz hybrid solver | Tangent/angle constraints, DOF feedback |
| v0.2 | Constraint visualization (H/V/||/T icons) | User understands sketch state |
| v0.3 | Drag-solving (real-time satisfaction) | Professional sketching UX |
| v0.3 | Evaluate planegcs for B-spline constraints | Advanced parametric curves |
| v1.0+ | Custom solver if civil engineering constraints require it | Alignment, superelevation |

---

## 3. Rendering Performance

### Industry Standard

Production CAD renderers use:
- **Instanced rendering** — one draw call for thousands of identical primitives (bolts, symbols)
- **Frustum/viewport culling** — only draw what the camera sees, using spatial index (R-tree, BVH, quadtree)
- **Level of Detail (LOD)** — simplify distant geometry (Potree for point clouds, mesh decimation for solids)
- **GPU tessellation / compute shaders** — tessellate curves on GPU, not CPU
- **Glyph atlas** — single texture atlas for all text, not per-label canvas
- **Draw call batching** — merge geometries by material into InstancedBufferGeometry
- **Web Worker offload** — heavy computation off main thread
- **WebGPU** — modern GPU API with compute shaders (replacing WebGL)

### NEXUS Today — Maturity 3/10

**What exists (`packages/renderer/src/CadRenderer.ts`):**
- Three.js v0.170.0 with orthographic camera
- One `THREE.Object3D` per entity (scene graph, not instanced)
- Material cache (`Map<string, THREE.Material>`) avoids material recreation
- Delta sync — only changed entities re-rendered via `applyChanges()`
- Proper resource disposal (`disposeObject()` traversal)
- 5 linetype patterns (dashed, center, hidden, dot, dashdot)
- Layer-based style inheritance
- Pixel ratio capped at 2x

**What's missing:**
- **No viewport culling** — all entities rendered regardless of camera view
- **No instanced rendering** — each entity is a separate Three.js object
- **No draw call batching** — no merged geometries
- **No LOD** — full geometry at all zoom levels
- **O(n) snap search** — linear scan through all entities every mouse move (`SnapEngine.ts`)
- **No spatial indexing** — linear iteration for hit testing
- **Canvas texture per text label** — no glyph atlas
- **Main thread only** — no Web Worker offload
- **No custom shaders** — pure Three.js built-in materials

**Scaling limits:**

| Entity Count | Frame Time | Status |
|-------------|-----------|--------|
| <1K | <1ms | Fine |
| 10K | 5-10ms | Approaching 60fps budget |
| 50K+ | Snap engine bottleneck | Needs spatial index |
| 100K+ | Scene graph bottleneck | Needs culling + instancing |

### Prototyped (Not Merged)

**rstar R-tree spatial index** (worktree `agent-ae1432e5`, `packages/kernel/src/spatial_index.rs`, 346 lines):
- 46-156x speedup on spatial queries vs linear scan
- Benchmarked: 10K entities, 1000 window queries in 28ms vs 1,315ms linear
- +5KB WASM size impact
- Enables viewport culling AND fast snap/hit-test

### Critical Next Step

Merge rstar spatial index. Wire it into snap engine and hit testing. This is the highest-ROI single improvement — fixes the O(n) bottleneck that caps entity count at ~10K for interactive use.

### Upgrade Path

| Phase | Action | Impact |
|-------|--------|--------|
| v0.2 | Merge rstar spatial index | 50-150x faster snap/hit-test |
| v0.2 | Viewport culling via R-tree window query | Only render visible entities |
| v0.2 | Web Worker for kernel operations | Unblock main thread during heavy commands |
| v0.3 | Binary mesh transfer (TypedArrays) | Replace JSON stringify/parse (~5-10ms savings) |
| v0.3 | Glyph atlas for text rendering | Fix per-label canvas texture overhead |
| v0.4 | SharedArrayBuffer for live parametric preview | Zero-copy kernel→renderer |
| v1.0 | WebGPU migration + instanced rendering | 100K+ entity target |
| v1.0 | Multi-renderer composition (CesiumJS, Potree, xeokit) | GIS/BIM/point cloud layers |

---

## Consolidated View

| Problem | Industry Gold Standard | NEXUS Maturity | Biggest Gap | Prototype Ready? |
|---------|----------------------|----------------|-------------|-----------------|
| Geometry Math | OCCT + exact predicates + NURBS | 4/10 | Line-line intersections only | No |
| Constraint Solver | planegcs / sparse Newton-Raphson, 37+ types, DOF | 3/10 | No DOF, 8 types only | Yes (ezpz) |
| Rendering Perf | WebGPU + instancing + culling + R-tree | 3/10 | O(n) snap, no culling | Yes (rstar) |

### Priority Order

1. **Merge rstar spatial index** — highest ROI, no downside, unblocks culling + fast snap
2. **Merge ezpz constraint solver** — enables parametric sketching, the defining CAD feature
3. **Add `robust` crate + circle/arc intersections** — unblocks trim/extend/fillet on curves
4. **Viewport culling** — wire R-tree into renderer for visible-only drawing
5. **Web Worker offload** — move kernel to worker thread for non-blocking commands

Items 1-2 have working prototypes in worktrees. Item 3 requires new work. Items 4-5 are architectural wiring once the foundations (1-3) are in place.
