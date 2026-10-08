# NEXUS — Open-Source Ecosystem Integration Analysis

> Maps the 210+ projects in [05-open-source-ecosystem-directory.md](./05-open-source-ecosystem-directory.md) to NEXUS's architecture and expansion path. For each integration, explains: what it replaces/enables, why now (or later), and how it plugs into the ECS + command + event-sourcing core.
>
> Created: 2026-04-12

---

## Integration Principles

1. **NEXUS's value is integration, not reimplementation.** The unique product is the unified ECS + command + event-sourcing + MCP architecture that connects proven libraries. Build the glue, not the guts.
2. **Every integration must enter through the command system** (Rule 1). A library that requires direct UI coupling is wrapped in a command first.
3. **Every integration must emit events** (Rule 2). A library that mutates state directly gets an adapter that captures mutations as events.
4. **Every integration maps to ECS components** (Rule 3). A library that brings its own object model gets a bridge that decomposes into components.
5. **Additive only** (Rule 4). New libraries add new components/systems/renderers — never restructure core.

---

## Tier 1 — Immediate (Sprints 3-5, Current v0.1)

### planegcs → Constraint Solver Upgrade
- **Replaces:** Hand-rolled `constraints.rs` (6 constraint types)
- **Enables:** Full parametric 2D sketching (100+ constraint types: tangent, symmetric, equal-length, angle, radius, etc.)
- **Why now:** Sprint 3 deliverable. Current solver handles basics but can't support real parametric CAD workflows. planegcs is FreeCAD's production solver, battle-tested over 15+ years.
- **Integration path:** WASM module loaded alongside kernel WASM. Kernel owns entity state; planegcs owns constraint solving. Bridge: kernel sends constraint descriptions → planegcs solves → kernel applies solved positions via events. Keep Rust solver as fallback for offline/minimal scenarios.
- **Risk:** LGPL license requires dynamic linking (WASM module separation), not static bundling. Already handled by loading as separate WASM.

### MCP Protocol Spec → AI Tool Schema Design
- **Enables:** Sprint 4's entire AI agent layer.
- **Why now:** The spec is the industry standard (Anthropic, OpenAI, Microsoft, Google). Designing tool schemas to spec means any MCP-compatible agent can drive NEXUS.
- **Integration path:** Define tool schemas in `@nexus/ai` package. Each schema mirrors a kernel command 1:1. Tool call → command dispatch → event → state change → result returned to agent.
- **Reference repos to study:** CAD-MCP (tool naming patterns), openBIM-MCP (BIM query patterns), ifcMCP (IFC traversal patterns). Don't import their code — study their schema design.

### LangGraph.js → Agent Orchestration
- **Enables:** Sprint 4 chat bar, multi-step AI operations.
- **Why now:** Single-shot tool calls are trivial. LangGraph adds: multi-step plans (agent draws room, then places door, then dimensions), state persistence across turns, error recovery (agent retries failed geometry).
- **Integration path:** LangGraph graph in `@nexus/ai`. Nodes = tool calls to kernel. Edges = LLM decisions. State = conversation + CAD state snapshot.

### Flatbush → Spatial Indexing
- **Enables:** Fast entity selection, snap-to-nearest, viewport culling at scale.
- **Why now:** With 10k+ entities (Sprint 5 performance target), brute-force spatial queries become the bottleneck. Flatbush is 3KB, zero-dependency, proven at millions of items.
- **Integration path:** Build spatial index from entity bounding boxes after each state change. SnapEngine and SelectionManager query the index instead of iterating all entities. Rebuild is cheap (5ms for 100k items).

### libredwg-web → DWG Read Support
- **Enables:** Opening native AutoCAD .dwg files — the #1 file format users will have.
- **Why now:** DXF is the text interchange format, but real-world files are DWG. Users won't re-export. libredwg-web compiles libredwg to WASM, reads DWG R14–2018.
- **Integration path:** Add as optional import path in `@nexus/file-io`. DWG → parse → kernel entities. Same pipeline as DXF import but different parser frontend.
- **Risk:** GPL license on libredwg. WASM module separation may satisfy, but needs legal review.

---

## Tier 2 — Near-Term (v0.2–v0.3, 3D CAD + BIM)

### opencascade.js → 3D B-Rep Kernel
- **Replaces:** Nothing (no 3D kernel exists yet)
- **Enables:** Extrude, revolve, boolean ops, fillets, chamfers, STEP/IGES I/O — everything 3D CAD needs.
- **Why v0.2:** This is the 3D expansion. OCCT is the industry-standard open-source B-Rep kernel (used by FreeCAD, Chili3D, replicad, CascadeStudio).
- **Integration path:** Loaded as separate WASM module. 3D operations become new commands (ExtrudeCommand, RevolveCommand, BooleanCommand). Results stored as new ECS components (BRepGeometry, Mesh3D). Existing 2D entities continue working unchanged.
- **Alternative watch:** Truck (Rust B-Rep) is architecturally better (same language as kernel) but less mature. CADmium proves it works. Evaluate at v0.2 decision time.
- **Size concern:** ~30MB WASM. Lazy-load only when user enters 3D mode.

