# Rust CAD Ecosystem Consultancy for NEXUS Agents

> Author: Tech Lead consultancy, 2026-04-15
> Audience: Every AI agent and human developer working on NEXUS
> Scope: What the Rust/CAD open-source ecosystem offers, what trade-offs exist, and how to use it across every sprint and phase
> Status: BINDING REFERENCE — read before implementing any geometry, constraint, file I/O, or rendering feature

---

## Part 1: Where We Are

### The Product

NEXUS is a browser-native spatial engineering platform. It replaces AutoCAD, Civil 3D, Revit, and ArcGIS with a single browser tab. Zero install, local-first, AI-native.

### What Exists Today (v0.1 — ~15K LOC total)

**Rust/WASM Kernel (5,237 LOC, 37 tests):**
- 18 geometry types (Line, Circle, Arc, Polyline, Rectangle, Ellipse, Spline, Text, 5 Dimension types, Hatch, MText, Table, ConstructionLine, BlockRef)
- 54 command variants (JSON-serializable, serde-tagged)
- 8 constraint types (hand-rolled iterative solver: Fixed, Coincident, Horizontal, Vertical, Distance, Parallel, Perpendicular, EqualLength)
- Event sourcing (9 event types, undo/redo via cursor, Actor attribution)
- Layer system (create/delete/rename, visibility/lock/color)
- Block definitions and references
- Advanced editing (offset, mirror, trim, extend, fillet, chamfer, explode, join, arrays)
- Dirty tracking (incremental sync for renderer)

**TypeScript Frontend (~10K LOC):**
- 27 tools (draw, edit, modify, annotate)
- Three.js 2D viewport (orthographic, pan/zoom, grid)
- Snap engine (endpoint, midpoint, center, intersection, grid, nearest)
- Selection manager with grip editing
- DXF import (dxf-parser) + export (hand-rolled)
- Project persistence (IndexedDB/OPFS)
- AutoCAD-style command line with aliases
- Auto-save every 30 seconds

**Current Rust dependencies (minimal):**
```toml
wasm-bindgen = "0.2"
serde = "1"
serde_json = "1"
js-sys = "0.3"
web-sys = "0.3"
```

### The 7 Architectural Rules (Non-Negotiable)

1. **Every Operation Is a Command** — GUI, CLI, API, AI agent all dispatch the same Command enum
2. **Event-Sourced State** — Every mutation → immutable event. Current state = replay. Never mutate directly.
3. **ECS Data Model** — Entity = ID. Components = data bags. No class inheritance. Scales to 500K+ entities.
4. **Additive Expansion** — New domains (3D, BIM, GIS, Civil, Point Cloud, Digital Twin) = new components + commands. Never rewrite core.
5. **Rust/WASM for Computation, TypeScript for Interaction** — Geometry math → Rust. UI → TypeScript. Bridge = JSON via wasm-bindgen.
6. **AI Agents Are First-Class Users** — MCP tool schema defined at same time as every operation.
7. **Research Before Building** — Check ecosystem first. Only build what genuinely doesn't exist.

### The Expansion Path (Locked)

```
v0.1  2D CAD (NOW — Sprints 7-9 to ship)
v0.2  3D CAD (Phase 2 — OCCT/Truck, extrude/revolve, booleans)
v0.3  BIM    (Phase 3 — web-ifc, IFC, Yjs collaboration)
v0.4  GIS    (Phase 4 — CesiumJS, proj4, geospatial)
v0.5  Civil  (Phase 5 — Custom Rust, no OSS exists)
v0.6  Multi-Agent + Plugins (Phase 6 — LangGraph, Extism)
v0.7  Digital Twin (Phase 7 — IoT, streaming)
v1.0  Production (SOC 2, enterprise SSO)
```

### Sprint Status

| Sprint | Status | What Shipped |
|--------|--------|-------------|
| 0 (Foundation) | DONE | Monorepo, WASM builds, Three.js canvas |
| 1 (Drawing) | DONE | 5 entity types, grid, viewport, layers, selection |
| 2 (Edit) | DONE | Move/copy/delete/rotate/scale, event sourcing, undo/redo, command line, snapping |
| 3 (Constraints + Persistence) | DONE | DXF I/O, OPFS auto-save, 8 constraint types |
| 4-5 (Layers + Performance) | DONE | Layer panel, polyline, dirty tracking, incremental render, AutoCAD aliases, ORTHO/SNAP |
| 6 (Properties + Edit Tools) | DONE | Offset, trim, mirror, scale tools, properties panel, hover highlight |
| Foundation Sprint | DONE | Command system (54 variants), EventEnvelope, Actor, execute_command() WASM binding |
| **7 (Text + Dimensions)** | **NEXT** | Text/dimension rendering, constraint toolbar |
| 8 (Deploy + DXF + Help) | PENDING | Vercel deploy, DXF round-trip tests, help overlay |
| 9 (User Test + Ship) | PENDING | 5 drafters test, fix top 3 blockers, tag v0.1.0 |

