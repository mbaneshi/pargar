# NEXUS — OSS Exploration Priority Matrix

> Prioritizes which of the 210+ cataloged projects to explore first, scored against NEXUS's vision (unified browser-native AEC platform), mission (human-AI-robot co-engineering), and constraints (7 non-negotiable architectural rules).
>
> Created: 2026-04-12

---

## Scoring Criteria

Each project is scored 1-5 on four dimensions:

| Dimension | What it measures | Weight |
|-----------|-----------------|--------|
| **Vision Alignment** | Does it advance the unified AEC platform thesis? Does it cover a domain gap (Civil, BIM, GIS, Survey, RS, Construction)? | 30% |
| **Mission Criticality** | Does it enable human-AI-robot co-engineering? Does it fit Rules 1-6 (command system, event sourcing, ECS, MCP)? | 25% |
| **Unique Value** | Does integrating this create something no competitor has? Is NEXUS the first to unify this with the rest? | 25% |
| **Time-to-Impact** | Can we use it now/soon? Is it mature? Does it unblock current sprint work? | 20% |

**Priority Score** = (Vision × 0.30) + (Mission × 0.25) + (Unique × 0.25) + (Time × 0.20)

---

## Priority Tier 1 — Explore Immediately (Score ≥ 4.0)

These directly unblock current sprints or are foundational to the platform thesis.

| # | Project | Category | V | M | U | T | **Score** | Why Explore First |
|---|---------|----------|---|---|---|---|-----------|-------------------|
| 1 | **planegcs** | 2D Constraints | 5 | 5 | 4 | 5 | **4.75** | Sprint 3 blocker. Our hand-rolled solver has 6 constraints; planegcs has 100+. Without it, parametric sketching is a toy. FreeCAD battle-tested it 15+ years. No alternative at this maturity. |
| 2 | **MCP Protocol Spec** | AI/Agent | 5 | 5 | 5 | 5 | **5.00** | Sprint 4 foundation. Rule 6 mandates every command has an MCP schema. The spec is adopted by Anthropic/OpenAI/Microsoft/Google — designing to it means any agent can drive NEXUS. This IS the co-engineering thesis. |
| 3 | **LangGraph.js** | AI/Agent | 5 | 5 | 5 | 5 | **5.00** | Sprint 4 orchestration. Multi-step AI plans ("draw room, place door, add dimensions") require stateful graph-based execution. Only mature TS agent framework with this model. |
| 4 | **CADmium** | Browser CAD | 4 | 4 | 3 | 5 | **3.95** | Closest architectural peer: Rust/WASM + SvelteKit + Three.js. Study their WASM bridge patterns, Truck kernel integration, and Svelte↔Three.js wiring. Don't fork (Elastic License) — learn. |
| 5 | **Flatbush** | Spatial Index | 3 | 4 | 3 | 5 | **3.65** | Sprint 5 performance target (10k entities at 60fps) needs O(log n) spatial queries. 3KB, zero deps, drop-in. Snap engine and selection manager become instant instead of O(n). |
| 6 | **web-ifc** | BIM/IFC | 5 | 5 | 5 | 4 | **4.75** | Only production WASM IFC parser. Unblocks the entire BIM vertical (v0.3). Study NOW so IFC entity decomposition into ECS components is designed correctly before we lock the component schema. Early study prevents v0.3 rewrites. |
| 7 | **opencascade.js** | Geometry Kernel | 5 | 5 | 4 | 3 | **4.30** | The 3D kernel decision (v0.2) is the highest-risk architectural choice after ECS. Study OCCT's API surface, WASM size, boolean op reliability, STEP I/O. Compare with Truck (Rust). Decision must be informed, not rushed. |

---

## Priority Tier 2 — Explore This Month (Score 3.5–3.9)

These shape near-term expansion decisions or provide critical reference patterns.

