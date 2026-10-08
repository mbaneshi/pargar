# How Our 12 Reference Repos Tackle the Six Challenges

Cross-reference of findings from `docs/archive/findings/01-12` against the six challenges defined in `00-six-real-challenges.md`.

---

## Challenge 1: Numerical Stability in Geometric Operations

The fundamental problem: floating-point precision causes edges that should meet to not meet, polygons that should be closed to have microscopic gaps, and boolean operations to produce cryptic failures.

### CADmium -- Custom constraint solver is numerically fragile

- **What they do:** Built a custom spring-damper physics simulation for 2D constraints. Points have mass, velocity, and force accumulators. A first-order Euler integrator runs with `dt = 0.02` until convergence (max change < `1e-12`).
- **What works:** Simple constraints (segment length, segment angle, circle diameter) converge for well-separated geometry.
- **What fails:** Unstable at `dt > 0.04`. Cannot handle coincident constraints, perpendicular constraints, tangent constraints, or fixed-point constraints. No DOF analysis. No convergence guarantees. The README TODO explicitly calls out replacing it with a proper solver.
- **NEXUS lesson:** Do not build custom constraint solvers. Use planegcs (WASM), which has 20+ years of FreeCAD heritage with proper Newton-Raphson solving, DOF analysis, and tolerance management.

### Chili3D -- Relies on OCCT, but no failure recovery for booleans

- **What they do:** Wraps OCCT's `BRepAlgoAPI_Fuse`, `BRepAlgoAPI_Cut`, `BRepAlgoAPI_Common` via Emscripten embind. OCCT internally uses tolerant geometry with per-entity tolerance tracking.
- **What works:** OCCT's tolerant geometry handles most standard operations. 30+ years of hardened numerical code.
- **What fails:** OCCT boolean operations still fail on coincident faces, very thin geometry, non-manifold inputs, and tolerance mismatches. Chili3D does not document any fallback strategy (no retry with relaxed fuzzy value, no topology validation of output).
- **NEXUS lesson:** Always check `BRepAlgoAPI_BooleanOperation::HasErrors()` and `HasWarnings()`. Implement tolerance retry (retry with relaxed fuzzy value). Validate output topology (closed shell, manifold). Event sourcing provides natural rollback if an operation fails.

### replicad -- Two WASM builds for error visibility, minimal validation

- **What they do:** Ships two OCCT WASM builds: one without C++ exception support (smaller, faster) and one with `-fexceptions` that exposes `Standard_Failure` for debugging. Most OCCT operations are NOT wrapped in try/catch. Errors surface as null checks or uncaught WASM aborts.
- **What works:** The exceptions-enabled build allows catching `Standard_ConstructionError`, `Standard_RangeError`, etc. during development.
- **What fails:** In production (non-exception build), invalid geometry operations crash the WASM runtime entirely. No graceful degradation. No geometry healing or validation layer.
- **NEXUS lesson:** Use the exceptions-enabled build during development. Wrap OCCT operations in try/catch at the command level. Map OCCT `Standard_Failure` types to typed NEXUS errors. Pre-validate inputs before calling OCCT. Build a geometry healing layer that validates and repairs results after every operation.

### CesiumJS -- Solved GPU float32 precision definitively

- **What they do:** Two complementary techniques: Relative-to-Center (RTC) rendering where vertex positions are small offsets from a float64 center, and Emulated Double Precision (EncodedCartesian3) where float64 is split into two float32 values (high + low) sent as separate vertex attributes. All CPU math uses JavaScript's native float64.
- **What works:** Sub-centimeter precision anywhere on Earth. A float32 value at 4,500,000m has ~270mm precision, completely unusable -- but RTC reduces coordinates to small offsets where float32 is sufficient.
- **What fails:** Nothing -- this is a solved problem in CesiumJS. The 2x vertex attribute bandwidth cost for emulated double precision is negligible.
- **NEXUS lesson:** Three.js float32 breaks at ~10km from origin for engineering-grade work. For v0.1-v0.3 (single-site CAD), set origin to project center and this is fine. For v0.4+ (GIS/Civil), adopt the RTC scene-origin pattern: store all positions as float64 in ECS, subtract scene origin before GPU upload. Implement origin shifting when camera moves >5km from current origin.