### web-ifc → IFC Parser
- **Replaces:** Nothing (no BIM support yet)
- **Enables:** Import/export native IFC files. Read building elements, property sets, spatial structure.
- **Why v0.3:** IFC is the open BIM standard. web-ifc is the only production WASM IFC parser.
- **Integration path:** IFC entities decompose into ECS: `{EntityId, Geometry, BIMProperties, Layer, SpatialContainment}`. IFC property sets become a BIMProperties component. The renderer shows the same entities — they just have extra components.
- **Complement:** That Open Engine Components for property UI, spatial tree navigation, BCF (BIM Collaboration Format) support. Use their components library, not their viewer.

### IFC-lite → Watch as Alternative
- **What:** Rust/WASM IFC parser + WebGPU renderer. 5x faster geometry processing.
- **Why watch:** Fits NEXUS's Rust kernel better than C++→WASM web-ifc. If it matures by v0.3, evaluate as primary IFC path.

### Yjs → Real-Time Collaboration
- **Enables:** Multiple users editing the same drawing simultaneously.
- **Why v0.3 (moved up from v0.8):** Collaboration is a killer feature that differentiates from desktop CAD. Event-sourced architecture maps naturally to CRDTs — each event is a CRDT operation.
- **Integration path:** Yjs shared document mirrors the event store. Local event → append to Yjs → synced to peers → applied to their kernel. Conflict resolution: last-writer-wins per entity (Yjs default), with domain-specific merge for constraints.
- **Alternative watch:** Loro (Rust + WASM CRDT). Better long-term fit for Rust kernel. Less ecosystem maturity today.

### Speckle → Interop Platform
- **Enables:** Exchange data with Revit, Rhino, Civil 3D, QGIS, Blender without building connectors.
- **Why v0.3:** Users will need to move data between NEXUS and their existing tools. Speckle already has connectors to 15+ AEC apps.
- **Integration path:** Speckle connector for NEXUS. Translates ECS entities ↔ Speckle objects. Push NEXUS geometry to Speckle server → pull into Revit. Bidirectional.

---

## Tier 3 — Medium-Term (v0.4, GIS)

### CesiumJS → 3D Globe Renderer
- **Enables:** 3D terrain, satellite imagery, 3D Tiles, georeferenced viewing.
- **Integration path:** Second renderer alongside Three.js. CesiumJS handles globe/terrain; Three.js handles precise CAD geometry overlaid on the globe. Both renderers read from the same ECS world — CesiumJS queries entities with CRS components.

### MapLibre GL JS → 2D Vector Maps
- **Enables:** Plan-view GIS with vector tile basemaps (OpenStreetMap, etc.).
- **Integration path:** Third renderer option for 2D GIS views. Entity overlay on vector tile basemap. Useful for civil site plans on aerial/map backgrounds.

### proj4js → Coordinate Reference Systems
- **Enables:** Real-world coordinate transforms. Essential for any georeferenced data.
- **Integration path:** CRS becomes an ECS component. When an entity has a CRS, all coordinate operations go through proj4js. Commands like `set_crs`, `reproject` added to command system.

### Turf.js → Spatial Analysis
- **Enables:** Buffer, union, intersection, area, centroid, point-in-polygon — all in browser.
- **Integration path:** New GIS analysis commands that wrap Turf.js functions. `buffer_entity`, `spatial_join`, `measure_area`. Results become new ECS entities.

### PMTiles + FlatGeobuf → Cloud-Native Data
- **Enables:** Load massive GIS datasets from cloud storage without a server. Byte-range reads.
- **Integration path:** Data source adapters in `@nexus/file-io`. PMTiles for basemap tiles, FlatGeobuf for vector features. Both stream directly from URLs.

### DuckDB-WASM → Analytical Queries
- **Enables:** SQL queries on spatial data in-browser. "SELECT * FROM parcels WHERE ST_Within(geom, buffer)" running client-side.
- **Integration path:** Optional query engine. Entities with tabular attributes can be queried via SQL. Pairs with GeoParquet for large dataset analysis.

---

## Tier 4 — Later (v0.5–v0.6, Civil + Point Cloud)

### Potree → Point Cloud Rendering
- **Enables:** Visualize billions of LiDAR points in browser via octree LOD.
- **Integration path:** Fourth renderer. PointCloud becomes an ECS component. Potree handles rendering; kernel handles selection and measurement on point clouds.

### COPC.js + laz-perf → Point Cloud Streaming
- **Enables:** Stream LAZ data from cloud storage. No server-side processing needed.
- **Integration path:** Data source in `@nexus/file-io`. COPC index enables spatial queries on cloud-hosted point clouds.