---

## Part 2: The Rust CAD Ecosystem — What Exists

This section catalogs every relevant Rust crate, organized by what NEXUS needs. Each entry includes: what it does, download count (trust signal), f64 precision, WASM compatibility, and honest trade-offs.

### 2.1 Math Foundation

| Crate | Downloads | f64 | WASM | What It Does | Trade-offs |
|-------|-----------|-----|------|-------------|------------|
| **nalgebra** | 63.5M | YES | YES | Full linear algebra — vectors, matrices, decompositions (SVD, QR, LU, Cholesky, eigendecomp). Static + dynamic sizes. | Heavy dependency tree. Overkill if you only need Vec2/Vec3. |
| **glam** | 61.7M | YES (DVec2/3/4) | YES | Fixed-size vectors/matrices with SIMD. Fastest for hot-path math. | No dynamic matrices, no decompositions. Game-oriented. |
| **roots** | 2.3M | YES | YES | Polynomial root solvers (quadratic through quartic). Ferrari's, Cardano's, Sturm, eigenvalue methods. | Cubic solver lacks Newton refinement for small leading coefficients. |
| **robust** | 15.5M | YES | YES | Exact geometric predicates — `orient2d`, `orient3d`, `incircle`, `insphere`. Shewchuk's algorithm. | Only provides predicates, not full intersection computation. |

**Recommendation for NEXUS:**
- Use `robust` immediately (Sprint 7-8) for degenerate intersection detection
- Use `nalgebra` when 3D is added (v0.2) — it integrates with parry, curvo, bvh, truck
- Use `roots` when ray-surface intersection is needed (v0.2+ BRL-CAD kernel integration)
- Keep hand-rolled Point2D transforms for now (correct, trivial, no dependency needed)

### 2.2 2D Geometry

| Crate | Downloads | f64 | WASM | What It Does | Trade-offs |
|-------|-----------|-----|------|-------------|------------|
| **kurbo** | 19.3M | YES | YES | 2D curve primitives (Line, Arc, Circle, QuadBez, CubicBez, Ellipse, Rect, BezPath). Arc-length, nearest point, curvature, bounding box, winding number. | No polyline type (uses BezPath). No offset/fillet/trim. |
| **cavalier_contours** | 18K | YES | YES | Polyline with arc segments. Arc-aware parallel offset. Polyline boolean ops (union/intersect/diff). Self-intersection removal. | Small community. Only handles polylines (not arbitrary curves). |
| **i_overlay** | 3.0M | YES | YES | 2D polygon booleans (union/intersect/diff/XOR). Handles holes, self-intersections. Robust (integer arithmetic internally). | Input is polygonal — no arc segments. Approximates curves as line segments. |
| **geo** | 15.3M | YES | YES | Geospatial 2D primitives. Area, centroid, convex hull, point-in-polygon, simplification. | Geospatial-oriented, not CAD-specific. No arcs, circles, ellipses. |
| **parry2d** | 1.2M | YES | YES | 2D collision detection — ball, cuboid, capsule, segment, polyline, convex polygon. Ray casting, distance queries. | Collision-oriented, not drafting-oriented. No arcs, no offset. |

**Recommendation for NEXUS:**
- **cavalier_contours** NOW (Sprint 7-8): Replace hand-rolled polyline offset. The only crate doing arc-aware parallel offset — exactly what "offset a wall" needs.
- **i_overlay** NOW: Enables hatching (clip line pattern against polygon boundary) and complex area calculation.
- **kurbo** for Sprint 7: Spline evaluation (your Spline entity has control points but no evaluator), arc-length computation for dimension tick marks, nearest-point for snap.
- **geo** when GIS is added (v0.4).
- **parry2d** for spatial queries when snap engine moves to Rust.

### 2.3 Constraint Solving