### web-ifc -- Custom fuzzy-bools library for IFC geometry

- **What they do:** Uses a custom "fuzzy-bools" library for CSG boolean operations during IFC geometry processing. When void count exceeds `BOOLEAN_UNION_THRESHOLD` (default 150), voids are pre-fused before subtraction for performance.
- **What works:** Handles the common case of wall openings (IfcBooleanClippingResult) which accounts for a large fraction of BIM boolean operations.
- **What fails:** Complex CSG chains with many operations can accumulate numerical errors. The geometry processor is a 2182-line switch statement with no systematic tolerance management.
- **NEXUS lesson:** For IFC import, use web-ifc as-is rather than reimplementing geometry processing. For parametric BIM editing, use OCCT's boolean operations with the defensive patterns from the Chili3D/replicad findings.

### Potree -- Quantized mesh avoids precision issues entirely

- **What they do:** Vertex positions are quantized to 16-bit unsigned integers (0-32767) relative to tile bounds. This gives sub-centimeter resolution within each tile while keeping vertex data compact (6 bytes per vertex). No floating-point issues because positions are integer offsets.
- **What works:** Eliminates precision problems entirely for point cloud rendering. Edge stitching uses explicit edge vertex lists to prevent cracks between tiles at different LOD levels.
- **What fails:** Quantization is lossy -- positions are snapped to a grid determined by tile size and 16-bit range. For survey-grade point clouds this may lose sub-millimeter precision within a tile.
- **NEXUS lesson:** For point cloud visualization (v0.6), quantization is acceptable. For engineering geometry, keep full float64 precision in the ECS and use RTC for GPU rendering.

---

## Challenge 2: Memory Management and Object Lifetime in Browser

The problem: gigabytes of geometric data in the browser, JavaScript GC pauses causing stutter, WASM heap invisible to browser GC, and the expensive JS/WASM boundary.

### CADmium -- Entire state re-serialized as JSON on every mutation

- **What they do:** The entire project state lives in Rust/WASM. JavaScript gets a JSON snapshot of the full workbench/realization every time anything changes. `get_realization()` returns a `Realization` wrapper, which the JS side converts via `wasmReal.to_json()` then `JSON.parse()`.
- **What works:** Simple to implement. No manual memory management. TypeScript types auto-generated via tsify.
- **What fails:** Every mutation re-serializes the ENTIRE realization (all solids, sketches, planes) as JSON. For a small hobby project this is fine; for 500k+ entities it would collapse. JSON parsing on every frame creates GC pressure.
- **NEXUS lesson:** The tsify + serde pattern is excellent for the initial bridge, but plan for SharedArrayBuffer or structured transfer for geometry data. Only transfer deltas (changed entities), not the full state. Use CRC32 hash change-detection keys to avoid re-processing unchanged geometry.

### Chili3D -- OCCT C++ objects across WASM boundary without documented cleanup

- **What they do:** OCCT C++ objects (`TopoDS_Shape`, `gp_Pnt`, `BRep_Builder`) are exposed to JavaScript via Emscripten embind. JS gets proxy objects pointing into WASM linear memory. C++ destructors are NOT automatically called when JS GC collects the proxy.
- **What works:** The standard embind pattern enables direct manipulation of OCCT objects from JS.
- **What fails:** No documented systematic memory management. The WASM heap is a single large `ArrayBuffer` invisible to browser GC. If JS proxies are not explicitly `.delete()`-ed, the WASM heap grows unboundedly even when JS appears to have no memory pressure.
- **NEXUS lesson:** Implement explicit `.delete()` calls in a disciplined RAII-like pattern. Use `FinalizationRegistry` as a safety net. Build a `WasmScope` utility for deterministic cleanup. Pool frequently created/destroyed objects like `gp_Pnt`.

