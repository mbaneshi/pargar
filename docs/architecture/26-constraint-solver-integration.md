# Architecture Decision: Constraint Solver Integration

> ## Status: PARKED under SD-05 (2026-04-29)
>
> ezpz is already shipped as the 2D solver and stays in force. The planegcs WASM fallback and the v0.3+ migration plan are paused until AutoCAD 2D parity ships. Lifting SD-05 in `DECISIONS.md` reactivates this work.

> Priority: 7 of 10 — blocks parametric sketching
> Risk if wrong: unsolvable sketches, no DOF feedback, users blame the tool
> Audience: All agents and developers working on NEXUS

---

## Current State

NEXUS has a hand-rolled constraint solver (606 lines, `constraints.rs`):
- 8 types: Fixed, Coincident, Horizontal, Vertical, Distance, Parallel, Perpendicular, EqualLength
- Algorithm: Iterative averaging (50 iterations, 1e-6 convergence)
- No DOF counting, no overconstrained detection, no tangent/angle/concentric

This works for the v0.1 floor plan use case (walls perpendicular, fixed distances). It does NOT work for parametric sketching (tangent arcs, equal radii, angular dimensions).

---

## Three Paths (Decision Framework)

### Path A: ezpz (RECOMMENDED for v0.1 post-ship → v0.2)

**What it is:** Pure Rust 2D geometric constraint solver by Zoo/KittyCAD. MIT license. WASM-compatible.

> **Updated 2026-04-18:** Source code studied in depth. Previous description had inaccuracies. Corrected below.

**Constraint types (24 — not ~20 as previously estimated):**

| Constraint | Description |
|---|---|
| `Distance`, `DistanceVar` | Point-to-point (fixed or variable) |
| `VerticalDistance`, `HorizontalDistance` | Axis-aligned point distances |
| `Vertical`, `Horizontal` | Line orientation |
| `LinesAtAngle(l0, l1, AngleKind)` | Angle between lines (Parallel/Perpendicular/Other) |
| `Fixed(id, val)` | Pin scalar variable |
| `ScalarEqual(id0, id1)` | Two variables equal |
| `PointsCoincident` | Points at same location |
| `CircleRadius`, `ArcRadius` | Fix radius |
| `LinesEqualLength` | Equal length lines |
| `Arc` | Enforce arc geometry (start/end equidistant from center) |
| `Midpoint` | Point at line midpoint |
| `PointLineDistance` | Perpendicular point-to-line distance |
| `VerticalPointLineDistance`, `HorizontalPointLineDistance` | Axis-aligned point-to-line |
| `Symmetric` | Points symmetric across line |
| `PointArcCoincident` | Point on arc |
| `ArcLength`, `ArcAngle` | Arc length / sweep angle |
| `LineTangentToCircle` | Line tangent to circle |
| `CircleTangentToCircle` | Circle-to-circle tangency |

**Correction:** Previous description claimed "Tangent (line-to-arc, arc-to-arc)" — ezpz actually only has **line-to-circle** and **circle-to-circle** tangency. No line-to-arc or arc-to-arc tangent. Also: **no PointOnLine**, **no Concentric** (must compose via `PointsCoincident` on centers), **no ellipse/spline support**.

**Solver algorithm:** Damped Gauss-Newton with Tikhonov regularization (lambda=1e-9). Sparse LU via `faer` crate. NOT Levenberg-Marquardt as previously stated — single solver strategy only.

**DOF feedback:** Yes — SVD-based `FreedomAnalysis` via `solve_analysis()`. Detects underconstrained variables. Note: SVD converts to dense matrix, so O(n³) — potentially slow for 2000+ variable systems.

**Unique feature (not in planegcs):** Priority-based constraint solving — constraints grouped by priority level, solved incrementally. Lower-priority failures return last successful result. Useful for graceful degradation.

**Geometry primitives:** DatumPoint (2 vars), DatumLineSegment (4 vars), DatumCircle (3 vars), DatumCircularArc (6 vars, always CCW), DatumDistance (1 var). **No ellipse, no spline, no infinite line.**

**WASM status:** `ezpz-wasm/` crate exists but is a test harness only (3 functions: `hello()`, `test_faer()`, `benchmark()`). Core crate compiles to WASM but needs custom wasm-bindgen wrapper for production use. No serde serialization layer.

**Risks:**
- Young project (v0.2.22, 24 stars)
- Zoo is VC-funded — if they pivot/close, ezpz becomes unmaintained
- API may change between versions (`non_exhaustive` on all public enums)
- **Missing constraints that block AutoCAD parity:** no ellipse, no spline, no point-on-line, no line-to-arc tangent
- Single solver algorithm — planegcs offers 4 (BFGS, DogLeg, LM, SQP)

**Mitigations:**
- MIT license — fork is legally trivial
- Pin version in Cargo.toml
- Wrap with your own `ConstraintSolver` trait so the implementation is swappable
- Test against your existing 37 Rust constraint tests

**Migration path:**

```rust
// Keep your existing API:
pub trait NexusConstraintSolver {
    fn add_constraint(&mut self, constraint: Constraint) -> String;
    fn remove_constraint(&mut self, id: &str);
    fn solve(&mut self, entities: &mut [Entity]) -> SolveResult;
    fn dof_count(&self) -> usize;  // NEW
    fn is_overconstrained(&self) -> bool;  // NEW
}

// Implement with ezpz internally:
impl NexusConstraintSolver for EzpzSolver {
    fn solve(&mut self, entities: &mut [Entity]) -> SolveResult {
        // 1. Convert NEXUS entities → ezpz points/lines/circles
        // 2. Convert NEXUS constraints → ezpz constraints  
        // 3. Call ezpz::solve()
        // 4. Write solved positions back to NEXUS entities
        // 5. Return DOF info
    }
}
```