| Crate | Downloads | f64 | WASM | What It Does | Trade-offs |
|-------|-----------|-----|------|-------------|------------|
| **ezpz** | 41K | YES | YES | 2D sketch constraint solver built by Zoo/KittyCAD. ~20 constraint types: coincident, H/V, distance, angle, tangent, perpendicular, parallel, equal, symmetric, midpoint, concentric. Gauss-Newton/LM solver. DOF counting. | Young project (v0.2). API may change. Documentation sparse. |
| **arael-sketch-solver** | 70 | YES | YES | 2D constraint solver with compile-time symbolic differentiation for Jacobian. Entities: points, lines, circles, arcs. | Brand new (70 downloads). Unproven at scale. |
| **argmin** | 3.0M | YES | YES | General optimization framework — L-BFGS, Nelder-Mead, Gauss-Newton, Levenberg-Marquardt, trust region, simulated annealing. | Not a constraint solver — it's an optimization backend. You formulate constraints as least-squares problem. |
| **levenberg-marquardt** | 606K | YES | YES | Standalone LM nonlinear least-squares solver. Clean API, well-tested. Built on nalgebra. | Just the solver — no constraint formulation layer. |
| planegcs (WASM, npm) | N/A | YES | YES | FreeCAD's proven constraint solver compiled to WASM. 37 constraint types, 3 solver algorithms, 15+ years of fixes. | LGPL-2.1 license. Separate WASM runtime. Not a Rust crate — npm package. |

**Recommendation for NEXUS:**

This is the single most consequential choice for parametric CAD. Three paths:

**Path A — ezpz (RECOMMENDED for v0.1-v0.2):**
Replace your hand-rolled solver with ezpz. It's pure Rust, WASM-ready, built by a production CAD company. ~20 constraint types covers all PRD P0+P1 constraints. When it lacks something (rare geometric cases), contribute upstream or fall back to Path B.

- Effort: 2-3 days (replace `ConstraintSolver` internals, keep your `Constraint`/`ConstraintType` enums)
- Risk: Young project, API instability
- Mitigation: Pin version, wrap with your own trait

**Path B — planegcs WASM (RECOMMENDED for v0.3+ if ezpz is insufficient):**
Integrate the proven FreeCAD solver as a lazy-loaded WASM module. 37 constraint types, battle-tested. This is what combined-rust-cad recommended.

- Effort: 2-3 days (npm package, WebSocket or direct WASM call)
- Risk: LGPL-2.1 license (acceptable for web app), separate WASM binary (~500KB)
- Mitigation: Lazy-load only when constraints are used

**Path C — Custom solver on argmin/LM (LONG-TERM for v1.0):**
Build a bespoke constraint solver using `levenberg-marquardt` or `argmin` as the optimization backend. Maximum control, pure Rust, no external dependency.

- Effort: 3-6 months for full 37-type solver
- When: Only if ezpz and planegcs prove insufficient for civil engineering constraints

**Current hand-rolled solver (8 types, iterative averaging):** Keep for v0.1 ship. It works for the basic floor plan use case. Replace in the sprint immediately after v0.1 ships.

### 2.4 3D Geometry & Solid Modeling

| Crate | Downloads | f64 | WASM | What It Does | Trade-offs |
|-------|-----------|-----|------|-------------|------------|
| **truck** (14 sub-crates) | 33K | YES | PARTIAL | Most mature pure-Rust B-Rep CAD kernel. NURBS curves/surfaces (truck-geometry), generic topology — Vertex\<P\>, Edge\<P,C\>, Face\<P,C,S\> (truck-topology), extrude/revolve/sweep (truck-modeling), solid booleans (truck-shapeops), STEP I/O (truck-stepio), tessellation (truck-meshalgo). | Boolean ops only work for transversal intersections (tangent faces fail). No fillet/chamfer/shell/draft. Solo maintainer. Uses cgmath (deprecated), not nalgebra. |
| **curvo** | 221K | YES | YES | Comprehensive NURBS library — curves, surfaces, extrude, loft, sweep, revolve, trim, split, fillet, offset, tessellation (adaptive + advancing front). 84 releases, very active. | No surface-surface intersection (marching/mod.rs is empty). No B-Rep topology. No solid booleans. |
| **csgrs** | 34K | YES | YES | CSG booleans on triangle meshes via BSP trees. Rich primitive library (cube, sphere, cylinder, torus, ellipsoid, gears, TPMS, metaballs). Extrude, revolve, sweep. Text as geometry (Hershey + TrueType). STL/OBJ/PLY/glTF/AMF/DXF export. | Mesh-based (not B-Rep). BSP trees produce polygon proliferation on deep trees. Output not guaranteed manifold. |
| **opencascade-rs** | 3.5K | YES | **NO** | Full OCCT power: all primitives, extrude, revolve, loft, sweep, **fillet, chamfer, shell, draft**, booleans, STEP/IGES I/O, NURBS. 30 years proven. | C++ FFI. Cannot compile to WASM. 12-min first build. Heavy dependency. |
| **parry3d-f64** | 5.0M | YES | YES | 3D collision/ray casting — Ball, Cuboid, Capsule, Cylinder, Cone, HalfSpace, TriMesh, HeightField, ConvexPolyhedron. BVH, AABB, distance queries. | Returns only ONE hit per ray (no multi-hit for CSG). GJK-based (iterative, not analytic). Collision library, not CAD kernel. |
| **bvh** | 1.6M | YES | YES | BVH with SAH for ray tracing. Uses nalgebra. f64 works out of the box via generic `BHValue` trait. | Documentation uses f32 in examples (misleading — f64 works fine). |
| **fidget** | 42K | f32 only | YES | Implicit surface evaluation with JIT compiler. CSG via min/max. Interval arithmetic. Manifold Dual Contouring meshing. Near-GPU performance on CPU. | **f32 only** — 7 decimal digits, insufficient for CAD. No ray tracing. No parametric surfaces. "Personal-scale experimental project." |