| # | Project | Category | V | M | U | T | **Score** | Why Explore Soon |
|---|---------|----------|---|---|---|---|-----------|------------------|
| 8 | **Yjs** | CRDT/Collab | 5 | 4 | 5 | 3 | **4.25** | Multiplayer CAD is a killer differentiator vs desktop tools. Event-sourced architecture maps naturally to CRDTs. Study how Yjs shared types map to our event store. Moved collaboration from v0.8 → v0.3 because it's that important. |
| 9 | **CesiumJS** | GIS Globe | 5 | 4 | 4 | 3 | **4.00** | The GIS renderer. Study how it handles coordinate precision (double-precision), terrain streaming, and 3D Tiles. Design the CRS component now so it's CesiumJS-ready when v0.4 arrives. |
| 10 | **Truck** (Rust B-Rep) | Geometry Kernel | 5 | 5 | 5 | 2 | **4.25** | Alternative to opencascade.js. Same language as kernel (Rust). CADmium proves it works for browser CAD. If mature enough by v0.2, it's architecturally superior to OCCT-via-WASM. Must evaluate head-to-head with OCCT. |
| 11 | **Potree** | Point Cloud | 5 | 3 | 4 | 3 | **3.75** | Proven at 597 billion points. Study octree LOD streaming architecture — it informs how PointCloud ECS component should work. Also: a separate photogrammetry project drone pipeline outputs point clouds that NEXUS consumes. |
| 12 | **IFC-lite** | BIM/IFC | 5 | 5 | 5 | 2 | **4.25** | Rust/WASM IFC parser, 5x faster than web-ifc. If it matures, it's the ideal BIM path for our Rust kernel. Track development closely. Could leapfrog web-ifc. |
| 13 | **CAD-MCP + openBIM-MCP** | MCP Servers | 4 | 5 | 3 | 4 | **3.95** | Reference implementations for MCP tool schema design. Study their tool naming conventions, parameter shapes, and return types. Don't import code — extract design patterns for Sprint 4. |
| 14 | **proj4js** | CRS/Projections | 5 | 3 | 3 | 3 | **3.55** | Essential for any georeferenced data. CRS is a core ECS component that affects every spatial domain. Study the API now so the CRS component design is projection-aware from day one. |
| 15 | **Speckle** | AEC Interop | 5 | 4 | 5 | 2 | **4.00** | One connector to Speckle = interop with Revit, Rhino, Civil 3D, QGIS, Blender. Study their object model — how they represent geometry across AEC domains. Their translation layer informs our ECS component design. |
| 16 | **libredwg-web** | File I/O | 4 | 3 | 4 | 4 | **3.70** | DWG is the #1 real-world file format. Users won't re-export to DXF. WASM build reads DWG R14-2018 in browser. GPL license needs legal review. Sprint 3 eval item. |
| 17 | **That Open Engine Components** | BIM UI | 4 | 3 | 3 | 3 | **3.25** | Property inspector, spatial tree, BCF support. Study their component patterns for BIM UI. Use their component library, not their viewer. Informs our `@nexus/ui` BIM panels. |

---

## Priority Tier 3 — Explore Next Quarter (Score 3.0–3.4)

These are important for specific expansion phases but don't affect current decisions.

| # | Project | Category | V | M | U | T | **Score** | When Relevant |
|---|---------|----------|---|---|---|---|-----------|---------------|
| 18 | **MapLibre GL JS** | GIS 2D Maps | 5 | 3 | 3 | 2 | **3.30** | v0.4 GIS. 2D vector maps for plan-view with basemaps. Study vector tile rendering pipeline. |
| 19 | **Turf.js** | Spatial Analysis | 4 | 3 | 3 | 2 | **3.05** | v0.4 GIS. Client-side spatial analysis (buffer, union, intersection). Wraps into GIS commands. |
| 20 | **DuckDB-WASM** | In-Browser DB | 4 | 3 | 4 | 2 | **3.30** | v0.4 GIS. SQL on spatial data in-browser. Pairs with GeoParquet. "SELECT parcels WHERE ST_Within(geom, buffer)" client-side. |
| 21 | **PMTiles** | Cloud-Native GIS | 4 | 2 | 4 | 2 | **3.00** | v0.4 GIS. Serverless tile archive — no tile server, just byte-range reads from a single file. Perfect for browser-native thesis. |
| 22 | **COPC.js + laz-perf** | Point Cloud | 4 | 2 | 4 | 2 | **3.00** | v0.6 Point Cloud. Stream LAZ from cloud storage. Pairs with Potree. a separate photogrammetry project → COPC → NEXUS pipeline. |
| 23 | **GaussianSplats3D** | Reality Capture | 4 | 2 | 5 | 2 | **3.25** | v0.6 Point Cloud. Three.js-based 3DGS renderer. Reality capture overlays on CAD/BIM. Drone survey visualization. |
| 24 | **Bevy ECS (standalone)** | ECS | 4 | 4 | 3 | 1 | **3.05** | v1.0. Archetypal storage, parallel systems, change detection. Only needed at 500k+ entities. Current ECS works at current scale. |
| 25 | **Loro** | CRDT (Rust) | 4 | 4 | 4 | 1 | **3.25** | v0.8. Rust-native CRDT. Better kernel-side integration than Yjs long-term. Less mature today. |
| 26 | **SQLite WASM** | In-Browser DB | 3 | 3 | 3 | 3 | **3.00** | v0.8. Indexed queries over event store at 100k+ events. Current OPFS flat file works at current scale. |
| 27 | **FlatGeobuf** | Cloud-Native GIS | 4 | 2 | 3 | 2 | **2.80** | v0.4 GIS. Streaming vector features via HTTP range reads. GeoJSON replacement for large datasets. |
| 28 | **GDAL3.js** | Geospatial I/O | 4 | 2 | 3 | 2 | **2.80** | v0.4 GIS. Full GDAL+PROJ+GEOS in WASM. Universal format conversion in browser. Heavy but powerful. |
| 29 | **Threlte** | Svelte/Three.js | 3 | 2 | 2 | 3 | **2.45** | Evaluate if renderer code gets complex. Declarative Three.js via Svelte components. We've already built our renderer, so only if major refactor warranted. |
| 30 | **OpenDroneMap** | Photogrammetry | 4 | 2 | 3 | 2 | **2.80** | a separate photogrammetry project integration. Not a NEXUS dependency — ODM processes drone imagery, NEXUS consumes the outputs. |