**Effort:** 3-5 days (not 2-3 — the CAD agent was right that impedance mismatches will surface).

### Path B: planegcs WASM (CURRENT — keep for v0.1, re-evaluate post-ship)

> **Updated 2026-04-18:** After source-level study of ezpz, planegcs is now the stronger choice for v0.1 due to ezpz's constraint gaps. Reassess when ezpz adds ellipse/spline/point-on-line.

**What it is:** FreeCAD's proven constraint solver compiled to WASM. npm package `@salusoft89/planegcs`.

**Constraint types (~40+):** Point, Line, Circle, Arc, **Ellipse, B-spline, Parabola, Hyperbola**. Includes: point-on-line, point-on-circle, point-on-ellipse, all tangency combinations (line-arc, arc-arc, ellipse-line), SnellsLaw, InternalAlignment (11 subtypes), B-spline weight.

**Solver algorithms:** DogLeg, Levenberg-Marquardt, BFGS, **SQP** — four strategies for different constraint topologies. ezpz has only one (Gauss-Newton).

**Advantages over ezpz (confirmed from source study):**
- 40+ vs 24 constraint types
- Ellipse, spline, point-on-line support (ezpz has none)
- All tangency combinations (ezpz only line-circle and circle-circle)
- 4 solver algorithms vs 1
- Production WASM bindings (used in FreeCAD web, multiple projects)
- Decades of battle-testing via FreeCAD ecosystem

**Disadvantages vs ezpz:**
- LGPL-2.1 license (vs MIT) — problematic if going commercial
- C++ via Emscripten (vs native Rust) — separate WASM binary, can't share types with kernel
- No priority-based constraint solving
- Weaker DOF analysis (basic vs ezpz's SVD-based)
- Separate WASM binary (~500KB) adds to bundle

**When to switch to ezpz:** When ezpz reaches ~35+ constraints with ellipse, spline, point-on-line, and multiple solver strategies. Monitor the repo: `github.com/KittyCAD/ezpz`.

**Integration:** Lazy-load the npm package on first use. Call via JS interop from the Rust kernel.

### Path C: Custom solver on argmin/levenberg-marquardt (v1.0+ only)

**What it is:** Build a bespoke constraint solver using `levenberg-marquardt` (606K downloads) or `argmin` (3M downloads) as the optimization backend.

**When:** Only if both ezpz and planegcs prove insufficient for civil engineering constraints (alignment geometry, superelevation curves) that are unique to NEXUS's expansion path.

**Effort:** 3-6 months for a 37-type solver with DOF counting and redundancy detection.

---

## Critical Design Requirements

### 1. Solver-Geometry Tolerance Coupling

The constraint solver and the geometry kernel MUST use compatible tolerances.

```
If solver convergence = 1e-8 but geometry coincidence = 1e-6:
  → Solver says "converged" but geometry says "not coincident"
  → User sees constraint "satisfied" but points aren't snapped

If solver convergence = 1e-6 but geometry coincidence = 1e-8:
  → Solver says "not converged" but points look identical on screen
  → Solver runs max iterations and reports failure for a valid sketch
```

**Rule:** Solver convergence tolerance must be at LEAST one order of magnitude tighter than geometry coincidence tolerance. If `Tolerance.point_coincidence = 1e-7` (from architecture/20), then `solver_convergence ≤ 1e-8`.

### 2. DOF Feedback (User-Facing)

Users MUST know the constraint state of their sketch:

| State | UI Feedback |
|-------|-------------|
| Under-constrained (DOF > 0) | Green entities that can still move. Show DOF count. |
| Fully constrained (DOF = 0) | All entities turn solid color. "Fully constrained" status. |
| Over-constrained (redundant) | Red highlight on conflicting constraints. "Over-constrained" warning. |
| Conflicting (no solution) | Red highlight + error message. "Constraints conflict — remove one." |

Without DOF feedback, users create over-constrained sketches and blame the tool.

### 3. Constraint Visualization

Draw constraint indicators on the canvas:

| Constraint | Visual |
|-----------|--------|
| Horizontal | Small "H" icon near constrained line |
| Vertical | Small "V" icon |
| Coincident | Dot at coincident point |
| Parallel | "∥" between parallel lines |
| Perpendicular | "⊥" at perpendicular intersection |
| Tangent | "T" at tangent point |
| Distance | Dimension line with value |
| Angle | Arc with degree value |
| Equal | "=" between equal entities |
| Fixed | Anchor icon at fixed point |

### 4. Constraint-Command Integration

Every constraint operation MUST follow Rule 1 (Command) and Rule 2 (Event):

```rust
// Adding a constraint:
Command::AddConstraintTangent { entity_a: "arc_1", entity_b: "line_3" }
  → Event: ConstraintAdded { constraint: Tangent { ... } }
  → Solver runs immediately
  → If solver fails: Command returns error, constraint is NOT added

// Removing:
Command::RemoveConstraint { id: "constraint_5" }
  → Event: ConstraintRemoved { id: "constraint_5" }
  → Solver runs to update positions
```

### What NOT to Do

1. **Do NOT keep the hand-rolled solver beyond v0.1 ship.** It lacks DOF counting, proper convergence, and tangent support. It's a liability for parametric sketching.

2. **Do NOT integrate both ezpz and planegcs simultaneously.** Pick one. If it doesn't work, switch. Running two solvers doubles complexity for zero benefit.

3. **Do NOT ignore solver failure in the UI.** If the solver can't find a solution, the user MUST be told which constraints conflict. Silent failure = user thinks the tool is broken.

4. **Do NOT couple constraint IDs to entity ordinal indices.** Constraints reference entities by Entity handle, not by index. When entities are reordered, constraints survive.