**Recommendation for NEXUS:**

**v0.2 (3D foundation) — Dual-kernel strategy:**

1. **truck** for exact B-Rep: Use truck-modeling for extrude/revolve, truck-shapeops for booleans, truck-topology for vertex/edge/face/shell/solid representation, truck-stepio for STEP I/O. Accept its limitations (no fillet, tangent booleans fail).

2. **csgrs** for fast mesh preview: When truck-shapeops fails or for quick preview, fall back to mesh booleans via csgrs. Also use csgrs for STL/OBJ/glTF export.

3. **curvo** for NURBS: Use curvo for NURBS curve/surface evaluation, tessellation, and curve operations. Layer it under truck's topology (truck-geometry uses its own NURBS, but curvo is more feature-complete).

**The fillet/chamfer/shell/draft gap:**
This is the most critical missing capability in the pure-Rust WASM ecosystem. Only OCCT has it, and OCCT doesn't compile to WASM. Three options:
- **Option A:** Use opencascade.js (OCCT compiled to WASM via Emscripten, ~5MB lazy-loaded). This is what the planning docs recommend.
- **Option B:** Defer fillet/chamfer to v0.3+, ship v0.2 without them.
- **Option C:** Build a Rust fillet algorithm (3-6 month effort, research-grade difficulty).

Recommendation: **Option A** for v0.2 (lazy-load opencascade.js), then evaluate building pure-Rust fillet for v1.0.

### 2.5 File Format I/O

| Format | Crate | Downloads | Read | Write | WASM | Status |
|--------|-------|-----------|------|-------|------|--------|
| DXF | **dxf** | 117K | YES | YES | YES | Mature. Pure Rust. Replace TS dxf-parser. |
| STL | **stl_io** | 2.8M | YES | YES | YES | Production-ready. |
| OBJ | **tobj** (read) / **wavefront_rs** (write) | 1.8M / 48K | YES | YES | YES | Solid. |
| glTF | **gltf** | 6.4M | YES | YES | YES | Dominant. Excellent. |
| SVG | **svg** | 5.3M | YES | YES | YES | Standard. |
| PLY | **ply-rs** | 1.4M | YES | YES | YES | Good. |
| 3MF | **threemf** | 29K | YES | YES | PARTIAL | Adequate. |
| STEP | **truck-stepio** | 14K | YES | YES | PARTIAL | AP203 only. Experimental. |
| COLLADA | **dae-parser** | 224K | YES | YES | YES | Solid. |
| LAS/LAZ | **las** + **laz** | 1.1M + 373K | YES | YES | YES | Mature. |
| E57 | **e57** | 94K | YES | YES | YES | Good. |
| KML | **kml** | 253K | YES | YES | YES | Good. |
| Shapefile | **shapefile** | 562K | YES | YES | YES | Solid. |
| GeoJSON | **geojson** | 7.9M | YES | YES | YES | Excellent. |
| IFC | **ifc_rs** | 12K | YES | YES | PARTIAL | Alpha quality. |
| IFC (WASM) | **ifc-lite-wasm** | 592 | YES | — | YES | Explicit WASM. |
| FBX | **fbxcel** | 62K | YES | NO | YES | Read-only. |
| DWG | **acadrust** | 1.1K | YES | YES | ? | Immature. |
| IGES | — | — | — | — | — | **GAP — no Rust crate** |
| VRML/X3D | — | — | — | — | — | **GAP — no Rust crate** |
| BRL-CAD .g | — | — | — | — | — | **GAP — rust-brlcad will fill** |

