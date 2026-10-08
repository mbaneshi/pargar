# Architecture Decision: Geometric Robustness Model

> ## Status: PARKED under SD-05 (2026-04-29)
>
> Forward-looking 3D/BIM/GIS execution is paused until AutoCAD 2D parity ships. Sections that apply to current 2D work (tolerance constants, intersection robustness for 2D entities) stay in force. Lifting SD-05 in `DECISIONS.md` reactivates downstream work.

> Priority: 1 of 10 — every other architecture decision depends on this
> Risk if wrong: phantom intersections, trim failures, boolean crashes, user trust collapse
> Audience: All agents and developers working on NEXUS

---

## The Problem

Every CAD operation — intersection, trim, offset, boolean, snap, constraint solving — requires answering geometric questions: "Do these two lines cross?" "Is this point on that curve?" "Are these faces coplanar?" Floating-point arithmetic gives wrong answers to these questions at alarming frequency. The difference between a working CAD app and a crashing one is how it handles this.

NEXUS must survive a precision journey from 2D drafting (millimeter scale, 1e-3) through BIM (building scale, 1e+4) to GIS (earth scale, 1e+7) without rewriting the kernel. The tolerance model chosen now determines whether that's possible.

---

## How the Reference Apps Solve It

### BRL-CAD: Explicit Tolerance Struct, Passed Everywhere

BRL-CAD defines a `bn_tol` struct with four fields:

| Field | Default Value | Meaning |
|-------|--------------|---------|
| `dist` | 5e-4 (0.5mm) | Two points closer than this are identical |
| `dist_sq` | 2.5e-7 | Precomputed dist² for fast squared-distance checks |
| `perp` | 1e-6 | Dot product below this → vectors are perpendicular |
| `para` | 1 - 1e-6 | Dot product above this → vectors are parallel |

This struct is stored on the ray-trace instance (`rti_tol`) and passed to every operation. It flows through:
- Space partitioning (ray start bumped by `dist` to avoid re-intersection)
- Primitive prep (degenerate detection via `dist_sq`)
- NMG vertex fusing (sorted by X, then pairwise `dist_sq` comparison)
- BREP near-miss handling (5-category classification: CLEAN_HIT, NEAR_HIT, NEAR_MISS, CRACK_HIT, CLEAN_MISS)

**Strength:** Tolerance is explicit, configurable, and present at every decision point. No magic numbers.

**Weakness:** Single global tolerance. A model containing both a 0.01mm watch spring and a 100m building uses the same `dist = 5e-4`, which is wrong for one of them.

### FreeCAD/OCCT: Per-Entity Tolerance, Hierarchy Rule

OCCT stores tolerance **per topological entity**:

| Entity | Tolerance Meaning |
|--------|------------------|
| Vertex | Sphere of radius Tol(V) around the point |
| Edge | Cylinder of radius Tol(E) around the curve |
| Face | Slab of thickness Tol(F) around the surface |

**Hierarchy rule:** `Tol(Face) ≤ Tol(Edge) ≤ Tol(Vertex)` — tolerances only grow from face to edge to vertex.

**Global constants (Precision class):**

| Constant | Value | Purpose |
|----------|-------|---------|
| Confusion | 1e-7 | Min distance between distinct points |
| Angular | 1e-12 | Angular equality (radians) |
| Intersection | 1e-9 | Intersection algorithm tolerance |
| Approximation | 1e-6 | Approximation tolerance |

After many boolean operations, vertex tolerances accumulate and grow. Eventually vertices "swell" to overlap adjacent entities, corrupting topology. OCCT's ShapeFix/ShapeUpgrade modules attempt repair.

**Strength:** Per-entity tolerance adapts to local geometry quality. Imported STEP files with varying precision are handled.

**Weakness:** Tolerance accumulation is a time bomb. After 10+ booleans, the model degrades.

### Blender: Exact Arithmetic for Booleans, Epsilon for Everything Else