### replicad -- The gold standard for OCCT WASM memory management

- **What they do:** Three-tier memory management strategy:
  1. `WrappingObj` base class: wraps every OCCT object with `FinalizationRegistry` for automatic cleanup when JS GC collects the wrapper.
  2. `GCWithScope`: registers intermediate OCCT objects for cleanup when the function scope's GC runs.
  3. `localGC`: explicit deterministic cleanup -- call `gc()` to immediately free all registered objects.
- **What works:** The `localGC` pattern provides deterministic cleanup for command execution hot paths. `FinalizationRegistry` catches objects that escape manual cleanup. The combination prevents unbounded WASM heap growth.
- **What fails:** `FinalizationRegistry` timing is non-deterministic -- memory may not be freed immediately. Move semantics (operations like `translate()` delete the source shape) conflict with event sourcing's need for immutable snapshots.
- **NEXUS lesson:** Adopt all three patterns verbatim. `localGC` is especially critical for command execution where deterministic cleanup after each command prevents accumulation. For event sourcing compatibility, clone shapes before transforming instead of using move semantics.

### web-ifc -- Streaming geometry processing to limit peak memory

- **What they do:** `StreamAllMeshes` processes geometry one element at a time, calling back with the mesh, then calling `geomLoader->Clear()` to free IFC memory immediately. The JS side receives one `IfcFlatMesh` at a time.
- **What works:** Peak memory stays proportional to the largest single element, not the entire model. For a 500k-element BIM model, only one element's geometry is in memory at a time during loading.
- **What fails:** All property data must still be loaded (relationship traversal requires random access to express IDs). The C++ geometry processor itself maintains caches (`IfcCache`) that grow with model size.
- **NEXUS lesson:** For IFC import, use the streaming pattern: process one element, create ECS entity, free IFC data. Do not load entire model into memory before processing.

### Bevy ECS -- BlobVec stores raw bytes, no GC pressure

- **What they do:** Component data stored in `BlobVec` -- type-erased contiguous arrays of raw bytes. No `Box<dyn Any>`, no vtable, no heap indirection per component. Layout metadata (size, alignment, drop function pointer) is stored once per type, not per instance.
- **What works:** Zero GC pressure for ECS data because it is all in Rust/WASM linear memory. Contiguous storage means excellent cache locality for iteration. Archetype transitions use swap-remove to keep tables dense.
- **What fails:** Moving entities between archetypes (adding/removing components) copies all component data -- O(number of components). Storing large blobs (mesh buffers) in components is expensive when entities move.
- **NEXUS lesson:** Store large data (mesh buffers, vertex arrays) in external storage referenced by ID from a component. Keep components small (transforms, metadata, IDs). Use SparseSet for high-churn marker components (Selected, Hovered) to avoid expensive archetype transitions.

### Potree -- LRU cache with explicit GPU memory disposal

- **What they do:** An LRU cache tracks all loaded octree nodes. When total loaded points exceed the memory budget, least-recently-visible nodes are evicted. Eviction calls `geometry.dispose()` to free GPU memory and removes the node from the Three.js scene.
- **What works:** Smooth camera navigation -- recently viewed nodes stay cached for quick re-display. The LRU ensures total memory stays bounded.
- **What fails:** Early versions had memory leaks because point attribute arrays were not disposed alongside geometry. Fixed by explicitly deleting attribute buffers before geometry disposal.
- **NEXUS lesson:** Three.js `geometry.dispose()` does NOT free everything -- explicitly delete attribute buffers too. Implement an LRU geometry cache for off-screen entities. Consider OPFS as a second cache tier (evicted from GPU but available locally).

### Yjs -- CRDT items accumulate unboundedly without GC