**Recommendation for NEXUS:**
- Sprint 8: Consider moving DXF parsing from TS (`dxf-parser`) to Rust (`dxf` crate) for validation. Low priority — TS version works.
- v0.2: Add `stl_io`, `gltf`, `svg` for export. Add `truck-stepio` for STEP.
- v0.3: Add `ifc-lite-wasm` or `ifc_rs` for BIM.
- v0.4: Add `las`, `laz`, `geojson`, `shapefile`, `kml` for GIS.

### 2.6 Spatial Indexing

| Crate | Downloads | f64 | WASM | What It Does | Trade-offs |
|-------|-----------|-----|------|-------------|------------|
| **rstar** | 22M | YES | YES | R*-tree. Bulk loading, range queries, nearest-neighbor. | General-purpose, not CAD-specific. |
| **bvh** | 1.6M | YES | YES | BVH with SAH. Optimized for ray casting. | Better for ray tracing than for point queries. |
| **kiddo** | 5.5M | YES | YES | K-d tree. Fastest nearest-neighbor queries. | Point-only (no envelope/polygon queries). |

**Recommendation for NEXUS:**
- **rstar** is the right choice for NEXUS. Add to kernel for:
  - Window/crossing selection: `query_window(bbox) → Vec<EntityId>` — O(log n) instead of O(n)
  - Snap-to-nearest: `query_nearest(point, radius) → Option<EntityId>` — O(log n)
  - Move snap engine from TypeScript to Rust kernel for large drawings
- When: Phase 1 (post v0.1) or Sprint 8 if 10K entity performance is a blocker.

### 2.7 Rendering & UI

| Crate | Downloads | WASM | What It Does | Trade-offs |
|-------|-----------|------|-------------|------------|
| **wgpu** | 19.7M | YES | WebGPU/WebGL2 abstraction. The standard for Rust GPU. | Low-level. Need to build renderer on top. |
| **three-d** | 280K | YES | Higher-level 3D rendering on wgpu. Non-game oriented. | Less flexible than raw wgpu. |
| **egui** | 15.2M | YES | Immediate-mode UI. Custom 3D viewport via wgpu painting. | Can't match Svelte 5 UI quality. |
| **lyon** | 3.7M | YES | 2D path tessellation for GPU (fill + stroke). | f32 only — precision concern for CAD. |
| **spade** | 11.7M | YES | Constrained Delaunay triangulation. | Not a renderer — provides tessellation input. |
| **earcutr** | 7.5M | YES | Fast polygon triangulation (earcut). | Simple polygons only (no Steiner points). |

**Recommendation for NEXUS:**
- Keep Three.js for 2D/3D rendering (TypeScript side). It's proven and matches the architectural rule (TS for interaction).
- Use **spade** or **earcutr** in Rust kernel for tessellation when geometry needs triangulation (hatching, 3D mesh generation).
- If native desktop app is ever needed, use **egui** + **wgpu** for a fully Rust-side UI.

### 2.8 ECS, Events, Serialization

| Crate | Downloads | WASM | What It Does | Trade-offs |
|-------|-----------|------|-------------|------------|
| **hecs** | 375K | YES | Minimal ECS. No framework baggage. Library-first. | Smaller ecosystem than bevy_ecs. |
| **bevy_ecs** | 5.7M | YES | Full ECS with change detection, observers, system scheduling. | Pulls in Bevy ecosystem. Heavy. Game-oriented. |
| **undo** | 174K | YES | Command-based undo/redo with tree/linear history. | Basic — no event sourcing, no audit trail. |
| **serde** | 925M | YES | Serialization framework. | Already using it. |
| **ciborium** | 145M | YES | CBOR — self-describing binary format. Good for versioned file formats. | Slower than bincode for pure speed. |
| **rmp-serde** | 89M | YES | MessagePack — compact binary. | Not self-describing (needs schema). |
| **bincode** | 222M | YES | Fastest binary serialization. | Not self-describing, not human-readable. |
| **petgraph** | 21M | YES | Graph data structures — directed/undirected, toposort, DFS, BFS, cycle detection. | General-purpose, not CAD-specific. |

**Recommendation for NEXUS:**
- **hecs** when ECS migration happens (Phase 1, post v0.1). Lighter than bevy_ecs, better fit for a library kernel.
- Keep hand-rolled event sourcing (60 lines, Vec + cursor). No crate improves on this for NEXUS's needs.
- **petgraph** when feature tree / dependency graph is needed (v0.2 parametric).
- **ciborium** for native file format (v0.2) — self-describing, schema-evolvable, compact.

### 2.9 Expression Engine & Parametric