---

## Priority Tier 4 — Reference Only (Score < 3.0)

Study patterns and architecture, don't integrate. Listed for completeness.

| # | Project | Category | V | M | U | T | **Score** | What to Learn |
|---|---------|----------|---|---|---|---|-----------|---------------|
| 31 | **FreeCAD** | Desktop CAD | 3 | 2 | 1 | 2 | **2.05** | Constraint solver UX, sketcher workflow patterns. Already using their planegcs solver. |
| 32 | **SolveSpace** | Desktop CAD | 3 | 2 | 1 | 2 | **2.05** | Lightweight constraint solver design. Reference for edge cases in constraint solving. |
| 33 | **Text2BIM** (research) | AI+BIM | 3 | 4 | 3 | 1 | **2.80** | Multi-agent pattern: Programmer+Reviewer+Model Checker. Informs v0.7 multi-agent design. |
| 34 | **TerriaJS** | GIS Platform | 4 | 2 | 2 | 2 | **2.55** | National-scale web GIS architecture. Powers Digital Earth Australia. Study data loading patterns. |
| 35 | **xeokit-sdk** | BIM Viewer | 3 | 2 | 2 | 2 | **2.25** | Double-precision coordinate handling for large-scale BIM. AGPL = can't use, only study. |
| 36 | **iTwin.js** | Digital Twin | 4 | 2 | 2 | 1 | **2.30** | Bentley's digital twin framework. Study BIM+GIS+reality data integration patterns. |
| 37 | **OpenConstructionERP** | Construction | 4 | 2 | 3 | 1 | **2.55** | BOQ, 4D/5D scheduling, cost estimation patterns. Reference for v0.5+ construction domain. |
| 38 | **3DCityDB** | City Models | 4 | 2 | 3 | 1 | **2.55** | Semantic 3D city models. CityGML/CityJSON data model. Reference for urban digital twin phase. |
| 39 | **Eclipse Ditto** | IoT/DT | 3 | 2 | 2 | 1 | **2.05** | IoT "Things" state management patterns. Reference for sensor ingestion in Digital Twin phase. |
| 40 | **Transformers.js** | In-Browser AI | 3 | 3 | 3 | 1 | **2.55** | In-browser AI inference. Watch for models capable of spatial reasoning. Not ready today. |
| 41 | **Rapier/Parry** | Rust Physics | 3 | 3 | 2 | 2 | **2.55** | Already in Cargo.toml (Parry for collision). Physics simulation for construction/structural analysis. |
| 42 | **bitECS** | JS ECS | 3 | 3 | 2 | 2 | **2.55** | JS-side ECS if renderer needs entity queries without WASM round-trip. Evaluate if performance demands it. |
| 43 | **cqrs-es** | Event Sourcing | 3 | 4 | 2 | 2 | **2.80** | Rust CQRS patterns. Reference for when event types multiply (BIM + GIS + construction events). |
| 44 | **Manifold** | Mesh Booleans | 4 | 3 | 3 | 1 | **2.80** | Google-backed, guaranteed-manifold. Complement to OCCT for mesh ops. Evaluate alongside OCCT at v0.2. |
| 45 | **GeoEasy** | Surveying | 4 | 2 | 4 | 1 | **2.80** | Surveying calculations: network adjustment, traverse. Port algorithms to Rust for v0.5 civil domain. |

