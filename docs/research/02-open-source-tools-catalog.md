# NEXUS — Open-Source Tools, Apps & Repos Catalog (v2)

> **Date:** 2026-09-02 (supersedes 2026-04-10 draft)
> **Purpose:** Every open-source project that can help build NEXUS
> **Changelog vs v1:** 8 broken/wrong links fixed, 3 placeholder ("search X on GitHub") entries resolved to real repos, ~20 new entries added, every section tagged by scope tier. See corrections log at bottom.
> **v2.1 (same day):** reviewed against the repo — 6 entries corrected where the draft was out of date with what NEXUS already ships (ezpz, MCP SDK, jsPDF, maker.js activity, wasm-bindgen org, robotics scope). Listed at the end of the corrections log.
> **v2.2 (same day):** applied Appendix B of `docs/audit/2026-09-02-repo-audit-oss-plan.md` — Section 3 split into 2D-now vs 3D-later with the four Rust 2D crates added, Section 7 gains the permissive DXF libraries and the ODA EULA caveat, Section 8 gains the Rust text/PDF pair, Section 2b gains the two closest browser/Rust analogs, Comlink/cxx re-tagged. Listed at the end of the corrections log.
> **Doc budget note:** `05-open-source-ecosystem-directory.md` (+ its `-fa` twin) overlaps this file heavily. Candidate for retirement into this catalog.

## Scope tiers (read this first)

Per SD-05, NEXUS's sole pre-launch focus is **2D parity with AutoCAD**; all 3D, BIM, and GIS work is explicitly parked. Roughly 40% of this catalog (Sections 1, 2, 3b, 4, 5, 6, 12, 15, 16) is post-launch/north-star material — useful to keep on file, but not where near-term attention should go. Every section below is tagged:

- **[NOW]** — directly relevant to 2D CAD parity, the in-house MCP server, or the Rust/WASM/Svelte stack today
- **[LATER]** — parked per SD-05; revisit post-launch (BIM/GIS/digital twin phases)
- **[ALWAYS]** — infrastructure/tooling relevant regardless of phase (build tools, AI orchestration, frontend framework)

Three sections are new in v2, added specifically to fill gaps against the *actual* current scope: **2D Drafting & Vector Canvas**, **DWG/DXF Interchange** (elevated out of the old catch-all "File Format Parsers"), and **MCP SDK & Framework Tooling**.

---