| Crate | Downloads | WASM | What It Does | Trade-offs |
|-------|-----------|------|-------------|------------|
| **evalexpr** | 7.0M | YES | Math expression evaluator. Variables, custom functions, comparison, ternary. | No loops, no user-defined functions beyond custom closures. |
| **rhai** | 6.0M | YES | Full embedded scripting language. Functions, modules, control flow. | Much heavier than evalexpr. Full language, not just expressions. |
| **fasteval** | 192K | YES | High-performance compiled expression evaluator. | Less flexible than evalexpr. Fastest for hot-path formulas. |

**Recommendation for NEXUS:**
- **evalexpr** for v0.2 parametric dimensions. Type `"width * 2 + 5"` in dimension input → evaluate → propagate.
- **rhai** if OpenSCAD-like scripting is ever added (v0.5+). Full language with function definitions.

### 2.10 Analysis & Measurement

| Crate | Downloads | f64 | WASM | What It Does |
|-------|-----------|-----|------|-------------|
| **polyhedral_mass_properties** | 4.4K | YES | YES | Volume, surface area, center of mass, inertia tensor from triangle mesh. |
| **uom** | 2.7M | YES | YES | Units of measurement — mm, in, m, ft, degrees, radians with type-safe conversion. |

**Recommendation for NEXUS:**
- **polyhedral_mass_properties** for v0.2 (3D mass properties after tessellating B-Rep solid).
- **uom** for v0.2 (engineering units in dimension display and property panel).

### 2.11 AI & MCP

| Crate | Downloads | WASM | What It Does |
|-------|-----------|------|-------------|
| **rmcp** | 7.5M | YES | Full MCP server/client SDK for Rust. |
| **jsonrpsee** | 18.6M | YES | Production JSON-RPC framework. |

**Recommendation for NEXUS:**
- **rmcp** for Phase 1 (post v0.1) when MCP server is built. Wrap all 54 commands as typed MCP tools.

---

## Part 3: Sprint-by-Sprint Adoption Plan

### Sprint 7 (NOW — Text + Dimensions + Constraints)

**Add nothing to Cargo.toml yet.** Focus on shipping text/dimension rendering in Three.js (TypeScript side) and wiring constraint toolbar. The kernel already has the types.

However, if spline evaluation is needed for dimension tick placement along curved entities, add `kurbo`:

```toml
kurbo = "0.13"  # Only if spline evaluation is needed this sprint
```

### Sprint 8 (Deploy + DXF + Help)

**Consider adding `robust`** if DXF round-trip tests reveal intersection bugs:

```toml
robust = "1.2"  # Exact predicates for degenerate intersection detection
```

This is a tiny crate (zero dependencies) that prevents phantom intersections in trim/extend/fillet operations. One-day integration.

### Sprint 9 (User Test + Ship v0.1)

**Add nothing.** Ship what works. Collect user feedback. The 5 drafter tests will reveal what actually matters.

### Post v0.1 — Phase 1 (Weeks 11-14): Foundation Hardening

**This is the first major crate adoption sprint.** Add:

```toml
[dependencies]
# Constraint solver upgrade (8→20+ types, proper LM solver, DOF counting)
ezpz = "0.2"

# Spatial indexing (O(n)→O(log n) for selection, snap, 10K entity target)
rstar = "0.12"

# 2D curve primitives (spline eval, arc-length, nearest-point, bounding box)
kurbo = "0.13"

# Polyline offset with arc segments (correct wall offset)
cavalier_contours = "0.7"

# 2D polygon booleans (hatching, complex area)
i_overlay = "4.5"

# Exact geometric predicates (if not added in Sprint 8)
robust = "1.2"
```

**Migration work:**
1. Replace `ConstraintSolver` internals with ezpz (keep your Constraint/ConstraintType enums, add new variants)
2. Add `RTree` to Kernel alongside `Vec<Entity>`, update on add/delete/move
3. Expose `query_window()` and `query_nearest()` via wasm-bindgen
4. Replace `offset_polyline()` with cavalier_contours offset
5. Add hatching via i_overlay (clip line pattern against boundary polygon)
6. Use kurbo for spline evaluation and arc-length computation

**Estimated effort:** 2 weeks total.

### Phase 2 (Weeks 15-17): 3D + Parametric

**Major addition — 3D geometry stack:**

```toml
[dependencies]
# B-Rep topology and modeling
truck-topology = "0.6"
truck-modeling = "0.6"
truck-shapeops = "0.4"
truck-meshalgo = "0.4"
truck-stepio = "0.3"

# Mesh booleans (fast preview, STL export)
csgrs = { version = "0.20", features = ["f64"] }

# NURBS curves and surfaces
curvo = "0.1"

# Parametric expressions
evalexpr = "13"

# Dependency graph for feature tree
petgraph = "0.6"

# 3D collision and ray queries
parry3d-f64 = "0.26"

# BVH for ray acceleration
bvh = "0.12"

# Linear algebra (replaces hand-rolled for 3D)
nalgebra = "0.34"

# Mass properties
polyhedral_mass_properties = "0.2"

# Export formats
stl_io = "0.11"
gltf = "1.4"
svg = "0.18"
```