- **What they do:** Every mutation creates `Item` structs in a doubly-linked list. Deleted items are not removed -- they are flagged. With `gc: true`, deleted item content is discarded (replaced with a `GC` struct) but the item metadata remains for CRDT correctness. With `gc: false` (needed for audit trails), everything is retained.
- **What works:** `gc: true` reduces memory by discarding content of deleted items. Run-length optimization merges sequential inserts from the same client into single items.
- **What fails:** At scale (500k+ entities with frequent edits), the Item count grows unboundedly. Estimated 200MB+ for 100k entities. Subdoc partitioning is mandatory at scale.
- **NEXUS lesson:** Use subdocs to partition by sheet/layer/discipline. Set `gc: false` only for audit-required documents (AEC compliance). Throttle interactive updates (drag operations) to ~10-15Hz through Yjs, not 60fps. Commit final state on mouseup.

---

## Challenge 3: Concurrency and Threading

The problem: heavy computation must not block the main thread, but Web Workers have separate memory and communicate only by message passing. SharedArrayBuffer has strict security requirements.

### CADmium -- Zero concurrency, all WASM on main thread

- **What they do:** All WASM operations run on the main thread. No Web Workers anywhere in the codebase.
- **What works:** Simplicity -- no message-passing complexity, no synchronization issues.
- **What fails:** Any expensive operation (constraint solving, boolean ops, tessellation) blocks the UI. For small hobby models this is tolerable; for production CAD it is not.
- **NEXUS lesson:** The message-passing pattern (Message enum -> handle -> result) is already structured for Worker offloading. The `sendWasmMessage()` function could be made async with a Worker postMessage bridge with minimal refactoring. NEXUS must offload to Workers from day one.

### Zoo Design Studio -- Cloud geometry engine, local WASM for parsing only

- **What they do:** All geometry computation happens on Zoo's cloud GPU servers. The app sends modeling commands over WebSocket; the engine computes and streams video frames back. The WASM module handles only parsing (KCL AST), not geometry.
- **What works:** Unlimited computational power on the server. No browser threading limitations. Large models render smoothly because GPU rendering happens server-side.
- **What fails:** Requires internet for any operation. Latency for every geometry operation (WebSocket round-trip). Cannot work offline.
- **NEXUS lesson:** NEXUS's local-first approach is architecturally better for offline capability and latency-sensitive 2D operations. For future heavy 3D computation, optional cloud offloading could be offered while keeping local as the default.

### replicad -- Global singleton WASM, no Worker support

- **What they do:** A single global `OC` instance via `setOC()`/`getOC()`. No Web Worker usage.
- **What works:** Simple initialization pattern.
- **What fails:** Only one OCCT instance per JS context. Cannot parallelize operations across workers. Each worker would need its own WASM instance (duplicating the 5-15MB module in memory).
- **NEXUS lesson:** For NEXUS with Web Workers, each worker needs its own WASM instance. Plan for per-worker initialization. The memory cost of duplicating the WASM module is the price of parallelism. For 2D (planegcs ~200KB), this is trivial. For 3D (OCCT ~15MB), it is significant but manageable.

### Bevy ECS -- Automatic parallelism via system scheduling (but single-threaded on WASM)

- **What they do:** Systems declare data access via parameter types. The scheduler builds a dependency graph from `FilteredAccessSet` metadata and runs non-conflicting systems on a thread pool. On WASM, falls back to single-threaded execution because `std::thread` is unavailable.
- **What works:** Correct ordering guarantees even in single-threaded mode. System sets and run conditions organize execution. Deferred commands (`Commands`) buffer entity spawn/despawn and apply atomically between dependency levels.
- **What fails:** No WASM multi-threading. The parallel scheduler is wasted on the web platform.
- **NEXUS lesson:** Do not invest effort in WASM multi-threading (SharedArrayBuffer + atomics). Accept single-threaded ECS execution. Use Web Workers only for truly independent heavy computation (tessellation, file parsing, constraint solving) that communicates results back via postMessage.

### Yjs -- Designed for concurrent multi-user editing