## 1. BIM / IFC — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **web-ifc** | C++ IFC parser compiled to WASM. Reads & writes IFC at native speed in browser. | [GitHub](https://github.com/ThatOpen/engine_web-ifc) · [Docs](https://thatopen.github.io/engine_web-ifc/docs/) |
| **That Open Engine Components** | High-level BIM component toolkit built on web-ifc + Three.js. Viewer, property inspector, spatial trees, measurements, BCF. | [GitHub](https://github.com/ThatOpen/engine_components) · [Docs](https://docs.thatopen.com/) |
| **xeokit-sdk** | High-performance WebGL BIM viewer. Full double-precision coordinates. Loads IFC, glTF, LAZ, CityJSON. | [GitHub](https://github.com/xeokit/xeokit-sdk) · [Homepage](https://xeokit.io/) |
| **BIMROCKET** | Web-based BIM platform with viewing, editing, and BCF/IFC management. | [GitHub](https://github.com/bimrocket/bimrocket) |
| **BIMserver** | Server-side BIM collaboration. Versioning, merge, query (BimQL). | [GitHub](https://github.com/opensourceBIM/BIMserver) |
| **BIMsurfer** | WebGL IFC viewer for browser. | [GitHub](https://github.com/opensourceBIM/BIMsurfer) |
| **IfcOpenShell** | C++ IFC geometry engine with Python bindings. Most complete open-source IFC toolkit. | [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) · [Homepage](https://ifcopenshell.org/) |
| **Bonsai (BlenderBIM)** | Full BIM authoring addon for Blender. Creates, edits, exports native IFC. Desktop only. | [Homepage](https://bonsaibim.org/) · [Docs](https://docs.bonsaibim.org/) |
| **Speckle** | AEC data interoperability platform. Versioned object graph storage. Connectors for Revit, Rhino, Grasshopper, AutoCAD, Civil 3D, QGIS, Blender, etc. | [GitHub](https://github.com/specklesystems/speckle-server) · [Homepage](https://speckle.systems/) |
| **OpenProject BIM** | Project management with integrated xeokit IFC viewer. | [Homepage](https://www.openproject.org/docs/bim-guide/ifc-viewer/) |
| **Open IFC Viewer** | Simple browser-based IFC viewer. | [Homepage](https://openifcviewer.com/) |
| **xeokit-convert** | CLI tool to batch-convert IFC, CityJSON, LAZ, glTF to xeokit's XKT format. | [GitHub](https://github.com/xeokit/xeokit-convert) |

---

## 2. CAD / Parametric Modeling (3D) — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **CADmium** | Browser-based parametric CAD. Rust/WASM + SvelteKit + Three.js. Uses Truck B-Rep kernel. | [GitHub](https://github.com/CADmium-Co/CADmium) · [Demo](https://cadmium-co.github.io/CADmium/) |
| **VCAD** | Parametric CAD in Rust. 35k+ LOC BRep kernel. Browser-native via WASM. | [GitHub](https://github.com/ecto/vcad) · [Homepage](https://vcad.io) |
| **replicad** | TypeScript CAD library built on opencascade.js. B-Rep operations, STEP export, fillets, lofts. MIT. | [GitHub](https://github.com/sgenoud/replicad) · [Homepage](https://replicad.xyz/) |
| **JSCAD** | Code-based parametric 3D modeling in browser. Pure JavaScript CSG engine. MIT. | [GitHub](https://github.com/jscad/OpenJSCAD.org) · [Homepage](https://openjscad.xyz/) |
| **CascadeStudio** | Live-scripted CAD kernel in browser using opencascade.js. Actively maintained. | [GitHub](https://github.com/zalo/CascadeStudio) |
| **CADAM** | AI-powered text-to-CAD web app with parametric controls. Browser-native WASM. TypeScript/TanStack/Three.js. ~4.8k★, active. | [GitHub](https://github.com/Adam-CAD/CADAM) |
| **FreeCAD** | Full-featured desktop parametric CAD. v1.1 released March 2026. LGPL. | [GitHub](https://github.com/FreeCAD/FreeCAD) · [Homepage](https://www.freecad.org/) |
| **SolveSpace** | Lightweight parametric 2D/3D CAD with constraint solver. Experimental WASM port exists. | [GitHub](https://github.com/solvespace/solvespace) · [Homepage](https://solvespace.com/) |
| **Dune3D** | Parametric 3D CAD with constraint solver. C++/GTK4/OpenCASCADE. Desktop only. | [GitHub](https://github.com/dune3d/dune3d) |
| **Zoo Design Studio** | Browser CAD by Zoo.dev. Code-first (KCL language). AI text-to-CAD. MIT (app), proprietary engine. GitHub org still `KittyCAD` (product renamed, org didn't). | [GitHub](https://github.com/KittyCAD/modeling-app) · [Homepage](https://zoo.dev/) |

*Note: every entry here is a 3D-first tool. None is a close architectural reference for 2D-only AutoCAD-parity drafting — see Section 2b below, which is.*

---

## 2b. 2D Drafting & Vector Canvas — **[NOW]** *(new section)*

The old catalog had no category for pure 2D drafting engines or standalone 2D CAD apps — a real gap given NEXUS's actual near-term target.

| Project | Description | Links |
|---------|-------------|-------|
| **maker.js** | Microsoft's parametric 2D vector drawing library: lines/arcs/paths, boolean & chain operations, exports to DXF/SVG. Apache-2.0. The closest existing OSS analog to "a 2D CAD kernel for the web". Went quiet for several years but the repo shows commits through Aug 2026 — check whether that is maintenance or dependency bumps before relying on it. | [GitHub](https://github.com/Microsoft/maker.js) |
| **LibreCAD** | Free, GPL-2, desktop 2D-only CAD. DXF-based. The closest existing OSS *product* shape to NEXUS's near-term target — worth using as a feature/UX reference (layers, snaps, dimensioning, hatching) even though it's desktop C++/Qt, not browser. | [GitHub](https://github.com/LibreCAD/LibreCAD) · [Homepage](https://librecad.org/) |
| **QCAD (Community Edition)** | GPL-3.0-**with-exception** 2D CAD, DXF native. Another direct 2D-CAD-product reference; commercial edition adds DWG support via Teigha (see Section 7). Its 68 bundled `.pat` hatch patterns are © RibbonSoft — not free data, do not vendor. | [GitHub](https://github.com/qcad/qcad) · [Homepage](https://qcad.org/) |
| **OpenCAD Studio** *(v2.2)* | The closest **architectural** analog: browser + desktop 2D/3D drafting in Rust→WASM, DWG/DXF R13–2018, command line, osnaps, layouts, PDF plot. **GPL-3.0, ~84% single-author, no CONTRIBUTING** — learn-from only; do not copy code or data tables. Its DWG/DXF codec (`acadrust`, Section 7) and 2D curve kernel (`cadkernel`, Section 3a) are separate **MPL-2.0** crates, which is where any collaboration should happen. | [GitHub](https://github.com/HakanSeven12/OpenCADStudio) · [Site](https://www.opencad.studio/) |
| **mlightcad/cad-viewer** *(v2.2)* | The closest **browser** analog: fully client-side DXF/DWG viewer + editor in TypeScript/Three.js, MIT, ~1k★, active. Worth reading for MTEXT rendering (`mtext-input-box`), linetype and hatch rendering patterns. Its DWG path is the GPL `libredwg-web` (Section 7), which does not transfer. | [GitHub](https://github.com/mlightcad/cad-viewer) |
| **awesome-cad** *(v2.2)* | mlightcad's curated index of browser/WASM CAD, Rust CAD, DXF/DWG libraries. MIT. Use as the search index for anything not listed here; it has no section on hatch patterns, linetypes, SHX fonts, or plotting — those stay NEXUS-authored. | [GitHub](https://github.com/mlightcad/awesome-cad) |
| **Paper.js** | Vector graphics scene graph with boolean path operations and hit-testing — useful as an algorithm reference for curve-aware booleans, not the geometry engine itself. MIT; **last push 2024-07**, slowing. | [GitHub](https://github.com/paperjs/paper.js) |
| **martinez** *(v2.2)* | Martinez-Rueda polygon boolean ops in TypeScript, MIT, active (2026-04). Porting target if a Rust boolean crate underperforms; otherwise learn-from. | [GitHub](https://github.com/w8r/martinez) |
| **Fabric.js** / **Konva.js** | Canvas object models with selection handles and transform gizmos. Reference implementations for a Svelte-based 2D drafting canvas's grip/selection/snap-overlay UI — not for the actual precision geometry, which should stay in the Rust kernel. | [Fabric GitHub](https://github.com/fabricjs/fabric.js) · [Konva GitHub](https://github.com/konvajs/konva) |
| **Rough.js** | Sketchy/hand-drawn rendering style. Low priority — cosmetic only, not core-path. | [GitHub](https://github.com/rough-stuff/rough) |

**Flag:** none of these libraries do CAD-grade precision snapping (ortho/object-snap/grid-snap) out of the box — that logic has to live in NEXUS's Rust kernel regardless of which canvas library wraps it.

---

## 3a. 2D Geometry & Constraint Solving (Rust, WASM-ready) — **[NOW]** *(v2.2 — split out of the old "Geometry Kernels")*

The old Section 3 was tagged NOW but held only 3D B-rep/mesh kernels. These are the Rust crates that map to open 2D-parity gaps (gap rows G2, G5, G6, G26 in `docs/audit/2026-09-02-repo-audit-oss-plan.md`). All compile to `wasm32-unknown-unknown`; all verified active on 2026-09-02.

| Project | Description | Links |
|---------|-------------|-------|
| **cavalier_contours** | Polyline-with-bulge (arc segment) **offset and boolean ops** — this is AutoCAD OFFSET/PEDIT math. MIT OR Apache-2.0, active (2026-08). **APPROVED as TC-08 in `DECISIONS.md` but never added to `Cargo.toml`**; OFFSET is still hand-rolled in `geometry_ops.rs`. Adopt. | [GitHub](https://github.com/jbuckmccready/cavalier_contours) |
| **kurbo** | Bézier/arc curve math, offset curves, arc-length parameterization (linebender). Apache-2.0/MIT, active (2026-07). For FILLET/CHAMFER math and a real SPLINE evaluator. Adopt. | [GitHub](https://github.com/linebender/kurbo) |
| **lyon** | Path fill/stroke **tessellation** → GPU buffers. MIT/Apache-2.0, active (2026-08), ~2.6k★; OpenCAD Studio uses it. For true hatch fills, wide polylines, and glyph outlines fed to Three.js. Adopt. | [GitHub](https://github.com/nical/lyon) |
| **i_overlay** (iShape-Rust) | Robust polygon booleans (union/intersect/difference/xor). Apache-2.0, active (2026-08). **APPROVED as TC-09, never added.** For REGION and hatch-boundary booleans. Adopt. | [GitHub](https://github.com/iShape-Rust/iOverlay) |
| **KittyCAD/ezpz** | **Already adopted.** Rust-native 2D geometric constraint solver, MIT. Wired into the kernel as `ezpz = "0.2"` in `packages/kernel/Cargo.toml`; no C++/WASM FFI bridging. | [GitHub](https://github.com/KittyCAD/ezpz) |
| **planegcs** | FreeCAD's 2D geometric constraint solver ported to WASM (C++ under the hood, wrapped for JS). Not adopted — ezpz won on architectural fit. | [GitHub](https://github.com/Salusoft89/planegcs) |
| **cadkernel** (HakanSeven12) *(v2.2)* | MPL-2.0 "2D curve operations and a B-rep solid layer" from OpenCAD Studio's author, created 2026-08. Only its dependency-free `geom2d` feature (curves, intersections) is in scope; `brep`/`acis` are 3D → parked. Learn-from for now. | [GitHub](https://github.com/HakanSeven12/cadkernel) |
| **truck-geometry** *(v2.2)* | The NURBS/knot-vector module of `truck` (Apache-2.0). Read-only reference for SPLINE math; `truck` as a B-rep kernel stays in 3b. | [GitHub](https://github.com/ricosjp/truck) |
| **verb-nurbs** | JS/Haxe NURBS curve & surface library. The kernel is Rust, so this is an algorithm reference only; `kurbo` + `truck-geometry` are the adoptable path. | [GitHub](https://github.com/pboyer/verb) |
| **2d_geometric_constraint_solver** | Lightweight standalone 2D sketch constraint solver — useful as an algorithm reference even if not embedded directly. | [GitHub](https://github.com/AntonEvmenenko/2d_geometric_constraint_solver) |

---

## 3b. 3D Geometry Kernels (WASM) — **[LATER]** *(v2.2 — parked under SD-05)*

| Project | Description | Links |
|---------|-------------|-------|
| **Truck** | Rust B-Rep kernel. NURBS, booleans, STEP I/O. Compiles to WASM. Used by CADmium. Apache-2.0, active. The AD-09 choice once 3D is unblocked. | [GitHub](https://github.com/ricosjp/truck) |
| **Manifold** | Ultra-fast guaranteed-manifold mesh booleans. Google-backed. Apache 2.0. WASM build. | [GitHub](https://github.com/elalish/manifold) · [Homepage](https://manifoldcad.org/) |
| **opencascade.js** | Full OpenCASCADE B-Rep kernel compiled to WASM. Boolean ops, NURBS, fillets, STEP I/O. LGPL-2.1. **Last push 2023-08 — stale**; re-verify before relying on it. | [GitHub](https://github.com/donalffons/opencascade.js) · [Homepage](https://ocjs.org/) |
| **opencascade-rs** | Rust bindings to OpenCASCADE. Can compile to WASM. | [GitHub](https://github.com/bschwind/opencascade-rs) |
| **occt-import-js** | Emscripten interface for OpenCASCADE import. Reads BREP, STEP, IGES in browser. | [GitHub](https://github.com/kovacsv/occt-import-js) |
| **vcad** | B-rep CAD kernel in Rust/WASM, parametric, AI-oriented. Apache-2.0, active (2026-09). | [GitHub](https://github.com/ecto/vcad) |

---

## 4. GIS / Geospatial — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **CesiumJS** | 3D globe, terrain streaming, 3D Tiles, satellite imagery. Apache 2.0. WebGPU branch landing 2025. | [GitHub](https://github.com/CesiumGS/cesium) · [Homepage](https://cesium.com/platform/cesiumjs/) |
| **TerriaJS** | Full web-based geospatial data explorer. Built on CesiumJS. Powers national-scale digital twins. Apache 2.0. | [GitHub](https://github.com/TerriaJS/terriajs) · [Homepage](https://terria.io/) |
| **MapLibre GL JS** | Open-source fork of Mapbox GL JS. Vector tiles, 2D/2.5D maps. BSD-3. | [GitHub](https://github.com/maplibre/maplibre-gl-js) · [Homepage](https://maplibre.org/) |
| **Deck.gl** | WebGL/WebGPU data visualization framework. Large-scale point clouds, geospatial layers. MIT. | [GitHub](https://github.com/visgl/deck.gl) · [Homepage](https://deck.gl/) |
| **OpenLayers** | Foundational web mapping library. All OGC standards, vector tiles, WebGL rendering. BSD-2. | [GitHub](https://github.com/openlayers/openlayers) · [Homepage](https://openlayers.org/) |
| **GeoNode** | Web geospatial CMS. Upload, share, manage spatial data. Built on GeoServer + Django. | [GitHub](https://github.com/GeoNode/geonode) · [Homepage](https://geonode.org/) |
| **MapStore** | Modern web mapping framework. 2D/3D viewer, dashboards. React + OpenLayers + CesiumJS. | [GitHub](https://github.com/geosolutions-it/MapStore2) · [Homepage](https://mapstore.geosolutionsgroup.com/) |
| **loaders.gl** | Framework for loading and parsing 3D Tiles, point clouds, geospatial formats. vis.gl ecosystem. | [GitHub](https://github.com/visgl/loaders.gl) · [Homepage](https://loaders.gl/) |

---

## 5. Coordinate Systems & Spatial Processing — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **PROJ** | Cartographic projections and coordinate transformations. 6000+ CRS. MIT. | [GitHub](https://github.com/OSGeo/PROJ) · [Homepage](https://proj.org/) |
| **proj4js** | JavaScript port of PROJ. Lightweight CRS transforms in browser. | [GitHub](https://github.com/proj4js/proj4js) |
| **GDAL3.js** | GDAL + PROJ + GEOS + SpatiaLite compiled to WASM. Full geospatial conversion in browser. | [GitHub](https://github.com/bugra9/gdal3.js) |
| **Loam** | JavaScript wrapper for GDAL in the browser. Reprojection, format conversion. | [GitHub](https://github.com/azavea/loam) |
| **GDAL** | The universal geospatial translator library. Raster + vector. MIT. | [GitHub](https://github.com/OSGeo/gdal) · [Homepage](https://gdal.org/) |
| **Turf.js** | Advanced geospatial analysis in JavaScript. Spatial joins, buffers, measurements. MIT. | [GitHub](https://github.com/Turfjs/turf) · [Homepage](https://turfjs.org/) |
| **H3-js** | Uber's hexagonal hierarchical spatial index. JavaScript binding. Apache 2.0. | [GitHub](https://github.com/uber/h3-js) |
| **Flatbush** | Really fast static spatial index (R-tree) for 2D points/rectangles. ISC. | [GitHub](https://github.com/mourner/flatbush) |
| **RBush** | High-performance 2D spatial index (R-tree). MIT. | [GitHub](https://github.com/mourner/rbush) |

---

## 6. Point Cloud — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **Potree** | WebGL point cloud viewer. Renders billions of points via octree LOD. BSD-2. | [GitHub](https://github.com/potree/potree) · [Homepage](https://potree.github.io/) |
| **Potree-Next** | WebGPU rewrite of Potree, Netidee-funded. Actively developed but still early — most features not yet ported. Not abandoned, not yet merged upstream. | [GitHub](https://github.com/m-schuetz/Potree-Next) |
| **COPC.js** | JavaScript reader for Cloud-Optimized Point Clouds. Stream LAZ from cloud storage. MIT. | [GitHub](https://github.com/connormanning/copc.js) · [Spec](https://copc.io/) |
| **laz-perf** | LAZ decompression in JavaScript/WASM. Fast point cloud decode. | [GitHub](https://github.com/hobu/laz-perf) |
| **LASViewer** | Web app to view LiDAR LAS files. Renders up to 250M points without thinning. | [GitHub](https://github.com/lasviewer/lasviewer.github.io) |
| **Plasio** | Drag-and-drop in-browser LAS/LAZ viewer. | [GitHub](https://github.com/verma/plasio) · [Homepage](http://plas.io) |
| **COPC Viewer** | Browser-based COPC point cloud viewer. | [Homepage](https://viewer.copc.io/) |
| **PotreeConverter** | Convert LAS/LAZ to Potree format for streaming. | [GitHub](https://github.com/potree/PotreeConverter) |

---

## 7. DWG/DXF Interchange — **[NOW, highest-priority gap]** *(elevated & expanded from "File Format Parsers")*

AutoCAD parity lives or dies on file compatibility. Until v2.1 this catalog treated DWG as the single biggest unsolved gap in the OSS landscape; with `acadrust` that is no longer true, but it remains the highest-stakes integration decision — flagging it explicitly rather than burying it in a generic parser list.

| Project | Description | Links |
|---------|-------------|-------|
| **dxf-parser** | JavaScript DXF file parser. Reads into structured JS objects. MIT. In use in `@nexus/file-io`, wrapped by **eight hand-rolled pre-pass parsers** for entities it lacks (HATCH, RAY/XLINE/WIPEOUT, VIEW, UCS, DWGPROPS, …). **Upstream last pushed 2024-06.** Retire once `acadrust` lands. | [GitHub](https://github.com/gdsestimating/dxf-parser) |
| **ixmilia/dxf** (`dxf` crate) *(v2.2)* | Mature Rust DXF read/write, **MIT**, spec-generated, R10–R2014 near-complete, ASCII + binary; crate 0.6.1 (2026-03), commits 2026-08. **No DWG, no MLEADER/TABLE/VIEWPORT.** WASM: likely (needs `getrandom` js feature via `uuid`, `chrono` wasmbind) — untested. The DXF-only fallback if the `acadrust` spike disappoints. | [GitHub](https://github.com/ixmilia/dxf-rs) · [crates.io](https://crates.io/crates/dxf) |
| **@tarikjabiri/dxf** *(v2.2)* | Actively maintained TypeScript DXF **writer**, MIT (2026-06). TS-side fallback for export if the Rust path slips. | [GitHub](https://github.com/tarikjabiri/js-dxf) |
| **ezdxf** *(v2.2)* | Python DXF read/write, MIT, the reference implementation for entity edge cases. **Already the CI oracle**: `scripts/validate-dxf.mjs` runs `ezdxf audit` on every fixture and round-trip output (advisory-mode workflow, to be flipped blocking). No DWG (its `odafc` add-on shells out to ODA File Converter — see EULA note). | [GitHub](https://github.com/mozman/ezdxf) |
| **ACadSharp** *(v2.2)* | .NET DWG/DXF read/write, MIT, active; the project `acadrust` was modelled on. No WASM build. Reference for entity/version edge cases when matching AutoCAD's expectations. | [GitHub](https://github.com/DomCR/ACadSharp) |
| **dxf-viewer** | DXF 2D viewer in JavaScript for browser (Three.js). **MPL-2.0** (file-level copyleft: fine as a dependency, modified files must stay MPL). Active (2026-06). Learn-from for hatch/linetype/text rendering. | [GitHub](https://github.com/vagran/dxf-viewer) |
| **LibreDWG** *(was a placeholder link, now correct)* | The only mature open-source DWG read/write library. **GPL-3 — licensing friction for a commercial-track product**, C, not WASM-ready out of the box. Usable as a process-isolated CI oracle without contaminating the kernel's license. | [GitHub](https://github.com/LibreDWG/libredwg) |
| **libredwg-web** *(fixed — was a dead npm-search link)* | Existing WASM port of LibreDWG for in-browser DWG parsing. Inherits LibreDWG's GPL-3 licensing. | [GitHub](https://github.com/mlightcad/libredwg-web) |
| **acadrust** *(v2.1 — found by the 2026-09-02 repo audit)* | Pure-Rust DXF (R12–R2018) and **DWG (R13–R2018) read and write**, 41 entity types, **MPL-2.0** — the first permissive-license DWG path in this catalog. The audit compiled it for `wasm32-unknown-unknown` with only the `getrandom` backend flag. Carries 3D code paths; use only the 2D/DXF/DWG surface under SD-05. Candidate to *replace* `dxf-parser` + the hand-rolled writer, not sit beside them. Details: `docs/audit/2026-09-02-repo-audit-oss-plan.md`. | [GitHub](https://github.com/hakanaktt/acadrust) · fork in use by OpenCAD Studio: [cadcodec](https://github.com/HakanSeven12/cadcodec) |
| **ODA (Open Design Alliance) Drawings SDK / File Converter** | The de facto standard for real DWG read/write fidelity — but **proprietary, membership/licensing fees required**, not open source. The free **ODA File Converter** binary is **non-commercial use only for non-members** under its EULA. It is *planned* as a second CI oracle in `docs/agent-tasks/ci-dxf-validators.md` but **not implemented** — and should not be wired into a commercial-track CI without ODA membership or legal review. Manual AutoCAD round-trips plus `ezdxf audit` cover the same ground. | [Homepage](https://www.opendesign.com/) · [FAQ](https://www.opendesign.com/faq/question/what-are-oda-viewer-and-oda-file-converter) |

**Bottom line (revised v2.2):** DXF interop is solved with permissive-license OSS (`acadrust` MPL-2.0 or `ixmilia/dxf` MIT, both Rust). DWG interop now also has a permissive path: `acadrust`, verified to compile for `wasm32-unknown-unknown` on 2026-09-02. Recommended sequence (audit plan ranks 2, 5, 6): one-week `acadrust` spike against the 27-fixture corpus and real AutoCAD DWGs → replace `dxf-parser` + the hand-rolled writer with `acadrust` in the kernel (Rule 5) → DWG open/save behind a feature flag once R2013/R2018 write is verified against AutoCAD. `ixmilia/dxf` is the DXF-only fallback. LibreDWG and `libredwg-web` stay learn-from (GPL); ODA stays out of CI (EULA).

---

## 8. Text, Fonts & Plot Export — **[NOW]** *(new section)*

AutoCAD-parity dimensioning/annotation needs vector text (not DOM/HTML text) and precision plot-to-PDF — neither was covered in v1.

| Project | Description | Links |
|---------|-------------|-------|
| **ttf-parser** *(v2.2)* | Zero-alloc TTF/OTF outline parser in Rust, Apache-2.0, active (2026-08), WASM-ready. The kernel-side answer for TEXT/MTEXT glyph outlines (tessellated by `lyon`, Section 3a) and for vector text in PDF plots. Preferred over a JS parser because text geometry belongs in Rust (Rule 5). | [GitHub](https://github.com/RazrFalcon/ttf-parser) |
| **fontdue** *(v2.2)* | Fast Rust glyph rasterizer, Apache-2.0, active. Optional: on-screen glyph-atlas caching; secondary to `ttf-parser`, which is needed regardless. | [GitHub](https://github.com/mooman219/fontdue) |
| **opentype.js** | Parses fonts and renders glyphs as path outlines client-side (JS). Fallback if text geometry stays TS-side; otherwise superseded by `ttf-parser`. | [GitHub](https://github.com/opentypejs/opentype.js) |
| **harfbuzzjs** | WASM build of HarfBuzz for complex-script shaping. **Demoted:** AutoCAD-style single-line/MTEXT rendering does not need shaping; the Rust equivalent (`rustybuzz`) is archived. Revisit only for RTL/Indic annotation text. | [GitHub](https://github.com/harfbuzz/harfbuzzjs) |
| **printpdf** *(v2.2)* | Rust PDF generation explicitly built for WASM, MIT, active (2026-08), ~1.1k★. Top candidate for a kernel-side PLOT pipeline (all entities, lineweights, page setup). | [GitHub](https://github.com/fschutt/printpdf) |
| **pdf-writer** (typst) *(v2.2)* | Lower-level Rust PDF writer, Apache-2.0, active (2026-08). More control, more code; complement or fallback to `printpdf`. | [GitHub](https://github.com/typst/pdf-writer) |
| **jsPDF** *(v2.2)* | **Current state:** `jspdf` 4.2.1 ships in `@nexus/file-io` (`pdf-export.ts`, 7 entity types, single fixed page). MIT, active (2026-08), 31k★. Keep until a kernel-side plot pipeline exists. | [GitHub](https://github.com/parallax/jsPDF) |
| **svg2pdf.js** *(v2.2)* | MIT, active (2026-08). Fallback if the plot pipeline goes Three.js → SVG → PDF. | [GitHub](https://github.com/yWorks/svg2pdf.js) |
| **pdf-lib** | Pure-JS, no-dependency PDF generation. **Last push 2024-07 — stale; community forks (e.g. `@cantoo/pdf-lib`) carry maintenance.** Not recommended over jsPDF (active) or `printpdf` (Rust). Kept for reference. | [GitHub](https://github.com/Hopding/pdf-lib) |

**Data assets (not libraries):** Autodesk's `acad.pat` / `acad.lin` / SHX fonts carry no redistribution grant; QCAD's `.pat` set is © RibbonSoft; LibreCAD's hatch resources ship GPL and its `.lff` fonts have mixed per-font licenses (OFL, Apache/GPL dual, KST32B). The standard ANSI/ISO hatch and linetype definitions are short parametric tables — author NEXUS's own and support user `.pat`/`.lin` upload. Public-domain Hershey stroke fonts are the SHX-philosophy option; any OFL font covers TTF.

---

## 9. 3D Rendering — [ALWAYS, lower priority pre-launch]

| Project | Description | Links |
|---------|-------------|-------|
| **Three.js** | The standard JavaScript 3D library. WebGL + WebGPU renderer. 100k+ GitHub stars. MIT. In use in `@nexus/renderer`. | [GitHub](https://github.com/mrdoob/three.js) · [Homepage](https://threejs.org/) |
| **Threlte** | Declarative Three.js for Svelte. Scene graph via Svelte components. | [GitHub](https://github.com/threlte/threlte) · [Homepage](https://threlte.xyz/) |
| **Babylon.js** | Full 3D engine. WebGL + WebGPU. Game-oriented but capable. Apache 2.0. | [GitHub](https://github.com/BabylonJS/Babylon.js) · [Homepage](https://www.babylonjs.com/) |
| **Zephyr3D** | TypeScript WebGL + WebGPU rendering engine. Lightweight, modular. | [GitHub](https://github.com/gavinyork/zephyr3d) |
| **PlayCanvas** | WebGL/WebGPU game engine. Open source runtime. MIT. | [GitHub](https://github.com/playcanvas/engine) · [Homepage](https://playcanvas.com/) |

---

## 10. AI / LLM / Agent Orchestration — [ALWAYS]

| Project | Description | Links |
|---------|-------------|-------|
| **LangGraph** | Agent orchestration as stateful directed cyclic graphs. MIT. v1.0+. | [GitHub](https://github.com/langchain-ai/langgraph) · [Homepage](https://www.langchain.com/langgraph) |
| **LangChain.js** | LLM application framework for JavaScript. 90k+ stars (Python + JS). MIT. | [GitHub](https://github.com/langchain-ai/langchainjs) · [Homepage](https://js.langchain.com/) |
| **Open Agent Platform** | No-code web UI for creating and managing LangGraph agents. | [GitHub](https://github.com/langchain-ai/open-agent-platform) |
| **Transformers.js** | Run HuggingFace models in browser. Embeddings, NLP, vision. ONNX Runtime + WebGPU. Apache 2.0. | [GitHub](https://github.com/huggingface/transformers.js) · [Docs](https://huggingface.co/docs/transformers.js/) |
| **WebLLM** | High-performance in-browser LLM inference via WebGPU. Llama, Phi, Gemma, Mistral. Apache 2.0. | [GitHub](https://github.com/mlc-ai/web-llm) · [Homepage](https://webllm.mlc.ai/) |
| **CrewAI** | Role-based multi-agent framework. Python. MIT. | [GitHub](https://github.com/crewAIInc/crewAI) · [Homepage](https://www.crewai.com/) |
| **AutoGen** | Multi-agent conversation framework by Microsoft. MIT. | [GitHub](https://github.com/microsoft/autogen) |
| **Vectra** | In-memory vector database for JavaScript. Local vector search. MIT. | [GitHub](https://github.com/Stevenic/vectra) |

---

## 11. MCP Servers (AI ↔ CAD/BIM/GIS) — **[NOW for pattern-study, LATER for BIM/GIS-specific ones]**

| Project | Description | Links |
|---------|-------------|-------|
| **GIS MCP Server** | MCP server for GIS operations — coordinate transforms, spatial analysis, geometry ops. | [GitHub](https://github.com/mahdin75/gis-mcp) · [Homepage](https://gis-mcp.com/) |
| **CAD-MCP** | MCP server for CAD operations. Draw lines, circles, text. COM-based; AutoCAD/GstarCAD/ZWCAD on Windows. | [GitHub](https://github.com/daobataotie/CAD-MCP) |
| **ifcMCP** *(fixed — was a blog link, not a repo)* | MCP server for LLM agents to work with IFC files. | [GitHub](https://github.com/smartaec/ifcMCP) |
| **FreeCAD MCP** *(fixed — was a "search on GitHub" placeholder)* | AI-driven CAD modeling via RPC server controlling FreeCAD. Most community traction of any CAD MCP server. | [GitHub](https://github.com/neka-nat/freecad-mcp) |
| **Revit MCP** *(fixed — old repo archived Feb 2026)* | AI assistant connection to Autodesk Revit via MCP + WebSocket. Canonical repo moved to a monorepo after the original was archived. | [GitHub](https://github.com/mcp-servers-for-revit/mcp-servers-for-revit) |
| **AutoCAD MCP (community forks)** *(reworded — "AutoCAD LT MCP" as originally framed doesn't hold up: AutoCAD LT doesn't expose the ObjectARX/.NET/AutoLISP automation surface these servers depend on)* | Scattered community MCP servers translate natural language into AutoLISP for full AutoCAD, not LT. No single canonical repo yet — this is a real "nobody's built the definitive one" gap, arguably NEXUS's most direct competitive-validation signal. | e.g. [codesknight/AutoCAD-MCP](https://github.com/codesknight/AutoCAD-MCP) |
| **Claude for CAD (Anthropic)** | First-party MCP connectors for Autodesk Fusion and Blender (late April 2026). 3D/mechanical/mesh — not 2D drafting. Bolt-on over the host's scripting API; the pattern NEXUS's native command→tool mapping is designed to beat. | [develop3d](https://develop3d.com/ai/claude-for-cad-blender-autodesk-fusion/) |
| **MCP Protocol Spec** | The Model Context Protocol standard. Adopted by Anthropic, OpenAI, Microsoft, Google. | [GitHub](https://github.com/modelcontextprotocol/servers) · [Spec](https://modelcontextprotocol.io/) |

---

## 11b. MCP SDK & Framework Tooling — **[NOW]** *(new section)*

NEXUS built its own 156-tool MCP server (`packages/mcp`; count verified 2026-09-02) as a competitive moat — the tooling used to build and test it matters, and v1 had no category for this at all.

| Project | Description | Links |
|---------|-------------|-------|
| **modelcontextprotocol/typescript-sdk** | The official MCP TypeScript SDK. **Already adopted** — `packages/mcp` is built on `@modelcontextprotocol/sdk` ^1.12.1, stdio transport only today. Streamable HTTP is the Phase 6 (Cloud Run agent mode) item. | [GitHub](https://github.com/modelcontextprotocol/typescript-sdk) |
| **FastMCP** | Higher-level TS framework over the official SDK — schema validation, sessions, streaming HTTP. Could reduce boilerplate across 156 tool definitions; evaluate against `tool-definitions.ts` before the HTTP transport work. | [GitHub](https://github.com/punkpeye/fastmcp) |
| **MCP Inspector** | Official debugging/testing tool for MCP servers. Directly relevant to verifying the "every mutation logged" event-log claim is actually testable end-to-end. | [GitHub](https://github.com/modelcontextprotocol/inspector) |

---

## 12. Digital Twin / IoT — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **iTwin.js** | Bentley's open-source digital twin visualization. BIM + GIS + reality data. MIT. | [GitHub](https://github.com/iTwin/itwinjs-core) · [Homepage](https://www.itwinjs.org/) |
| **Eclipse Ditto** | IoT digital twin framework. REST/WS APIs, "Things" state management. EPL-2.0. | [GitHub](https://github.com/eclipse-ditto/ditto) · [Homepage](https://eclipse.dev/ditto/) |
| **Eclipse BaSyx** | Asset Administration Shell (AAS) for industrial digital twins. MQTT, OPC-UA. | [Homepage](https://www.eclipse.org/basyx/) |
| **DTCC Platform** *(fixed — v1 linked only a homepage, no repo)* | City planning digital twins. Python. MIT. From Sweden's Digital Twin Cities Centre. Org is `dtcc-platform`; flagship repo is `dtcc-core`. | [GitHub](https://github.com/dtcc-platform/dtcc-core) · [Homepage](https://dtcc.chalmers.se/) |
| **OpenTwins** | Open-source compositional digital twin platform. | [GitHub](https://github.com/ertis-research/opentwins) |
| **3DCityDB** | Database + web viewer for CityGML/CityJSON. CesiumJS-based viewer. Apache 2.0. | [GitHub](https://github.com/3dcitydb/3dcitydb) |

---

## 13. Collaboration / CRDT & Event-Sourcing — [ALWAYS — but see flag below]

| Project | Description | Links |
|---------|-------------|-------|
| **Yjs** | CRDT for real-time collaboration. P2P via WebRTC. Fastest CRDT implementation. MIT. | [GitHub](https://github.com/yjs/yjs) · [Homepage](https://yjs.dev/) |
| **Automerge** | JSON CRDT built in Rust with WASM JS bindings. Full document history. MIT. | [GitHub](https://github.com/automerge/automerge) · [Homepage](https://automerge.org/) |
| **Loro** | Rust CRDT supporting rich text, list, map, movable tree. Newer alternative. | [GitHub](https://github.com/loro-dev/loro) · [Homepage](https://loro.dev/) |
| **zundo** *(new, reference only)* | Undo/redo middleware for Zustand-style stores. Not directly adoptable (wrong framework/paradigm) but the closest OSS pattern reference for "typed, replayable mutation log." | [GitHub](https://github.com/charkour/zundo) |

**Flag:** none of the above is actually the same thing as NEXUS's "every mutation logged to an event log" audit architecture — CRDTs solve concurrent-editing merge conflicts, not command/event-sourcing with a durable audit trail. This category is genuinely thin/DIY in OSS for exactly what NEXUS needs, which is worth noting as *evidence the trust-architecture moat claim is real* rather than something that should have been bought off-the-shelf.

---

## 14. In-Browser Database — [ALWAYS]

| Project | Description | Links |
|---------|-------------|-------|
| **DuckDB-WASM** | Analytical SQL database in browser. Parquet, CSV, JSON, Arrow, spatial. MIT. | [GitHub](https://github.com/duckdb/duckdb-wasm) · [Homepage](https://duckdb.org/) |
| **SQLite WASM** | Official SQLite compiled to WASM. Public domain. | [GitHub](https://github.com/sqlite/sqlite-wasm) |
| **sql.js** | SQLite compiled to JS via Emscripten. Runs in browser. MIT. | [GitHub](https://github.com/sql-js/sql.js) |

---

## 15. Robotics / ROS 2 / Telemetry — [LATER — last domain in the expansion path]

| Project | Description | Links |
|---------|-------------|-------|
| **Robot Web Tools** | Suite of open-source libraries for web-based robot apps with ROS. | [Homepage](https://robotwebtools.github.io/) |
| **ros2-web-bridge** | JSON interface to ROS 2 via rosbridge v2 protocol over WebSockets. | [GitHub](https://github.com/RobotWebTools/ros2-web-bridge) |
| **roslibjs** | JavaScript library for interacting with ROS from the browser. | [GitHub](https://github.com/RobotWebTools/roslibjs) |
| **opentera-webrtc-ros** | WebRTC teleoperation for ROS 2. Video + data channel. | [GitHub](https://github.com/introlab/opentera-webrtc-ros) |
| **webrtc-ros2-streamer** | WebRTC integration for streaming ROS 2 topics to browser. | [GitHub](https://github.com/nicolecll/webrtc_ros2_streamer) |

*This section is here on purpose: the platform thesis (CLAUDE.md Rules 1 and 6) is "human-AI-robot co-engineering", so robots are a target actor class, not leftover scope creep. It is the furthest-out domain in the Rule 4 expansion path and needs no attention before launch.*

---

## 16. Photogrammetry / Drone Processing — [LATER]

| Project | Description | Links |
|---------|-------------|-------|
| **OpenDroneMap (ODM)** | Command line toolkit for drone imagery → maps, point clouds, 3D models, DEMs. | [GitHub](https://github.com/OpenDroneMap/ODM) · [Homepage](https://opendronemap.org/) |
| **WebODM** *(fixed — decoupled from OpenDroneMap org)* | Web UI for OpenDroneMap. User-friendly drone image processing. AGPL-3.0 (confirmed still accurate). Now its own org, not under OpenDroneMap. | [GitHub](https://github.com/WebODM/WebODM) · [Homepage](https://webodm.org/) |

---

## 17. Frontend / UI Framework — [ALWAYS]

| Project | Description | Links |
|---------|-------------|-------|
| **Svelte 5** | Compiler-based UI framework. Runes for fine-grained reactivity. No virtual DOM. MIT. | [GitHub](https://github.com/sveltejs/svelte) · [Homepage](https://svelte.dev/) |
| **SvelteKit** | Full-stack framework for Svelte. Routing, SSR, adapters. MIT. | [GitHub](https://github.com/sveltejs/kit) · [Homepage](https://kit.svelte.dev/) |
| **shadcn-svelte** | Beautiful, customizable components for Svelte. Open source. | [Homepage](https://shadcn-svelte.com/) |
| **Threlte** | Declarative Three.js for Svelte 5. 3D scenes as Svelte components. | [GitHub](https://github.com/threlte/threlte) · [Homepage](https://threlte.xyz/) |
| **Flowbite Svelte** | Tailwind CSS component library for Svelte. | [Homepage](https://flowbite-svelte.com/) |

---

## 18. Build / Monorepo / Rust-WASM Tooling — **[ALWAYS — expanded, directly relevant to the Rust kernel]**

| Project | Description | Links |
|---------|-------------|-------|
| **Turborepo** | High-performance monorepo build system. Smart caching. By Vercel. MIT. | [GitHub](https://github.com/vercel/turborepo) · [Homepage](https://turbo.build/) |
| **pnpm** | Fast, disk-efficient package manager. Workspace support for monorepos. MIT. | [GitHub](https://github.com/pnpm/pnpm) · [Homepage](https://pnpm.io/) |
| **Vitest** | Vite-native test framework. Fast, TypeScript-first. MIT. | [GitHub](https://github.com/vitest-dev/vitest) · [Homepage](https://vitest.dev/) |
| **Playwright** | Cross-browser E2E testing. By Microsoft. Apache 2.0. | [GitHub](https://github.com/microsoft/playwright) · [Homepage](https://playwright.dev/) |
| **esbuild** | Extremely fast JavaScript/TypeScript bundler. Go-based. MIT. | [GitHub](https://github.com/evanw/esbuild) · [Homepage](https://esbuild.github.io/) |
| **wasm-pack** *(fixed — v1's link was wrong)* | Build Rust → WASM packages for npm. The `rustwasm` GitHub org was sunsetted in July 2025; repo now lives under `wasm-bindgen`. | [GitHub](https://github.com/wasm-bindgen/wasm-pack) |
| **wasm-bindgen** *(new, should have been explicit already — wasm-pack depends on it)* | Generates the JS↔Rust/WASM binding glue. The actual API ergonomics of the kernel↔JS boundary live here, not in wasm-pack. Same org move as wasm-pack: `rustwasm/wasm-bindgen` now redirects to `wasm-bindgen/wasm-bindgen`. | [GitHub](https://github.com/wasm-bindgen/wasm-bindgen) |
| **cxx crate** *(new)* — **[LATER]** | Safe Rust↔C++ FFI. Was listed for vendoring LibreDWG into the kernel; moot if `acadrust` (pure Rust) is adopted, and vendoring LibreDWG would import GPL-3.0 into the kernel anyway. Keep on file only. | [GitHub](https://github.com/dtolnay/cxx) |
| **Comlink** *(new)* — **[LATER]** | RPC-over-Web-Worker library. Solves offloading WASM kernel work off the main thread without hand-rolled postMessage plumbing. Today the kernel runs on the main thread with JSON strings; moving it to a Worker is AD-13's post-parity step, to be triggered by a measured need (audit plan rank 17: benchmarks first). | [GitHub](https://github.com/GoogleChromeLabs/comlink) |

---

## 19. AI + AEC Research — [ALWAYS, low-frequency reading]

| Project | Description | Links |
|---------|-------------|-------|
| **Text2BIM** | Multi-agent LLM framework for generating 3D building models from natural language → IFC. Confirmed active, updated through mid-2025. | [GitHub](https://github.com/dcy0577/Text2BIM) · [Paper](https://arxiv.org/abs/2408.08054) |
| **MCP4IFC** | MCP server enabling LLMs to create/edit/query IFC models via tool calls. Paper-only — no public repo exists as of Sept 2026 (confirmed, not an oversight). | [Paper](https://arxiv.org/abs/2511.05533) · [Homepage](https://show2instruct.github.io/mcp4ifc/) |
| **BIM LLM Code Agent** | LLM-powered BIM code agent. | [GitHub](https://github.com/mac999/BIM_LLM_code_agent) |
| **awesome-civil-engineering** | Curated list of civil engineering software and resources. | [GitHub](https://github.com/QuantumNovice/awesome-civil-engineering) |
| **awesome-frontend-gis** | Curated geospatial resources for web development. | [GitHub](https://github.com/joewdavies/awesome-frontend-gis) |
| **awesome-geospatial** | Comprehensive list of geospatial tools and resources. | [GitHub](https://github.com/sacridini/Awesome-Geospatial) |

---

## Corrections log (v1 → v2)

**Broken/wrong links fixed:**

- `wasm-pack` — wrong repo (`nicholaswyoung/wasm-pack` doesn't exist as the canonical source) and dead homepage; `rustwasm` org sunsetted July 2025, moved to `wasm-bindgen/wasm-pack`.
- `libredwg-web` — was an npm search-results URL, not a package link; correct package is `mlightcad/libredwg-web`.
- `ifcMCP` — was a third-party blog post, not a repo; real repo is `smartaec/ifcMCP`.
- `FreeCAD MCP` — was a "search on GitHub" placeholder; real repo is `neka-nat/freecad-mcp`.
- `Revit MCP` — original repo archived Feb 2026; canonical is now the `mcp-servers-for-revit` monorepo.
- `AutoCAD LT MCP` — reworded; "LT" framing was conceptually wrong (LT lacks the automation APIs these tools need).
- `DTCC Platform` — was a homepage-only entry with no repo link; added `dtcc-platform/dtcc-core`.
- `WebODM` — org decoupled from OpenDroneMap; link updated to `WebODM/WebODM`.

**Verified OK, no change:** Zoo Design Studio, CADAM, Potree-Next (description expanded), Bonsai/BlenderBIM, CascadeStudio, VCAD, web-ifc, Manifold, Speckle, xeokit-sdk, CesiumJS, MapLibre GL JS, Turborepo, DuckDB-WASM.

**New entries (~20):** Section 2b (2D Drafting & Vector Canvas, 6 entries), Section 3 additions (ezpz, verb-nurbs, 2d_geometric_constraint_solver), Section 7 additions (LibreDWG, ODA), Section 8 (new — 3 entries), Section 11 (Claude for CAD), Section 11b (new — 3 entries), Section 13 (zundo, as reference only), Section 18 additions (wasm-bindgen, cxx, Comlink).

**Structural change:** DWG/DXF interchange pulled out of the generic "File Format Parsers" grab-bag into its own section, since it's arguably the single highest-stakes open question for reaching real AutoCAD parity. (The v2 framing "GPL vs. proprietary, no clean permissive-license path" was superseded the same day by the `acadrust` finding; see v2.1/v2.2 below.)

**v2.1 review against the repo (2026-09-02):**

- `ezpz` — draft said "can potentially be vendored"; it is already the kernel's constraint solver (`ezpz = "0.2"` in `packages/kernel/Cargo.toml`). Marked adopted; planegcs marked not adopted.
- `typescript-sdk` — draft said "if not already built directly on it"; `packages/mcp` depends on `@modelcontextprotocol/sdk` ^1.12.1. Marked adopted, stdio-only noted.
- `pdf-lib` — draft framed it as a fresh pick; `jspdf` 4.x is already in `@nexus/app` and `@nexus/file-io`. Reframed as a candidate migration.
- `maker.js` — draft said unmaintained since ~2019; GitHub shows pushes through Aug 2026 and an Apache-2.0 license. Claim softened.
- `wasm-bindgen` — draft linked `rustwasm/wasm-bindgen` while stating the org was sunsetted; GitHub redirects to `wasm-bindgen/wasm-bindgen`. Link updated.
- Section 15 robotics — draft suggested removal as scope creep; robots are a named actor class in the platform thesis (Rules 1 and 6). Kept as LATER with that rationale.
- `acadrust` added to Section 7 and the DWG bottom line revised, from the same-day `2026-09-02-repo-audit-oss-plan.md` finding. MCP tool count aligned to the audit (156).
- All 24 changed/new GitHub links probed with HTTP HEAD on 2026-09-02: all resolve.

**v2.2 — Appendix B of `docs/audit/2026-09-02-repo-audit-oss-plan.md` applied (2026-09-02):**

- Section 3 split: **3a** (2D geometry & constraints, NOW) gains `cavalier_contours`, `kurbo`, `lyon`, `i_overlay` — the first two are APPROVED decisions (TC-08/TC-09) never added to `Cargo.toml` — plus `cadkernel` (geom2d only) and `truck-geometry` as references; `verb-nurbs` demoted to reference. **3b** (3D kernels, LATER) holds Truck, Manifold, opencascade.js (flagged stale since 2023), opencascade-rs, occt-import-js, and gains `vcad`. Scope-tier paragraph updated to list 2 and 3b as parked.
- Section 7: added `ixmilia/dxf` (MIT), `@tarikjabiri/dxf` (MIT), `ezdxf` (MIT, already the CI oracle), `ACadSharp` (MIT, reference). `dxf-viewer` tagged MPL-2.0. `dxf-parser` row notes the eight hand-rolled pre-pass parsers and 2024 upstream. **ODA row corrected:** File Converter is planned, not implemented, as a CI oracle, and its EULA is non-commercial for non-members — do not wire into CI. Intro and bottom line rewritten to the v2.2 recommendation.
- Section 8: added `ttf-parser`, `fontdue`, `printpdf`, `pdf-writer`, `jsPDF` (current), `svg2pdf.js`; `harfbuzzjs` demoted; `pdf-lib` flagged stale (2024-07). Added a data-assets note on `.pat`/`.lin`/SHX/`.lff` licensing.
- Section 2b: QCAD corrected to GPL-3.0-with-exception with the RibbonSoft `.pat` note; added OpenCAD Studio (GPL app, MPL codec underneath), `mlightcad/cad-viewer` (MIT), `awesome-cad` (MIT), `martinez` (MIT); Paper.js flagged slowing (2024-07).
- Section 18: `Comlink` and `cxx` re-tagged LATER with rationale.
- Section 15 robotics: Appendix B suggested dropping it; the v2.1 rationale (robots are a named actor class in the platform thesis) is accepted and the section stays LATER.
- Not changed: Section 11b count (already 156), Section 13 flag (agreed), `ezpz`/SDK/jsPDF/maker.js rows (already fixed in v2.1).
