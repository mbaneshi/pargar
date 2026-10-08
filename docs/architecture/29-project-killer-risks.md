# Architecture Decision: Project-Killer Risks

> ## Status: PARKED under SD-05 (2026-04-29)
>
> The four risks remain real but their mitigation plans are 3D/BIM-flavored. Strategic awareness stays in force; mitigation execution is paused until AutoCAD 2D parity ships. Lifting SD-05 in `DECISIONS.md` reactivates this work.

> Priority: 10 of 10 — existential threats need mitigation plans, not code
> Risk if wrong: the project dies regardless of code quality
> Audience: Founders, leads, and all agents working on NEXUS

---

## Risk Ranking (Honest Assessment)

| # | Risk | Severity | Likelihood | Overall | Mitigable? |
|---|------|----------|-----------|---------|-----------|
| 1 | The "Last 20%" Problem | Extreme | Near-certain | **CRITICAL** | Partially — scope discipline |
| 2 | truck Bus Factor | High | Medium-high | **HIGH** | Yes — fork strategy + alternative kernel path |
| 3 | Competition (Onshape, Fusion 360) | High | Medium-high | **HIGH** | Yes — don't compete head-on, find niche |
| 4 | Team / Sustainability | High | High | **HIGH** | Partially — funding, community |
| 5 | WASM Memory Ceiling | Medium-high | Medium | **MEDIUM-HIGH** | Yes — LOD, out-of-core, server-assist |
| 6 | Constraint Solver Maturity | Medium-high | Medium | **MEDIUM-HIGH** | Yes — ezpz fork + planegcs fallback |
| 7 | Performance at Scale | Medium | Medium | **MEDIUM** | Yes — Web Worker, instancing, LOD |
| 8 | OCCT License (if going commercial) | Context-dependent | Low-medium | **LOW-MEDIUM** | Yes — stay open-source or negotiate |
| 9 | WebGPU Adoption | Low | Low | **LOW** | Solved — Three.js auto-fallback to WebGL |

---

## Risk 1: The "Last 20%" Problem (CRITICAL)

**The reality:** The first 80% of features (basic sketching, extrude, simple booleans on clean geometry) produces a demo. The last 20% (robustness, edge cases, interop, advanced features) takes 80% of the total effort.

**Specific nightmares and real timelines from reference apps:**

| Feature | Looks like | Actually takes | Why |
|---------|-----------|---------------|-----|
| NURBS trimming | "Just clip the surface" | 2-5 person-years | Intersection of NURBS surfaces can't be exactly represented as NURBS. Must approximate + track history. |
| B-Rep booleans (robust) | "Union two shapes" | Decades of refinement | Coplanar faces, tangent edges, thin features. OCCT has 25+ years and still has failure modes. |
| Assembly solver | "Position parts from constraints" | Multiple rewrites | FreeCAD went through Assembly2, Assembly3, Assembly4, A2plus, then built-in Assembly. Each took years. |
| STEP AP242 | "Read a file format" | Person-decades | ISO 10303 spec is thousands of pages. AP242 adds GD&T, PMI, tessellated geometry. |
| Topological naming (TNP) | "Track which face is which" | A decade | FreeCAD's TNP fix took one developer years to build, then years more to merge. Shipped in FreeCAD 1.0 (2024). |

**Ondsel case study:** VC-funded company (2022-2024) building commercial services on FreeCAD. 20 years of existing development as a foundation. Still couldn't find product-market fit. Shut down after ~2 years, 145 PRs merged, then gone.

**Mitigation:**

1. **Define "done" for each phase ruthlessly.** v0.1 = floor plan in 5 minutes, DXF round-trip. NOT "full 2D CAD." Ship the minimum that proves the architecture.

2. **Never say "general-purpose CAD."** Pick a niche audience for each release. v0.1: architectural drafters. v0.2: 3D printing hobbyists. v0.3: educational. Let the tool grow into general-purpose over years, not months.

3. **Accept that some features will be "good enough" forever.** Not every fillet case needs to work. Not every STEP file needs to import perfectly. Define acceptable failure rates and publish them.

4. **Resist scope creep from AI excitement.** "AI agent draws a building" is a demo. Making it work reliably across edge cases is a different project.

---

## Risk 2: truck Bus Factor (HIGH)