- **What they do:** The YATA algorithm provides deterministic conflict resolution for concurrent edits from multiple users. Each Item has `origin` and `rightOrigin` fields that allow deterministic ordering of concurrent inserts. Transactions are atomic and serializable.
- **What works:** True concurrent editing without locks. Each user undoes only their own operations via `trackedOrigins`. Awareness protocol provides real-time cursor sharing. Offline sync via state vector diffing.
- **What fails:** High-frequency geometry updates (drag operations at 60fps) flood the CRDT with intermediate states that bloat history. Must throttle to ~10-15Hz.
- **NEXUS lesson:** Yjs handles multi-user concurrency at the data layer. NEXUS should use Yjs transactions for all state mutations and rely on CRDT convergence rather than building custom locking. Throttle interactive updates. Commit final state on mouseup.

### LangGraph.js -- Pregel-style superstep execution for AI agents

- **What they do:** Execution engine based on Pregel message-passing model. Nodes run in parallel within a "superstep"; between supersteps, state is synchronized via channels. Supports async execution with configurable retry policies.
- **What works:** Multiple tool calls in one AIMessage are executed concurrently by ToolNode. Retry policies with exponential backoff handle transient failures. Recursion limit prevents infinite loops.
- **What fails:** Not designed for browser Worker architecture. LangGraph runs in a single JS context. Tool execution parallelism is within that context (Promise.all), not across Workers.
- **NEXUS lesson:** LangGraph handles AI-level concurrency (parallel tool calls, retry). NEXUS should keep LangGraph in the main thread (or a dedicated AI worker) and have tool implementations post messages to the kernel worker.

### Potree -- Async HTTP loading with request prioritization

- **What they do:** Octree nodes are loaded on demand via HTTP fetch. A request manager throttles concurrent downloads. Requests are prioritized by visual significance (screen-space error and distance to camera). When the camera moves, requests that are no longer needed are cancelled.
- **What works:** Progressive loading -- the viewer is usable immediately with coarse LOD while detail loads in the background. Camera movement cancellation prevents wasted bandwidth.
- **What fails:** No Web Worker for point data processing -- loading and parsing happen on the main thread.
- **NEXUS lesson:** The request prioritization and cancellation pattern is directly applicable to streaming any large dataset (DXF, IFC, point clouds). Process loaded data in a Web Worker to avoid blocking the UI during parsing.

---

## Challenge 4: Learning Curve and Professional User Expectations

The problem: engineers with decades of muscle memory, keyboard shortcuts, right-click menu expectations, and zero tolerance for operations that are slower than desktop.

### Zoo Design Studio -- Code-first approach targets a different user

- **What they do:** Every CAD model is a KCL text file. GUI clicks produce AST modifications that get recast back to code. The code IS the model. Marketing differentiator: git-based version control for CAD.
- **What works:** Targets developers and parametric modeling enthusiasts, not traditional CAD operators. Avoids competing directly on "feature parity with AutoCAD" by offering a fundamentally different workflow (code-centric).
- **What fails:** Engineers with AutoCAD muscle memory will not adopt a code-first workflow. The learning curve is steep for non-programmers.
- **NEXUS lesson:** Never try to be a weaker version of AutoCAD. Target corners where existing tools fail: simultaneous collaboration, AI assistance, tablet use on job sites, or unified BIM+GIS+Civil in one tool.

### Speckle -- Platform, not a replacement

- **What they do:** Position as a data exchange platform, not a replacement for Revit/AutoCAD. Connectors plug into existing tools. Users keep their existing workflows and tools; Speckle adds collaboration and interoperability on top.
- **What works:** Zero learning curve for the core workflow -- users keep their existing tools. Speckle adds value without requiring workflow change.
- **What fails:** Users who want an alternative to proprietary tools get nothing -- Speckle requires existing licenses for Revit, AutoCAD, etc.
- **NEXUS lesson:** Speckle's approach is complementary to NEXUS's. NEXUS IS the alternative tool. But the import/export strategy (support DXF, IFC, GeoJSON) lets users adopt gradually -- they can keep Revit for production and use NEXUS for specific use cases.