---

## Exploration Action Plan

### This Week (Sprint 3 work)
| Action | Time | Output |
|--------|------|--------|
| Deep-dive **planegcs** WASM: build, API surface, constraint types, integration pattern | 4h | Integration design doc, working WASM build |
| Evaluate **Flatbush**: benchmark with 10k entities, integrate into SnapEngine | 2h | PR with spatial index |
| Evaluate **libredwg-web**: build WASM, test with real DWG files, license review | 2h | Go/no-go decision |

### Next Week (Sprint 4 prep)
| Action | Time | Output |
|--------|------|--------|
| Study **MCP Protocol Spec**: tool schema format, transport, capabilities | 3h | Tool schema design for all R2 operations |
| Study **CAD-MCP + openBIM-MCP**: extract naming patterns, parameter shapes | 2h | Schema design reference doc |
| Prototype **LangGraph.js** integration: simple "draw a line from A to B" agent | 3h | Working agent → kernel pipeline |

### This Month (architectural decisions)
| Action | Time | Output |
|--------|------|--------|
| Study **CADmium** source: WASM bridge, Svelte integration, Truck kernel patterns | 4h | Architectural lessons doc |
| Study **web-ifc**: API, Fragments format, IFC entity model | 4h | ECS component design for BIM entities |
| Evaluate **opencascade.js vs Truck**: API, WASM size, boolean ops, STEP I/O | 6h | 3D kernel decision doc |
| Study **Yjs**: shared types, awareness protocol, offline sync | 3h | CRDT integration design for event store |
| Study **Speckle**: object model, connector architecture, data translation | 3h | Interop strategy doc |

### Next Quarter (expansion prep)
| Action | Time | Output |
|--------|------|--------|
| Prototype **CesiumJS** + Three.js dual renderer | 6h | GIS renderer architecture |
| Study **Potree** octree streaming | 3h | PointCloud component design |
| Evaluate **IFC-lite** maturity vs web-ifc | 2h | BIM parser decision update |
| Study **proj4js** for CRS component design | 2h | CRS component spec |

---

## Decision Dependencies

```
planegcs ──────────────────────────► Sprint 3 completion
    │
MCP Spec + LangGraph.js ──────────► Sprint 4 (AI layer)
    │
Flatbush ──────────────────────────► Sprint 5 (performance)
    │
opencascade.js vs Truck ───────────► v0.2 decision (3D kernel)
    │                                   must decide before v0.2 starts
web-ifc vs IFC-lite ───────────────► v0.3 decision (BIM parser)
    │
Yjs vs Loro ───────────────────────► v0.3 decision (CRDT)
    │
CesiumJS + MapLibre + proj4js ────► v0.4 foundation (GIS)
    │
Potree + COPC.js ──────────────────► v0.6 foundation (point cloud)
    │
Bevy ECS eval ─────────────────────► v1.0 decision (scale)
```

---

## Key Insight: Where NEXUS Creates Unique Value

The 210+ projects in the ecosystem directory solve **individual problems** well. Nobody connects them. The priority matrix above reflects this:

1. **Highest priority** = libraries that enable the **integration architecture** (MCP, LangGraph, planegcs, Flatbush) — because the architecture IS the product.
2. **Second priority** = libraries that unlock **new domains** through the existing architecture (web-ifc, opencascade.js, CesiumJS) — because additive expansion is the growth model.
3. **Third priority** = libraries that enable **unique capabilities no competitor has** (Yjs for multiplayer CAD, Speckle for universal interop, civil engineering from scratch).
4. **Lowest priority** = libraries that solve solved problems (renderers, databases, build tools) — we already have working choices.

The single highest-value exploration is **MCP Protocol Spec + LangGraph.js** (score: 5.0). This is the co-engineering thesis. Every other integration becomes more valuable once the AI agent layer exists, because agents can use every new domain immediately.