**The situation:**
- truck (ricosjp/truck) is NEXUS's planned B-Rep kernel for 3D
- One primary maintainer: Yoshinori Tanimura (ytanimura), 2,488 of ~2,500 commits
- Corporate sponsor: RICOS Co., Ltd (Japanese scientific computing)
- 1,429 stars, Apache-2.0 license
- If ytanimura stops or RICOS pivots, the project effectively halts
- A fork ("monstertruck" by virtualritz) already exists — suggesting upstream is narrow in acceptance

**Alternative Rust B-Rep kernels:**
- **Fornjot:** 2,488 stars, but developer explicitly says mainline code hasn't been developed in over a year in favor of "experiments." Not production-ready.
- **That's it.** There are no other Rust B-Rep kernels.

**Mitigation:**

1. **Wrap truck behind a `GeometryKernel` trait** (already planned — see rust-FreeCAD docs). If truck stalls, swap to another implementation without rewriting the application.

2. **Invest in truck.** If NEXUS depends on truck, contribute fixes and features upstream. Become the second maintainer. This is cheaper than maintaining a fork.

3. **Maintain a fork readiness plan.** Apache-2.0 makes forking trivial legally. The question is expertise — budget time for a team member to deeply understand truck's codebase.

4. **Don't put all eggs in truck.** The dual-kernel strategy (truck + Manifold/opencascade.js) provides a fallback path. If truck booleans fail, Manifold handles it. If truck's topology is insufficient, opencascade.js covers the gap.

5. **Monitor truck's health.** Check monthly: last commit date, open issue response time, PR acceptance rate. If these decline, accelerate fork planning.

---

## Risk 3: Competition (HIGH)

**The competitive reality:**

| Competitor | Strengths | NEXUS advantage? |
|-----------|----------|------------------|
| **Onshape** (PTC) | Already browser-native CAD. 200+ engineers. $470M acquisition. | Open-source, no subscription, AI-native |
| **Fusion 360** (Autodesk) | Integrated CAD+CAM+CAE. $680/year. Massive ecosystem. | Browser-native (Fusion is desktop-first) |
| **AutoCAD Web** | Brand recognition. Enterprise relationships. | More capable (parametric, 3D, AI) |
| **SolidWorks Web** (3DEXPERIENCE) | Enterprise CAD leader. Dassault resources. | Lighter, faster, open |
| **CADmium** | Pure Rust + truck + WASM. Open source. | More mature (NEXUS has working 2D) |

**The honest moat assessment:**
- "Open source" — weak moat. Ondsel proved open-source CAD has trouble monetizing.
- "Browser-native" — Onshape already is. Not differentiating.
- "AI-powered" — everyone is adding this.
- "Rust/WASM" — users don't care about tech stack.
- "All-in-one (2D + 3D + BIM + GIS + Civil)" — potentially strong, but years away from reality.

**Mitigation:**

1. **Don't compete head-on with Onshape.** You cannot out-engineer 200+ people. Find niches where incumbents are over-priced and under-serving:
   - **Education:** Free, open-source CAD for students
   - **Embedded CAD widget:** API-first CAD as a component for web apps (PLM dashboards, product configurators)
   - **Specific verticals:** Architecture (2D drafting + BIM), civil engineering (no good browser tools)
   - **Developing markets:** Free tool for engineers in cost-sensitive regions

2. **Ship fast, iterate based on real users.** Onshape took 3 years before public launch. NEXUS should ship v0.1 in weeks, get feedback, iterate. Speed is the startup advantage.

3. **Make NEXUS embeddable.** If NEXUS can be embedded in other web apps as a component (via iframe or Web Component), that's a distribution channel incumbents can't match.

---

## Risk 4: Team / Sustainability (HIGH)

**The numbers:**
- Minimal viable CAD (basic sketch, extrude, simple booleans): 3-5 person-years
- Competitive CAD platform: 20-50+ person-years
- Open-source CAD projects that stalled: Ondsel (2 years, VC-funded, failed), Fornjot (years, solo, stalled), SolveSpace (excellent but solo, stayed small)

**Minimum viable team:**
- 1 person: Can build a demo. Cannot sustain a product.
- 2-3 full-time: Can maintain momentum on a focused scope. Fragile.
- 5+ full-time: Minimum for a credible product. Requires funding.

**Common death patterns:**
1. Solo developer burnout
2. Failure to monetize (Ondsel)
3. Scope creep (trying to compete with SolidWorks)
4. Technical debt from early architecture decisions (FreeCAD TNP took a decade)

**Mitigation:**

1. **Architecture for sustainability.** The 7 rules (Command, Event Sourcing, ECS, Additive) are designed to make the codebase contributor-friendly. New contributors can add features without understanding the whole system.