**Architecture decision — dual kernel:**
- **truck** for exact B-Rep (extrude, revolve, booleans, STEP I/O)
- **csgrs** for fast mesh preview (when truck fails or for quick visualization)
- **curvo** for NURBS evaluation (under truck's topology or standalone)
- Feature tree built on **petgraph** (DAG of parametric features with topo-sort recompute)

### Phase 3 (Months 6-8): BIM + Collaboration

```toml
[dependencies]
ifc_rs = "0.1"      # or ifc-lite-wasm via npm
uom = "2.7"          # Units of measurement
ciborium = "0.2"     # CBOR for native file format
```

Plus npm: `yjs` for CRDT collaboration, `web-ifc` for IFC parsing.

### Phase 4 (Months 9-10): GIS

```toml
[dependencies]
las = "0.9"
laz = "0.12"
geojson = "1.0"
shapefile = "0.8"
kml = "0.13"
```

Plus npm: `cesiumjs` for globe rendering, `proj4js` for coordinate transforms.

### Phase 5 (Months 11-13): Civil Engineering

**Custom Rust — no OSS exists for:**
- Horizontal/vertical alignment computation
- Grading/earthwork volume calculation
- Terrain surface (TIN) from point cloud
- Superelevation/cross-section generation

This is NEXUS's unique competitive moat. Build from scratch using `nalgebra`, `spade` (Delaunay for TIN), and `petgraph` (alignment dependency chains).

---

## Part 4: Trade-Off Decisions

### 4.1 truck vs. OCCT vs. Build Custom

| Factor | truck | OCCT (via opencascade.js) | Custom |
|--------|-------|--------------------------|--------|
| WASM | YES (pure Rust) | YES (Emscripten, ~5MB) | YES |
| Fillet/Chamfer | NO | YES | 3-6 months to build |
| Boolean robustness | Transversal only | Production-grade | Depends on implementation |
| STEP I/O | AP203 only | AP203/214/242 | Not feasible custom |
| Bundle size | Small (~200KB) | Large (~5MB) | Depends |
| Maintenance | Solo maintainer | 30 years of industry | Your team |
| License | Apache-2.0 | LGPL-2.1 | Your choice |

**Decision:** Use truck for core B-Rep. Lazy-load opencascade.js for fillet/chamfer/STEP when needed. Build custom only for civil engineering (Phase 5).

### 4.2 ezpz vs. planegcs vs. Custom Solver

| Factor | ezpz | planegcs WASM | Custom (argmin/LM) |
|--------|------|--------------|---------------------|
| Constraint types | ~20 | 37 | Whatever you build |
| Maturity | Young (v0.2) | 15+ years | Depends |
| Language | Pure Rust | C++ → WASM | Pure Rust |
| License | MIT | LGPL-2.1 | Your choice |
| Integration effort | 2-3 days | 2-3 days | 3-6 months |
| WASM | Native | Separate binary | Native |

**Decision:** ezpz for v0.1-v0.2. planegcs WASM as fallback for v0.3 if ezpz is insufficient. Custom solver only for v1.0+ if needed.

### 4.3 hecs vs. bevy_ecs

| Factor | hecs | bevy_ecs |
|--------|------|----------|
| Weight | Minimal (1 crate) | Heavy (pulls Bevy ecosystem) |
| Change detection | Manual | Built-in (`Changed<T>` queries) |
| WASM | YES | YES |
| Community | Moderate | Massive |
| Game framework baggage | None | Some (App, Schedule concepts) |

**Decision:** hecs for NEXUS. It's library-first with no framework baggage. NEXUS is not a game — it doesn't need Bevy's scheduling, rendering, or plugin system.

### 4.4 When to Move Snap from TypeScript to Rust

**Current:** Snap engine is in TypeScript (`SnapEngine.ts`, ~200 lines). Works fine for <1000 entities.

**Move to Rust when:**
- Entity count exceeds 5,000 (O(n) scan becomes visible)
- After rstar is integrated (Phase 1)
- When 3D snap is needed (v0.2)

**How:** Implement snap queries as `rstar` nearest-neighbor + `robust` exact predicates. Expose `snap_nearest(x, y, snap_types, radius) → Option<SnapResult>` via wasm-bindgen.

---

## Part 5: What NOT to Do

1. **Do NOT add nalgebra for 2D.** Your hand-rolled Point2D is correct, trivial, and has zero dependency cost. nalgebra is for 3D (v0.2+).

2. **Do NOT add bevy_ecs before v0.2.** Your Vec<Entity> works fine at current scale. ECS migration is a significant refactor — do it when 3D components (Geometry3D, Material, MeshData) actually exist.

3. **Do NOT replace event sourcing with a crate.** Your 60-line EventStore is correct and simple. No crate improves on Vec + cursor for this use case.

4. **Do NOT pre-integrate 3D crates.** truck, parry3d, curvo, csgrs are for v0.2. Adding them now increases build time and WASM size for zero benefit.

5. **Do NOT build a custom NURBS library.** curvo exists, is actively maintained (84 releases), and covers 90% of what BRL-CAD's libnurbs does. Extend it, don't replace it.

6. **Do NOT build a custom polygon boolean library.** i_overlay is battle-tested (3M downloads), robust (integer arithmetic internally), and WASM-compatible. Use it.

7. **Do NOT build a custom constraint solver from scratch.** ezpz exists, is built by a CAD company, and covers the constraint types you need. Only consider building custom if you need civil engineering constraints that ezpz can't express (Phase 5, months away).

---

## Part 6: Quick Reference — Crate Cheat Sheet

When an agent needs to implement a feature, check here first:

| I need to... | Use this crate | Not this | Why |
|-------------|---------------|----------|-----|
| Offset a polyline | cavalier_contours | hand-rolled bisectors | Arc-aware, handles self-intersection |
| Boolean 2D polygons | i_overlay | geo-booleanop | Faster, more robust, actively maintained |
| Solve 2D constraints | ezpz | hand-rolled | Proper Jacobian solver, DOF counting, 20+ types |
| Evaluate a spline | kurbo (BezPath) or curvo | nothing (current is stub) | Actual curve evaluation with arc-length |
| Find nearest entity | rstar | linear Vec scan | O(log n) vs O(n) |
| Check point orientation | robust | f64 comparison with epsilon | Exact — no false positives |
| Tessellate a polygon | earcutr or spade | — | earcut for simple, spade for constrained Delaunay |
| Compute mass properties | polyhedral_mass_properties | hand-rolled | Proven algorithm, inertia tensor included |
| Evaluate expressions | evalexpr | hand-rolled parser | Variables, functions, operators, ternary |
| Build dependency graph | petgraph | hand-rolled adjacency list | Toposort, cycle detection, DFS/BFS |
| Parse/write DXF | dxf (Rust crate) | dxf-parser (TS) | Type-safe, validation, pure Rust |
| Export STL | stl_io | — | Binary + ASCII, 2.8M downloads |
| Export glTF | gltf | — | Dominant, 6.4M downloads |
| 3D solid modeling | truck-modeling | build from scratch | Extrude, revolve, sweep, booleans |
| Mesh booleans | csgrs | — | BSP trees, WASM, f64, rich I/O |
| NURBS surfaces | curvo | — | Comprehensive, 221K downloads, WASM |
| STEP I/O | truck-stepio | — | AP203, only Rust option |
| MCP server | rmcp | — | Dominant, 7.5M downloads |
| Unit conversion | uom | hand-rolled | Type-safe, 60+ unit types |
| BVH for ray tracing | bvh | build custom | SAH, f64 via nalgebra, WASM |
| 3D ray queries | parry3d-f64 | — | Ball, TriMesh, HalfSpace, ConvexPolyhedron |
| Polynomial roots | roots | nalgebra eigenvalue | Direct quartic/cubic solvers, Newton refinement |

---

## Part 7: Files Produced by This Research

Detailed research lived in a separate study workspace (not published):

| Doc | What's in it |
|-----|-------------|
| `07-ecosystem-research.md` | Initial survey + deep dives on parry3d, fidget, csgrs, curvo, truck, bvh, roots |
| `08-sibling-repos-research.md` | How all 5 repos (NEXUS, rust-brlcad, rust-FreeCAD, combined-rust-cad, belender-cad) relate |
| `09-feature-to-crate-mapping.md` | Every feature from all repos mapped to crates with coverage levels |
| `10-reference-apps-feature-mapping.md` | Features extracted from actual BRL-CAD/FreeCAD/Blender/LibreCAD/OpenSCAD source code |
| `11-nexus-crate-adoption-plan.md` | Priority-ordered adoption plan for NEXUS kernel specifically |

This document (`RUST-CAD-ECOSYSTEM-CONSULTANCY.md`) is the synthesis of all of the above, written for agents working in the NEXUS codebase.
