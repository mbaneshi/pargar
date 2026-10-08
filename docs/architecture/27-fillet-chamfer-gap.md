# Architecture Decision: The Fillet/Chamfer/Shell Gap

> ## Status: PARKED under SD-05 (2026-04-29)
>
> 3D fillet/chamfer/shell strategy is paused until AutoCAD 2D parity ships. Existing 2D fillet/chamfer behavior stays in force. Lifting SD-05 in `DECISIONS.md` reactivates this work.

> Priority: 8 of 10 — #1 credibility blocker for 3D mechanical CAD
> Risk if wrong: "Can it fillet?" is the first question every mechanical engineer asks. No = toy.
> Audience: All agents and developers working on NEXUS

---

## The Gap

Fillet (round an edge), chamfer (bevel an edge), and shell (hollow a solid) are the 2nd-3rd most used operations in mechanical CAD (20-30% of all features). **No pure-Rust, WASM-compatible crate implements them.**

Only OCCT has production-quality fillet/chamfer/shell. OCCT doesn't compile to WASM natively — only via Emscripten (opencascade.js, ~7-10MB).

This is the single biggest capability gap in the Rust CAD ecosystem.

---

## What Fillet Actually Requires (Algorithmically)

A fillet replaces a sharp B-Rep edge with a smooth, tangent-continuous surface. The "rolling ball" method:

1. **Edge chain detection:** Identify connected edges to fillet. Handle branching and closed loops.
2. **Spine computation:** The original edge becomes the "spine" curve.
3. **Rolling ball / pipe surface:** Roll a sphere of radius R along the spine, tangent to both adjacent faces. The fillet surface = envelope of the sphere's equator.
4. **Face trimming:** Adjacent faces are trimmed where the fillet surface meets them. Requires surface-surface intersection.
5. **Face extension:** If faces are too short for radius R, extrapolate their underlying surface. Trivial for planes/cylinders, problematic for NURBS.
6. **Vertex transitions:** Where 3+ fillets meet at a vertex, a "cap" blend surface fills the gap. Constrained optimization problem.
7. **Topology update:** Rebuild B-Rep with new fillet faces, trimmed faces, updated adjacency.

**OCCT's fillet code: ~30,000-50,000 lines of C++, refined over 25+ years.**

### Why It's So Hard

| Sub-problem | Difficulty | Why |
|-------------|-----------|-----|
| Edge chain detection | Moderate | Topology traversal, handle branches |
| Rolling ball on planar-planar | Easy | Cylinder segment, trivial |
| Rolling ball on planar-cylindrical | Medium | Dupin cyclide or general NURBS |
| Rolling ball on freeform-freeform | Very hard | Nonlinear system at each spine point. Offset surface computation (offset of NURBS is not NURBS). |
| Face extension for NURBS | Hard | Extrapolation beyond parameter domain is ill-conditioned |
| Vertex transitions (3-way corners) | Very hard | OCCT has ~3000 lines dedicated to this alone |
| Variable radius | Hard | Canal surface, spine reparametrization |
| Self-intersection detection | Very hard | Fillet surface can self-intersect with large radius |
| Topology consistency | Hard | Must produce valid closed shell with matching trim curves |

---

## Options for NEXUS

### Option 1: opencascade.js (RECOMMENDED for v0.2)

Load OCCT compiled to WASM for fillet/chamfer/shell operations.

| Factor | Value |
|--------|-------|
| Binary size | ~7-10MB gzipped (lazy-loaded, cached in Service Worker) |
| License | LGPL-2.1 (fine for open-source) |
| Capability | Full: constant/variable radius fillet, chamfer, shell, draft, thickness |
| Integration | JS function calls to OCCT via Emscripten bindings |
| Performance | Slower than native (~2-3x) but fast enough for interactive use on simple parts |

**The lazy-loading protocol:**

```typescript
// First fillet/chamfer/shell operation triggers OCCT load
let occtInstance: OpenCascadeInstance | null = null;

async function requireOCCT(): Promise<OpenCascadeInstance> {
    if (!occtInstance) {
        // Show loading indicator: "Loading advanced geometry engine (one-time, ~8MB)..."
        const module = await import('opencascade.js');
        occtInstance = await module.default();
        // Cache via Service Worker — subsequent visits load from cache (~100ms)
    }
    return occtInstance;
}
```

**Data flow:**

```
Rust kernel (truck B-Rep) 
    → serialize to STEP string (truck-stepio) 
    → pass to opencascade.js 
    → OCCT performs fillet 
    → return STEP string 
    → parse back into truck B-Rep (truck-stepio)
    → update entity
```

This is slow (two STEP serializations) but correct. Optimize later with direct shape transfer if needed.

### Option 2: Simplified Rust Fillet (v0.2 proof-of-concept)

Implement planar-planar constant-radius fillet in ~1000-2000 lines of Rust:

1. Input: B-Rep edge between two planar faces, radius R
2. Compute dihedral angle between planes
3. Create cylindrical fillet surface (degree-2 rational B-spline — exact cylinder representation)
4. Trim adjacent faces at fillet boundary
5. Update topology

**Covers:** ~30-40% of real-world fillet cases (boxes, extrusions, prismatic parts with flat faces). Planar-cylindrical would add another 20-30%.

**Does NOT cover:** Freeform surfaces, variable radius, vertex transitions, edge chains across surface type boundaries.

**Value:** Proves the architecture works. Shows users that fillet is coming. Buys time before full OCCT integration.

### Option 3: Server-Side OCCT (v0.3+ optional)

For users who need complex fillets on large models, run native OCCT on a server:

```
Browser (WASM) → upload B-Rep via API → Server (native OCCT) → fillet → return B-Rep → Browser
```

Latency: 1-5 seconds per operation (upload + compute + download). Acceptable for complex operations, not for interactive preview.

**This is the Onshape model.** They run their kernel (Parasolid) server-side.

---

## Decision

**v0.2: Option 2 (simplified Rust fillet) + Option 1 (opencascade.js fallback).**

1. Implement planar-planar fillet in Rust for simple cases (fast, no external dependency)
2. Fall back to opencascade.js for complex cases (loaded on demand, cached)
3. UI communicates clearly: "Simple fillet" vs "Advanced fillet (loading geometry engine...)"

**v0.3+: Gradually expand the Rust fillet to cover more cases. Reduce opencascade.js dependency over time.**

**The `FilletFallback` component** (analogous to `BooleanFallback` from architecture/21):

```rust
pub struct FilletResult {
    pub method: FilletMethod,  // Native, OCCT, Failed
    pub edges_filleted: Vec<TopoRef>,
    pub radius: f64,
}

pub enum FilletMethod {
    NativeRust,     // Planar-planar, fast
    OpenCascadeJS,  // Complex, loaded on demand
    Failed(String), // Error message
}
```

### The Credibility Question — Honest Assessment

| Audience | Fillet needed? | v0.2 without fillet? |
|----------|---------------|---------------------|
| Architectural / conceptual design | Rarely | YES — viable |
| 3D printing hobbyists | Sometimes (strength, fit) | PARTIALLY — basic shapes work |
| Mechanical engineering | Always (2nd most used op) | NO — not taken seriously |
| Product design (consumer goods) | Always (aesthetics) | NO — not taken seriously |
| Education / learning CAD | Not initially | YES — teach fundamentals first |

**NEXUS v0.2 target audience should be architectural/conceptual/education/hobbyist.** Don't claim mechanical engineering readiness until fillet/chamfer are robust.