### Text2BIM -- AI lowers the barrier to BIM authoring

- **What they do:** Natural language input ("3-storey office building with underground parking") produces a complete BIM model with walls, slabs, roofs, doors, windows, spaces, and materials. No manual CAD/BIM operation required.
- **What works:** GPT-4o achieves 99.4% pass rate on 30 quality rules. Non-BIM-experts can produce valid IFC models. The 26 high-level tool functions abstract away low-level complexity.
- **What fails:** Complex spatial conflicts (Class 3 errors) still require human intervention. Stochastic drift means the same prompt produces different quality results.
- **NEXUS lesson:** AI can dramatically lower the learning curve for conceptual design and pre-production work. Start in corners where certification requirements are lighter. The high-level command abstraction (`draw_wall` not `create_entity + add_components`) is critical for both AI and human usability.

### LangGraph.js -- Human-in-the-loop for trust building

- **What they do:** The `interrupt()` mechanism pauses AI execution, surfaces proposed actions to the user, waits for approval/edit/rejection, then resumes. The `HumanInterrupt`/`HumanResponse` protocol is typed and structured.
- **What works:** Users maintain control over AI-generated operations. The preview-approve-commit flow builds trust incrementally.
- **What fails:** Every interrupt is a context switch that slows the AI workflow. Too many interrupts and users will disable them, losing the safety benefit.
- **NEXUS lesson:** Use interrupts for high-impact operations (creating 50+ entities, modifying structural elements) but not for routine operations. Let users configure their trust threshold.

---

## Challenge 5: Plugin Ecosystem

The problem: Autodesk's real moat is 30 years of third-party plugins. Without a plugin ecosystem, even a technically superior product cannot win large customers.

### Speckle -- Connector architecture as a plugin model

- **What they do:** Each Speckle connector (Revit, Rhino, AutoCAD, Civil 3D, QGIS, ArcGIS) is effectively a plugin for the target application. The V3 architecture has a layered pattern: Bindings (host app integration) -> Operations (send/receive) -> Converters (translation logic) -> Shared Services.
- **What works:** Clean separation of concerns. Adding a new connector means implementing the Converter for that app's object model. Shared infrastructure (serialization, transport, sync) is reused.
- **What fails:** Connectors are built by the Speckle team, not by a community. The "connector" architecture is not a true plugin system -- third parties cannot easily add custom connectors without deep knowledge of Speckle internals.
- **NEXUS lesson:** Design the command system (Rule 1) and MCP tool schemas (Rule 6) as the plugin surface from day one. If every operation is a typed command with a JSON schema, plugins are just packages of new commands + UI components. The same interface works for human plugins, AI agents, and cross-app connectors.

### Zoo Design Studio -- KCL stdlib as extensible function library

- **What they do:** KCL stdlib functions (`line`, `extrude`, `fillet`, etc.) map 1:1 to modeling engine commands. The codemod layer translates GUI actions to stdlib calls. New operations are added by adding new stdlib functions.
- **What works:** The function-based extension model is clean. New operations = new functions with typed parameters.
- **What fails:** The geometry engine is cloud-hosted, so third-party extensions that need new geometry operations cannot be added without Zoo's server-side changes. The plugin boundary is limited to what KCL stdlib exposes.
- **NEXUS lesson:** NEXUS's local-first architecture (WASM kernel) gives third parties more power than a cloud-hosted engine. Plugins can include new Rust/WASM geometry operations, not just new UI commands.

### Bevy ECS -- Plugin architecture is the core design