2. **Open-source contributor pipeline.** Good first issues, clear docs, responsive PR reviews. Fornjot lost contributors because PRs went unreviewed.

3. **Revenue path (even small).** GitHub Sponsors, consulting, premium features, hosted version. $0 revenue = hobby project = eventual abandonment.

4. **Manage scope ruthlessly.** Every sprint has a fixed scope. If it's not in the sprint, it doesn't ship. Period. This is the #1 defense against burnout.

---

## Risk 5: WASM Memory Ceiling (MEDIUM-HIGH)

**The hard limits:**
- wasm32: 4GB max. Mobile Safari: ~1.5GB before OS kills page.
- A 50-part assembly with 500 B-Rep faces each: ~7.5GB — exceeds wasm32.

**When you hit the wall:** Complex mechanical assemblies, large point clouds (>10M points), BIM models with 1000+ elements all loaded simultaneously.

**Mitigation:**

1. **LOD (Level of Detail):** Only full B-Rep for visible/selected parts. Bounding boxes for distant parts.
2. **Out-of-core loading:** Stream geometry from IndexedDB. Evict unused parts (LRU). Keep only display mesh for inactive parts.
3. **Server-assisted mode:** Heavy operations on server (Onshape model). Optional, not required.
4. **Memory budget monitoring:** Track WASM memory usage, warn user at 80% of limit, prevent operations that would exceed limit.
5. **wasm64:** Monitor browser adoption. When available, lift the 4GB ceiling.

---

## Risk 6: Constraint Solver Maturity (MEDIUM-HIGH)

**The dependency:** ezpz (24 stars, MIT, Zoo/KittyCAD). If Zoo folds, ezpz becomes unmaintained. planegcs WASM (34 npm downloads/week, 2 maintainers). Both are fragile.

**How long to build a constraint solver from scratch:** FreeCAD's planegcs took 5-7 years to reach "mostly works." Building equivalent from scratch: 3-6 person-months for 37 types with DOF counting.

**Mitigation:**

1. **Wrap behind `NexusConstraintSolver` trait.** Swap implementations without rewriting callers.
2. **ezpz is MIT.** Fork if needed. The codebase is pure Rust, readable, maintainable.
3. **planegcs WASM as fallback.** Different implementation, different failure modes.
4. **Long-term: build custom on `levenberg-marquardt` crate.** Only if both alternatives fail AND you need civil engineering constraints.

---

## Risk 7: Performance at Scale (MEDIUM)

**The bottleneck order:**
1. CPU-side boolean/geometry computation (single-threaded WASM — the real wall)
2. Tessellation (converting B-Rep to triangles for display)
3. Draw call overhead (if many separate mesh objects)
4. GPU fill rate (only at very high triangle counts)

**Mitigation:**

1. **Web Worker for computation.** Move kernel off main thread.
2. **BatchedMesh / instancing** for repeated geometry.
3. **LOD** for distant objects.
4. **Debounce rebuild** during parametric drag (rebuild after mouse-up, not on every mouse-move).
5. **Progressive tessellation:** Show coarse mesh immediately, refine in background.

---

## Summary: What Kills This Project

It's not the technical risks. WebGPU works, WASM works, Three.js works, Rust works. The browser platform is ready.

**What kills it:**
1. **Trying to be everything.** The expansion path (2D → 3D → BIM → GIS → Civil → Digital Twin) is right as a vision, wrong as a 1-year plan. Each domain is a product.
2. **Underestimating CAD engineering.** The "last 20%" of robustness, edge cases, and format fidelity is where projects die. BRL-CAD has 40 years. FreeCAD has 20. This is not a weekend project.
3. **No users.** Ship v0.1 to real drafters (Sprint 9). If they can't draw a floor plan in 5 minutes, nothing else matters.
4. **Solo dependency.** On truck, on ezpz, on planegcs, on a single developer. Diversify dependencies and build contributor community.

**What saves it:**
1. **The 7 rules.** They're designed for sustainability — new contributors can add features without understanding everything. The architecture is designed to survive maintainer turnover.
2. **Focused niche.** Don't be "open-source SolidWorks." Be "free browser CAD for architects" or "embeddable CAD widget for web apps."
3. **Ship early, iterate.** v0.1 is 3 sprints away. Ship it. Learn from users. Adjust.
4. **The Rust ecosystem is growing.** ezpz didn't exist 2 years ago. curvo has had 84 releases. The ecosystem is accelerating. What's missing today may exist next year.