Blender's exact boolean solver uses multi-precision rational numbers (`mpq3`) — no tolerance needed for intersection decisions. A filter-and-refine approach runs fast-path 32-bit estimation first, falling back to 256-bit exact computation only when the result is ambiguous.

For non-boolean mesh operations, BMesh uses a conventional epsilon approach. The exact solver converts back to double at the output stage, where vertices within epsilon are merged.

**Strength:** Zero false positives in boolean decisions. Best-in-class robustness.

**Weakness:** Exact arithmetic is expensive (2-10x slower). Only used for booleans, not for general mesh editing.

### OpenSCAD/CGAL: Exact Arithmetic Everywhere

CGAL's `Exact_predicates_exact_constructions_kernel` uses lazy exact numbers (`Lazy_exact_nt<Gmpq>`):

1. Every number stores a double approximation + error interval
2. Comparisons check the interval first (fast path)
3. If ambiguous, exact GMP rational is computed and cached (slow path)

**Guarantee:** "If three lines meet in one point, they will do so in CGAL as well."

**Performance:** ~25% overhead for common cases, up to 80%+ for pathological inputs. Can be much worse for arrangement computations.

### OpenSCAD/Manifold: Adaptive Epsilon + Symbolic Perturbation

Manifold computes epsilon from the bounding box scale (adaptive, not fixed). When a vertex is exactly on a plane, symbolic perturbation resolves it deterministically:

- Union: perturb in +normal direction (touching cubes merge)
- Difference: perturb in -normal direction (equal-height subtraction = through-hole)
- Mesh minus itself = empty (guaranteed)

**Strength:** Fast (double-precision), deterministic, handles coplanar faces.

**Weakness:** Not exact — precision tracked, not guaranteed. Rare failures on perfectly coincident faces.

---

## What the Rust Ecosystem Offers

### `robust` (15.5M downloads) — Exact Predicates

Port of Shewchuk's `predicates.c`. Three-stage adaptive refinement:

1. **Fast path:** Hardware double computation + error bound check. If result is clearly positive/negative, return immediately.
2. **Medium path:** Compute exact error terms using Dekker's two-product algorithm. Check tighter error bound.
3. **Slow path:** Full expansion arithmetic (16-component sum). Exact sign.

Provides: `orient2d`, `orient3d`, `incircle`, `insphere`. These are **predicates** (sign only), not **constructions** (no computed intersection points).

### `parry3d-f64` — GJK Tolerance

Uses `eps_tol = 10 * f64::EPSILON` (~2.22e-15) for point comparisons and `eps_rel = sqrt(eps_tol)` (~4.71e-8) for relative convergence. These are tuned for collision detection, not CAD precision.

### `truck` — Fixed Global Tolerance

`TOLERANCE = 1e-6`, `TOLERANCE2 = 1e-12`. Not configurable. `near()` method used everywhere. Simple but inflexible.

### `curvo` — Per-Operation Tolerance

Tolerance passed as parameters to operations (`norm_tolerance`, `convergence_tolerance`). Uses `argmin` (BFGS, Newton) with configurable convergence criteria.

---

## Decision for NEXUS

### The Tolerance Architecture

NEXUS must handle scales from 0.01mm (PCB traces) to 10km (civil alignment). A single global tolerance fails. Per-entity tolerance (OCCT style) adds complexity but survives the expansion path.

**Adopt a three-tier tolerance model:**

**Tier 1 — Exact predicates for geometric decisions (always):**
Use `robust::orient2d` / `robust::orient3d` for all orientation and incircle tests. These are exact — no tolerance needed. Use them for:
- Point-on-line/plane classification
- Polygon winding direction
- Intersection existence checks
- Convex hull construction
- Delaunay triangulation

This eliminates the entire class of "phantom intersection" bugs.

**Tier 2 — Named tolerance constants for geometric operations (kernel-level):**