- **What they do:** Everything in Bevy is a plugin. The entire engine is composed of plugins: `DefaultPlugins` bundles rendering, input, windowing, etc. Users add custom plugins that register systems, resources, events, and components. Plugins can depend on other plugins.
- **What works:** Clean extensibility -- new functionality is always additive. Plugins can be published as crates and composed independently. The ECS query system means plugins that add new components automatically work with existing systems that query by component presence.
- **What fails:** Plugin API stability -- Bevy's rapid evolution means plugins break across versions. No sandboxing -- plugins have full access to the World.
- **NEXUS lesson:** NEXUS Rule 4 (additive expansion) is exactly the Bevy plugin model. New domains = new components + new systems. The ECS is the plugin surface. For NEXUS, add sandboxing (WASM-based plugin isolation) for security, especially for community plugins.

### LangGraph.js -- Tool-based extensibility for AI agents

- **What they do:** Tools are defined with Zod schemas and registered with the agent. The `ToolNode` dispatches tool calls by name. New capabilities = new tools added to the agent's tool list.
- **What works:** Adding a new AI-callable operation is trivial: define a `tool()` with a Zod schema and register it. The LLM discovers capabilities via tool descriptions.
- **What fails:** No plugin marketplace or discovery mechanism. Tools must be compiled into the application.
- **NEXUS lesson:** The MCP tool schema registration pattern IS the plugin interface for AI agents. When NEXUS builds a plugin system, new plugins register both UI commands and MCP tool schemas simultaneously. An AI agent automatically discovers new capabilities.

### MCP4IFC / Text2BIM -- Tool catalogs as plugin surfaces

- **What they do:** MCP4IFC defines 50+ MCP tools organized by category (scene querying, creation, manipulation, knowledge retrieval). Text2BIM defines 26 high-level tool functions. Both serve as the interface between AI and BIM functionality.
- **What works:** The categorized tool catalog is a natural plugin boundary. New BIM capabilities = new tools in the catalog.
- **What fails:** The modular reference architecture paper (arxiv 2601.00809) notes that the Revit MCP ecosystem is already fragmenting across incompatible implementations. Without a standardized adapter layer, each plugin reimplements common patterns.
- **NEXUS lesson:** Define a standard adapter contract (Rule 6) so that the same MCP tool definitions work across different backends. When multiple BIM backends are supported (web-ifc, IfcOpenShell, future native kernel), plugins should not need to know which backend is active.

---

## Challenge 6: Trust and Certification

The problem: in real engineering, software output must be defensible in court. Established products have decades of certifications. A new product has none. This is a non-technical barrier that kills projects.

### Text2BIM -- Rule-based validation as a trust proxy

- **What they do:** 30 predefined rules via Solibri Model Checker validate every AI-generated BIM model. Rules cover geometric validity (no clashing components), semantic correctness (proper IFC attributes), spatial consistency (roof supported by walls), and topological checks (doors in walls, not floating).
- **What works:** GPT-4o achieves 99.4% pass rate. The rule-based validation catches errors that LLMs cannot self-detect. BCF-format error reports provide structured feedback for iterative correction.
- **What fails:** Class 3 (open-ended spatial) errors still require human judgment. Rule coverage is limited to 30 rules -- real certification requires thousands of checks. No formal certification of the rule engine itself.
- **NEXUS lesson:** Build domain-specific validation rules from day one. Even without formal certification, automated validation builds user confidence. Start with geometry validity and constraint satisfaction. The validation layer is also essential for AI-generated operations. Target conceptual design and pre-production work where certification requirements are lighter.

### Speckle -- Audit trail via content-addressable versioning

- **What they do:** Every object is immutable with a SHA256 content hash. Every version (commit) points to a root hash. The full history of changes is preserved. Diffing between versions compares object hashes.
- **What works:** Complete audit trail -- who changed what, when. Content-addressable storage prevents tampering. Version comparison is efficient (hash comparison).
- **What fails:** Snapshot-based versioning only captures WHAT changed, not WHY. No intent captured. No formal link to design standards or regulations.
- **NEXUS lesson:** NEXUS's event sourcing captures both WHAT and WHY (command name, parameters, user, timestamp). This is strictly better than snapshot-based versioning for audit purposes. Combined with Yjs `gc: false` for full history preservation, NEXUS has a stronger audit story than Speckle.