### GaussianSplats3D → Reality Capture Overlay
- **Enables:** Gaussian splat visualization from drone surveys. Reality mesh alternative.
- **Integration path:** Three.js-based, so integrates with existing renderer. Splat data loaded as a scene overlay component.

### OpenDroneMap → a separate photogrammetry project Pipeline
- **Enables:** Drone imagery → point cloud → orthomosaic → surface model pipeline.
- **Integration path:** Not a NEXUS dependency. a separate photogrammetry project processes imagery via ODM, outputs COPC/GeoTIFF that NEXUS consumes.

### Civil Engineering Tools
- **GeoEasy** — Reference for surveying calculations (network adjustment, traverse). Port algorithms to Rust.
- **Survey2GIS** — Reference for field data → geometry conversion patterns.
- **OpenConstructionERP** — Reference for BOQ, 4D/5D scheduling patterns. Integration target, not dependency.

---

## Tier 5 — Future (v0.7+)

### Bevy ECS (standalone crate) → Kernel ECS Upgrade
- **Replaces:** Hand-rolled ECS in kernel
- **Enables:** Archetypal storage, change detection, parallel system scheduling, relationship queries.
- **Why later:** Current ECS works for 2D CAD scale. When entity count hits 500k+ (BIM + GIS + point cloud), Bevy's optimized storage and parallel scheduling become necessary.

### Transformers.js / WebLLM → In-Browser AI
- **Enables:** AI inference without API calls. Offline-capable AI agent.
- **Why later:** Current models small enough for browser are too weak for CAD operations. Watch for capable small models (Phi-4, Gemma-3) that can handle spatial reasoning.

### 3D City Models (3DCityDB, CityJSON) → Urban Digital Twin
- **Enables:** Semantic 3D city models. Buildings, roads, vegetation as typed objects.
- **Integration path:** CityJSON entities decompose into ECS components. CesiumJS renders 3D Tiles from 3DCityDB. Commands for urban analysis (shadow study, viewshed).

### ROS 2 (roslibjs, ros2-web-bridge) → Robot Teleoperation
- **Enables:** Construction robots reporting to NEXUS. Real-time equipment tracking on site model.
- **Why much later:** Requires the Digital Twin phase to be meaningful.

---

## Libraries Already Integrated — Validation

| Library | Status | Verdict |
|---------|--------|---------|
| Three.js | Renderer built on it | Correct choice. Stay. |
| Svelte 5 + SvelteKit | App shell built on it | Correct choice. Stay. |
| wasm-bindgen + wasm-pack | Kernel bridge | Correct choice. Stay. |
| dxf-parser | DXF import working | Fine. Add libredwg-web for DWG. |
| Turborepo + pnpm | Monorepo tooling | Correct choice. Stay. |
| Vitest | Test runner | Correct choice. Stay. |

## Libraries to NOT Integrate

| Library | Reason |
|---------|--------|
| Babylon.js, PlayCanvas, Godot | Already committed to Three.js. Don't split rendering. |
| CrewAI, AutoGen, MetaGPT | Python-only. Using LangGraph.js. |
| BIMserver, Bonsai | Server-side or Blender-specific. Not browser-native. |
| GeoServer, MapServer, GeoNode | Server-side GIS. NEXUS is browser-native. Use as upstream data sources only. |
| Eclipse Ditto, iTwin.js | Framework-level digital twin platforms. NEXUS's ECS + events IS the twin foundation. |
| nphysics | Superseded by Rapier/Parry (same authors). |
| RxDB | Heavier than needed. SQLite WASM + OPFS is simpler. |

---

## Summary: Integration Count by Phase

| Phase | Libraries to Integrate | New ECS Components | New Commands |
|-------|----------------------|-------------------|-------------|
| v0.1 (current) | planegcs, Flatbush, LangGraph.js, MCP spec | — | ~15 MCP tool schemas |
| v0.2 (3D CAD) | opencascade.js | BRepGeometry, Mesh3D | extrude, revolve, boolean, fillet, chamfer |
| v0.3 (BIM) | web-ifc, Yjs, Speckle | BIMProperties, SpatialContainment | ifc_import, ifc_export, bim_query |
| v0.4 (GIS) | CesiumJS, MapLibre, proj4js, Turf.js, PMTiles, FlatGeobuf | CRS, GISAttributes | set_crs, reproject, buffer, spatial_join |
| v0.5 (Civil) | (custom Rust) | Alignment, Profile, Surface | create_alignment, create_profile, grade |
| v0.6 (Point Cloud) | Potree, COPC.js, laz-perf | PointCloud | load_pointcloud, classify, measure |
| v0.7+ (Collab/DT) | Bevy ECS, CityJSON, ROS2 bridge | DigitalTwinState, IoTSensor | stream_telemetry, urban_analysis |