```rust
pub struct Tolerance {
    /// Two points closer than this are coincident
    pub point_coincidence: f64,    // default: 1e-7 (OCCT Confusion)
    
    /// Dot product below this means perpendicular
    pub perpendicular: f64,        // default: 1e-10
    
    /// Dot product above this means parallel  
    pub parallel: f64,             // default: 1 - 1e-10
    
    /// Intersection parameter tolerance
    pub intersection: f64,         // default: 1e-9
    
    /// Convergence threshold for iterative solvers
    pub solver_convergence: f64,   // default: 1e-8
    
    /// Distance below which a segment is degenerate
    pub zero_length: f64,          // default: 1e-10
}
```

Store this on the Kernel. Pass to every geometric operation. Allow override per-operation when needed (e.g., fuzzy boolean with relaxed tolerance).

**Do NOT use NEXUS's current inline constants** (`POINT_COINCIDENCE = 1e-8`, `ZERO_LENGTH = 1e-10`, etc.). They're the right idea but should live in a `Tolerance` struct, not as module-level constants, so they can be adjusted for different domains.

**Tier 3 — Per-entity tolerance for imported/computed geometry (v0.2+):**

When B-Rep is added, each vertex/edge/face carries its own tolerance (like OCCT). This handles STEP import where different regions have different precision. The hierarchy rule (`face ≤ edge ≤ vertex`) must be enforced.

### What Changes in the Kernel

**Sprint 7-9 (v0.1):**
1. Add `robust` crate to Cargo.toml
2. Replace `PARALLEL_DENOMINATOR = 1e-12` guard in `line_line_intersect()` with `robust::orient2d()` for collinearity detection
3. Move tolerance constants from `tolerance.rs` module-level to a `Tolerance` struct on `Kernel`
4. Keep using fixed tolerance (appropriate for 2D CAD scale)

**Phase 1 (post v0.1):**
5. Pass `&Tolerance` to all geometric operations instead of using module constants
6. Add `robust::orient2d` to snap engine (moved to Rust) for exact intersection snap

**v0.2 (3D):**
7. Add per-entity tolerance when B-Rep is added (OCCT-style hierarchy)
8. Add `robust::orient3d` for 3D plane/face orientation tests

### What NOT to Do

1. **Do NOT use CGAL-style exact arithmetic everywhere.** The performance cost is too high for interactive CAD. Use exact predicates (fast, Shewchuk) + approximate constructions (fast, double) + per-entity tolerance (handles precision loss).

2. **Do NOT use a single tolerance constant forever.** The `truck` approach (`TOLERANCE = 1e-6` everywhere) fails when you import STEP files with 1e-4 precision or work at GIS scale.

3. **Do NOT rely on epsilon comparisons for geometric decisions.** `if (abs(dot) < 1e-12)` is wrong for any input scale. Use `robust::orient2d` — it's exact and nearly as fast.

4. **Do NOT ignore tolerance in the constraint solver.** When `ezpz` replaces the hand-rolled solver, verify that its internal tolerance aligns with the kernel's `Tolerance.solver_convergence`. Mismatched tolerances between constraint solving and geometry creation cause "solved but doesn't look right" bugs.

### Failure Modes This Prevents

| Failure | Cause | How This Model Prevents It |
|---------|-------|---------------------------|
| Phantom intersections | f64 comparison returns wrong sign | Exact predicates via `robust` — no false positives |
| Trim at wrong point | Intersection computed with accumulated error | Named tolerance + exact predicate guard |
| Boolean crash on coplanar faces | Intersection solver can't determine surface relationship | Exact orient3d for face classification (v0.2) |
| Snap to invisible point | Near-parallel lines produce intersection at infinity | `robust::orient2d` detects collinearity exactly |
| Constraint solver oscillation | Tolerance mismatch between solver and geometry | Shared `Tolerance` struct with consistent values |
| STEP import produces gaps | Source system had different precision | Per-entity tolerance absorbs precision difference (v0.2) |
| GIS-scale coordinate loss | f64 has ~15 digits; 10km + 0.001mm loses the mm | Domain-specific local coordinate systems (v0.4) |