### web-ifc -- IFC schema compliance as trust anchor

- **What they do:** Auto-generate type definitions and serializers from official IFC EXPRESS schemas (IFC2X3, IFC4, IFC4X3). CRC32 type codes from uppercase IFC type names. Schema generator parses `.exp` files and produces both TypeScript and C++ code.
- **What works:** IFC is the international standard (ISO 16739) for BIM data exchange. Producing valid IFC files is a trust signal for the AEC industry. The schema generator ensures type-correctness.
- **What fails:** web-ifc can write invalid IFC (no validation on write). No automatic relationship management. No parametric regeneration.
- **NEXUS lesson:** When NEXUS adds IFC export (v0.3), validate against the IFC schema before writing. Use schema generation from EXPRESS files -- never hand-code 876+ entity types. IFC compliance is a trust anchor even before formal certification.

### Yjs -- Immutable event history for forensic audit

- **What they do:** Every mutation creates Items in a doubly-linked list with globally unique IDs (clientID + Lamport clock). With `gc: false`, the entire history of every change is preserved. Snapshots (`Y.snapshot(doc)`) can reconstruct past state at any point.
- **What works:** Complete forensic audit trail. Every change attributed to a specific client. Time-travel to any historical state. CRDT properties guarantee convergence -- all clients agree on the final state.
- **What fails:** No semantic layer -- the audit trail is at the property level, not the operation level. "User A set entity 42's x to 100" is less meaningful than "User A moved entity 42 by (10, 0)".
- **NEXUS lesson:** Combine Yjs property-level history with NEXUS's command-level audit log. The audit log records "MoveEntity(42, dx=10, dy=0) by User A at timestamp T" while Yjs tracks the precise property changes. Both layers are needed for full AEC compliance (ISO 19650 audit trail).

### CesiumJS -- OGC standards compliance

- **What they do:** Implements OGC 3D Tiles standard for streaming spatial data. Supports WMS, WMTS, WFS for map services. Uses WGS84 ellipsoid and standard geographic projections.
- **What works:** Standards compliance enables interop with existing GIS infrastructure. 3D Tiles is becoming the industry standard for web-based 3D geospatial data.
- **What fails:** No engineering-specific standards (ISO 19650 for BIM, etc.). CesiumJS is a visualization tool, not an engineering analysis tool.
- **NEXUS lesson:** Support OGC standards (3D Tiles, WMS, WFS) for GIS interop. Support IFC for BIM interop. Standards compliance builds trust incrementally even without formal software certification.

---

## Summary Matrix

| Repo | Ch1 Numerical | Ch2 Memory | Ch3 Concurrency | Ch4 UX | Ch5 Plugins | Ch6 Trust |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **CADmium** | ignored | partial | ignored | N/A | ignored | ignored |
| **Zoo Design Studio** | N/A (cloud engine) | N/A (cloud engine) | solved (cloud) | partial | partial | ignored |
| **LangGraph.js** | N/A | N/A | partial | partial | partial | N/A |
| **Chili3D** | partial | ignored | ignored | N/A | ignored | ignored |
| **replicad** | partial | solved | ignored | N/A | ignored | ignored |
| **web-ifc** | partial | partial | ignored | N/A | ignored | partial |
| **Yjs** | N/A | partial | solved | N/A | N/A | partial |
| **Bevy ECS** | N/A | solved | partial | N/A | solved | N/A |
| **Speckle** | N/A | partial | N/A | solved | partial | partial |
| **CesiumJS** | solved | partial | partial | N/A | N/A | partial |
| **Potree** | partial | partial | partial | N/A | N/A | N/A |
| **Text2BIM** | N/A | N/A | N/A | partial | partial | partial |

### Rating Legend
- **solved**: Comprehensive solution that NEXUS can adopt directly
- **partial**: Addresses the challenge but with significant gaps or limitations
- **ignored**: The challenge exists for this repo but is not addressed
- **N/A**: The challenge does not apply to this repo's domain
