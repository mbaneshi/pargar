# Six Real Challenges of Building Autodesk-Class Software on the Web

> **Context:** These six challenges can each independently kill a browser-native AEC platform. This document defines each challenge, maps it to NEXUS's specific architecture, and proposes a concrete methodology for tackling it — informed by our 12 deep research findings, existing codebase, and web research.
>
> Created: 2026-04-13
> References: `docs/research/findings/00-consolidated-lessons.md`, `docs/brief/06-testing-strategy.md`

---

## Challenge 1: Numerical Stability in Geometric Operations

### The Problem

When you intersect surfaces, perform boolean operations, or project curves, limited floating-point precision causes: edges that should meet don't, polygons that should be closed have microscopic gaps, points that fall slightly off surfaces. Commercial kernels spent 30 years building "tolerant geometry" — every entity carries its own tolerance. Open-source kernels handle this weakly or not at all.

### Why It Matters for NEXUS

NEXUS uses Rust f64 for geometry computation (v0.1: 2D lines, arcs, circles, polylines). The 2D case is manageable. The danger zone arrives at:
- **v0.2 (3D):** OCCT boolean operations through WASM are notorious for edge-case failures
- **v0.4 (GIS):** Coordinates at UTM scale (500,000+ meters) where float64 still has precision limits
- **v0.5 (Civil):** 50km+ alignments where accumulated error matters for surveying

### NEXUS-Specific Solution Methodology

**Phase 1 — v0.1 (Now): Tolerance Infrastructure**

```
Principle: Make tolerance a first-class citizen in the data model from day one.
```

1. **Define a global tolerance constant hierarchy** in `@nexus/kernel`:
   ```rust
   pub const GEOMETRIC_EPSILON: f64 = 1e-8;      // Point coincidence
   pub const ANGULAR_EPSILON: f64 = 1e-10;        // Parallel/perpendicular detection
   pub const PARAMETRIC_EPSILON: f64 = 1e-12;     // Curve parameter space
   pub const INTERSECTION_TOLERANCE: f64 = 1e-7;  // Line/arc intersection
   ```
   - These are already partially defined in `docs/brief/06-testing-strategy.md` Section 6.4. Promote them to code.
   - Every geometric comparison uses these — never inline `0.001` or `f64::EPSILON`.

2. **Use robust geometric predicates** for critical operations:
   - **Shewchuk's exact arithmetic predicates** — `orient2d`, `incircle` use adaptive precision that falls back to exact arithmetic only when needed. Available in Rust via the `robust` crate.
   - For point-on-line, line intersection, and collinearity tests, these eliminate the epsilon ambiguity entirely.
   - Cost: ~2x slower than naive, but only on degenerate cases. Normal cases are fast-path.

3. **Validate geometry after every mutation:**
   ```rust
   fn validate_geometry(geom: &GeometryType) -> Result<(), GeometryError> {
       match geom {
           Line { start, end } => {
               if distance(start, end) < GEOMETRIC_EPSILON {
                   return Err(GeometryError::DegenerateLine);
               }
           }
           Circle { radius, .. } => {
               if radius.abs() < GEOMETRIC_EPSILON {
                   return Err(GeometryError::DegenerateCircle);
               }
           }
           // ... per-type validation
       }
       Ok(())
   }
   ```
   - Run this in the command `execute()` path — reject degenerate geometry before it enters the event store.

4. **WASM float determinism is guaranteed** — the WebAssembly spec guarantees that all f64 operations with non-NaN inputs produce bit-identical results across V8, SpiderMonkey, and WebKit. Guard NaN at kernel entry points and you get full cross-browser determinism.

**Phase 2 — v0.2 (3D): Geometry Healing Layer**

5. **Wrap every OCCT boolean operation** in a healing pipeline:
   ```
   Input validation → OCCT operation → Result check → Heal if needed → Final validation
   ```
   - OCCT's `BRepAlgoAPI_Check` validates inputs before boolean ops
   - `ShapeFix_Shape` repairs topology errors after operations (sewing gaps, removing degenerate edges)
   - `BRepCheck_Analyzer` verifies the output solid is valid
   - If healing fails, retry with loosened tolerance (OCCT's `BOPAlgo_PaveFiller` supports tolerance adjustment)

6. **Adopt OCCT's per-entity tolerance model:**
   - Every vertex, edge, and face carries its own tolerance value
   - Algorithms consult these when deciding if two things are "the same"
   - When importing from STEP/IFC, preserve source tolerances
   - Our ECS component: `Tolerance { value: f64 }` attached to entities with B-Rep geometry

7. **Use Manifold** (Google) for mesh booleans as a fallback:
   - Manifold guarantees manifold output — if OCCT fails, tessellate both inputs and use Manifold
   - Loss: you get mesh, not B-Rep. But a mesh result is better than a crash.

**Phase 3 — v0.4+ (GIS/Civil): Large-Coordinate Precision**

8. **Floating-origin / RTC rendering** (from CesiumJS findings):
   - Maintain a float64 Scene Origin in the ECS
   - All GPU coordinates are small offsets from this origin (float32 safe)
   - Re-center when camera drifts > 5km
   - For 50km+ civil alignments: split into segments with local origins

9. **Property-based testing for numerical stability:**
   - Use `proptest` (Rust) to generate random geometric inputs including edge cases
   - Invariants: "intersection of two lines always produces a valid point or None", "boolean of two valid solids produces a valid solid or an error, never garbage"
   - Run these in CI — catch precision regressions before users do

### Key Libraries
| Library | Purpose | When |
|---------|---------|------|
| `georust/robust` (Rust crate) | Shewchuk adaptive precision predicates (`orient2d`, `incircle`) — exact for sign tests, ~2-4x cost only on degenerate cases | v0.1 |
| `geo` (Rust crate) | 2D boolean ops with snap rounding internally — eliminates near-coincident bugs | v0.1 |
| `ShapeFix_Shape` (OCCT) | Post-operation geometry healing — gap filling, small edge removal, re-parameterization | v0.2 |
| `BRepCheck_Analyzer` (OCCT) | Solid validation — same tool FreeCAD's "Check Geometry" wraps | v0.2 |
| `manifold-3d` (npm, ~2MB WASM) | Google's guaranteed-manifold mesh booleans — fallback when OCCT fails | v0.2 |
| `proptest` (Rust crate) | Property-based fuzzing for geometry invariants | v0.1 |

### Key Insight: WASM Float Determinism
WebAssembly spec guarantees f64 ops with non-NaN inputs/outputs are **bit-identical across all browsers** (V8, SpiderMonkey, WebKit). Guard NaN at kernel entry with `.is_finite()` and you get full cross-browser determinism. Rust on wasm32 honors IEEE 754 strictly — no `fast-math` unless explicitly opted in.

### OCCT-Specific: Per-Entity Tolerance Model
OCCT invariant: `Tol(Vertex) >= Tol(Edge) >= Tol(Face)`. Boolean ops use `FuzzyValue` parameter — set it smaller than shortest edge to preserve. Store as ECS component: `Tolerance { value: f64 }`. Boolean failures in opencascade.js are most often `FuzzyValue` misconfiguration, not WASM bugs. Run all boolean ops single-threaded in a dedicated Web Worker (multi-threaded WASM can segfault in `BRepAlgoAPI_BooleanOperation`).

---

## Challenge 2: Memory Management and Object Lifetime in the Browser

### The Problem

Multi-GB geometric data in the browser makes the JS garbage collector your enemy — GC pauses cause stutter. WASM has its own memory, but the JS↔WASM bridge is expensive. Every object crossing the boundary is either copied or becomes a reference requiring manual freeing.

### Why It Matters for NEXUS

NEXUS currently transfers entity data as JSON across the WASM bridge (`get_entities_json()`, `flush_changes()`). At 100-1000 entities this is fine. At 50k (BIM) or 100k+ (GIS), JSON serialization becomes the bottleneck. OCCT objects (v0.2) live on the WASM heap and leak aggressively without explicit `delete()`.

### NEXUS-Specific Solution Methodology

**Phase 1 — v0.1 (Now): Minimal Bridge Discipline**

1. **Rust owns ALL heavy data. JS gets handles, not objects:**
   ```
   Current:  kernel.get_entities_json() → JSON string → JS parse → Three.js
   Better:   kernel.get_entity_count() → number
             kernel.get_entity_vertices(id) → Float32Array view into WASM memory
   ```
   - The `flush_changes()` pattern already does incremental sync (dirty IDs + deleted IDs). Keep this.
   - For v0.1, JSON is acceptable. Document the migration path.

2. **Pre-allocate a render buffer in WASM memory:**
   ```rust
   // In Rust kernel
   static mut RENDER_BUFFER: Vec<f32> = Vec::new();

   #[wasm_bindgen]
   pub fn get_render_buffer_ptr() -> *const f32 { RENDER_BUFFER.as_ptr() }

   #[wasm_bindgen]
   pub fn get_render_buffer_len() -> usize { RENDER_BUFFER.len() }
   ```
   ```typescript
   // In JS — zero-copy read from WASM memory
   const ptr = kernel.get_render_buffer_ptr();
   const len = kernel.get_render_buffer_len();
   const view = new Float32Array(kernel.memory.buffer, ptr, len);
   geometry.setAttribute('position', new THREE.BufferAttribute(view, 3));
   ```
   - This is a view into WASM linear memory — no copy. Three.js reads directly from Rust's buffer.
   - Caveat: the view is invalidated if WASM memory grows. Re-create views after any operation that might grow memory.

**Phase 2 — v0.2 (3D): OCCT Memory Management**

3. **Adopt replicad's three-tier cleanup** (from findings `05-replicad.md`):
   - **FinalizationRegistry wrapper** — safety net for GC-collected objects
   - **Scope-based cleanup (`GCWithScope`)** — intermediate objects freed when scope ends
   - **Deterministic cleanup (`localGC`)** — explicit free after command execution
   ```
   Command execution:
     1. Create localGC scope
     2. Register all OCCT temporaries
     3. Execute operation
     4. Extract result
     5. gc() — frees all temporaries deterministically
   ```

4. **Monitor WASM heap pressure:**
   ```typescript
   const heapUsage = kernel.memory.buffer.byteLength;
   if (heapUsage > 512 * 1024 * 1024) { // 512MB
       kernel.compact_geometry_cache();
       console.warn('WASM heap pressure:', heapUsage);
   }
   ```

**Phase 3 — v0.3+ (BIM/GIS): Binary Transfer Protocol**

5. **Replace JSON bridge with binary protocol:**
   - Entity geometry as `Float64Array` (positions) + `Uint32Array` (indices)
   - Display mesh as `Float32Array` (GPU-ready vertices) + `Uint32Array` (triangle indices)
   - Metadata as MessagePack or FlatBuffers (not JSON)
   - Estimated 10-50x faster than JSON.parse for large entity sets

6. **Geometry LOD cache with LRU eviction** (from Potree findings):
   - Off-screen entities: evict display mesh, keep parametric definition
   - On-screen entities: full display mesh in GPU memory
   - Budget: track total GPU buffer bytes, evict least-recently-rendered first

### Key Libraries & Patterns
| Library | Purpose | When |
|---------|---------|------|
| `wasm-bindgen` views | Zero-copy WASM→JS via `Float32Array` view into `wasm.memory.buffer` | v0.1 |
| WebGL2 offset `bufferData` | Pass WASM buffer views directly — Emscripten measured 3-7% gains | v0.1 |
| FinalizationRegistry | GC safety net — but browsers can stop calling finalizers under memory pressure. Use `Symbol.dispose` as primary, FR as fallback. | v0.2 |
| `localGC` pattern (replicad) | Deterministic command-scoped cleanup after each execute() | v0.2 |
| `wee_alloc` (Rust) | 1KB WASM allocator, smaller than default dlmalloc | v0.2 |
| Comlink (Google, 3KB) | Ergonomic async proxy for Web Worker communication | v0.2 |
| FlatBuffers / MessagePack | Binary entity serialization replacing JSON | v0.3 |
| OPFS streaming | Photoshop-on-Web pattern: use OPFS as virtual swap for documents > RAM. Already in our codebase. | v0.3 |

### Key Insight: Figma's Memory Playbook
Figma stores document state as **deltas** (our event log already does this). Load layers lazily — only materialize geometry for the visible viewport. Separate WASM renderer from WASM compute kernel. 4GB hard cap per tab in modern browsers (Memory64). Cap at 4GB - 1 page to avoid browser bugs.

### Key Insight: WASM Memory Cannot Shrink
WASM linear memory can only grow, never shrink. Use geometric overgrowth (`MEMORY_GROWTH_GEOMETRIC_STEP=0.5` — 50% overgrowth) to avoid repeated `.grow()` calls that cause GC-visible stutter. Pre-size arenas per domain (64MB active drawing, 256MB loaded file).

---

## Challenge 3: Concurrency and Threading

### The Problem

Desktop CAD uses every CPU core. Browser main thread cannot block or everything freezes. Web Workers have separate memory, communicating only by message passing. Algorithms must be partitioned into independent chunks.

### Why It Matters for NEXUS

Currently: ALL Rust/WASM operations run on the main thread. At v0.1 scale (100-1000 entities, simple 2D ops), this is fine — operations complete in microseconds. At v0.2+ scale (OCCT booleans: 50-500ms, constraint solving: 10-100ms, tessellation: 100ms+), main-thread execution causes visible UI freezes.

### NEXUS-Specific Solution Methodology

**Phase 1 — v0.1 (Now): Message-Oriented Architecture (No Workers Yet)**

1. **The command system IS the message protocol:**
   ```
   Command JSON → execute_command() → CommandResult JSON
   ```
   - This is already message-shaped. Moving it to a worker later requires zero API changes.
   - The Svelte UI dispatches commands. The kernel processes them. Results flow back.
   - No synchronous kernel calls from UI except read-only queries.

2. **Design rule: Commands are serializable. Always.**
   - Every `Command` variant is `Serialize + Deserialize`.
   - Every `CommandResult` is `Serialize + Deserialize`.
   - This means they can cross a `postMessage` boundary unchanged.

**Phase 2 — v0.2 (3D): Kernel Worker**

3. **Move WASM kernel to a dedicated Web Worker:**
   ```
   Main Thread                    Kernel Worker
   ┌─────────────────┐            ┌─────────────────┐
   │ Svelte UI        │  command   │ WASM Kernel      │
   │ Three.js render  │ ────────→ │ execute_command() │
   │ Input handling   │ ←──────── │ CommandResult     │
   └─────────────────┘  result    └─────────────────┘
                    postMessage
   ```
   - Use **Comlink** (Google, 3KB) to make worker calls feel like async functions:
     ```typescript
     // main thread
     const kernel = wrap(new Worker('kernel-worker.js'));
     const result = await kernel.execute_command(json); // feels sync, runs in worker
     ```
   - Kernel worker owns ALL WASM memory. Main thread never touches geometry directly.
   - Display meshes transferred via `Transferable` (zero-copy ArrayBuffer transfer).

4. **Async UI pattern:**
   ```typescript
   async function executeTool(command: Command) {
       showSpinner(); // or optimistic preview
       const result = await kernel.execute_command(JSON.stringify(command));
       hideSpinner();
       applyChanges(result);
   }
   ```
   - For fast ops (<16ms): feels instant. For slow ops (boolean: 500ms): spinner/preview.
   - Preview: render a ghost of the expected result while kernel computes exact geometry.

**Phase 3 — v0.3+ (BIM): Parallel Workers**

5. **wasm-bindgen-rayon** for parallel geometry processing:
   - Rust's `rayon` parallel iterators compiled to WASM using Web Workers
   - Requires: `SharedArrayBuffer` + COOP/COEP headers on server
   - Use case: tessellating 10,000 BIM elements in parallel across 4-8 workers
   - Setup: `wasm-bindgen-rayon` crate + `rayon::ThreadPool` backed by Web Workers

6. **OffscreenCanvas** for worker-side rendering:
   - Three.js can render in a worker via OffscreenCanvas (experimental but growing support)
   - Eliminates main-thread rendering bottleneck for complex scenes
   - Fallback: keep rendering on main thread, just move computation to worker

### Architecture Diagram — Target State

```
Main Thread                  Kernel Worker              Render Worker (future)
┌───────────────┐            ┌───────────────┐          ┌───────────────┐
│ Svelte 5 UI   │  commands  │ WASM Kernel   │  meshes  │ Three.js      │
│ Input events  │ ────────→  │ ECS + Events  │ ───────→ │ OffscreenCanvas│
│ DOM updates   │ ←────────  │ Constraints   │          │ WebGL/WebGPU  │
│ Tool state    │  results   │ OCCT (v0.2)   │          │               │
└───────────────┘            └───────────────┘          └───────────────┘
                    Comlink       SharedArrayBuffer / Transferable
```

### Key Libraries & Patterns
| Library | Purpose | When |
|---------|---------|------|
| Comlink (Google, 3KB) | Transparent async proxy — `const result = await kernel.execute_command(json)` feels sync, runs in worker | v0.2 |
| `wasm-bindgen-rayon` (GoogleChromeLabs) | Rust `rayon` parallel iterators as Web Worker thread pool over `SharedArrayBuffer`. Drop-in `par_iter()` for boolean ops, tessellation, spatial queries. | v0.3 |
| OffscreenCanvas | Three.js rendering in a worker — main thread fully unblocked. Babylon.js uses this in production. | v0.4+ |
| `wasm-bindgen-futures` | Async Rust in WASM — use `spawn_local` for I/O tasks on kernel worker | v0.2 |

### Key Requirement: COOP/COEP Headers
`SharedArrayBuffer` (required for wasm-bindgen-rayon) is gated behind cross-origin isolation:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
Set in SvelteKit `vite.config` for dev, Vercel middleware for production. Without these, `SharedArrayBuffer` throws at runtime.

### Performance Benchmark
JSON message passing for large vertex buffers: ~7 fps. Transferable `ArrayBuffer` or `SharedArrayBuffer`: 25+ fps. The difference is 3-4x for geometry-heavy operations.

---

## Challenge 4: Learning Curve and Professional User Expectations

### The Problem

A civil engineer with 20 years of Civil 3D has hundreds of keyboard shortcuts in muscle memory. If an operation takes half a second that's instant on desktop, they get frustrated. You can't win by being a weaker version of an existing product.

### Why It Matters for NEXUS

NEXUS is targeting professional drafters and engineers. AutoCAD's UX conventions are hardcoded in their brains. If NEXUS deviates from expected behavior without providing something dramatically better, users won't switch.

### NEXUS-Specific Solution Methodology

**Strategy: Don't compete on existing workflows. Win on impossible-on-desktop workflows.**

1. **Match AutoCAD conventions where they cost nothing to implement:**
   - Already done: AutoCAD command aliases (L, C, A, PL, REC, M, CO, RO, E, O, TR, MI, SC)
   - Already done: Command line input, coordinate entry (@dx,dy), ORTHO (F8), SNAP (F3)
   - Already done: Enter/Space repeats last command
   - Still needed: Right-click context menus, more shortcuts, object selection filters

2. **Win on what desktop can't do:**

   | Desktop Can't | NEXUS Can | User Value |
   |---------------|-----------|------------|
   | Real-time collaboration | Yjs CRDT (v0.3) | Two drafters edit same drawing simultaneously |
   | AI copilot | MCP agent (post-v0.1) | "Draw a 10m x 8m room with a door on the south wall" |
   | Zero install | Browser-native | Open a link, start drawing. No IT department. |
   | Mobile/tablet | Responsive web | Review drawings on jobsite iPad |
   | Version history | Event sourcing | Time-travel: "show me what this looked like Tuesday" |
   | Plugin marketplace | WASM sandboxed plugins | Install a plugin in one click, runs instantly |

3. **Target users who DON'T have AutoCAD:**
   - Small engineering firms that can't afford $2,000/year/seat
   - Construction managers who need to view and markup, not author
   - Students learning CAD
   - International markets where piracy is the only alternative
   - These users have no muscle memory to fight against

4. **Measure where you are vs expectations:**
   - Sprint 9 user test: recruit 3 drafters (1 AutoCAD user, 1 casual user, 1 non-user)
   - Task: draw a simple floor plan. Measure time-to-complete, error count, frustration points
   - Iterate on the top 3 frustrations before shipping

### Priority Note from the Challenge Statement

> "For a solo founder, challenges four and five matter most, because technical challenges have solutions while human and ecosystem challenges don't."

This is correct. NEXUS's technical architecture is solid. The risk is that no one uses it. The methodology:
- **Ship v0.1 to 10 real users within 30 days**
- **Watch them use it in person** (screen share minimum)
- **Fix the top 3 UX blockers** they identify
- **Repeat** every 2 weeks

---

## Challenge 5: Plugin Ecosystem

### The Problem

The real power of Autodesk products is the tens of thousands of third-party plugins. If your product has no plugin ecosystem, even if the core is better, you can't win enterprise customers.

### Why It Matters for NEXUS

NEXUS's command system + MCP tool schemas + ECS architecture is already designed for extensibility. But a "technically extensible" system is not an ecosystem. An ecosystem requires: documentation, distribution, trust, and a critical mass of developers.

### NEXUS-Specific Solution Methodology

**Phase 1 — v0.1: The Command System IS the Plugin API**

1. **Every `Command` variant is a plugin API surface:**
   ```json
   {"type": "CreateLine", "x1": 0, "y1": 0, "x2": 10, "y2": 5, "layer_id": "layer_0"}
   ```
   - Third-party code sends JSON commands through `execute_command()`.
   - No special plugin SDK needed — just JSON over a bridge.
   - This is the same interface AI agents use (Rule 6).

2. **MCP tools = plugin tools:**
   - When MCP server is built (POST-2), every tool is callable by any MCP client
   - AI agents, scripts, browser extensions, external apps — all use the same interface
   - The plugin ecosystem starts as the MCP tool catalog

**Phase 2 — v0.3: Sandboxed Plugin Runtime**

3. **Figma's model (proven at scale):**
   - Plugin code runs in a **sandboxed iframe** with no direct DOM access
   - Plugin communicates with NEXUS via `postMessage` (same pattern as Worker)
   - Plugin can call any `Command` and read entity state
   - Plugin CANNOT access file system, network (unless explicitly granted), or other plugins
   ```
   ┌─────────────────────┐        ┌──────────────────┐
   │ NEXUS Main App      │        │ Plugin iframe     │
   │                     │ ←────→ │ (sandboxed)       │
   │ execute_command()   │  msg   │ calls commands    │
   │ get_entities()      │        │ reads state       │
   └─────────────────────┘        └──────────────────┘
   ```

4. **WASM plugins** (for computation-heavy extensions):
   - Use **Extism** (universal WASM plugin system) — load third-party WASM modules
   - Plugin WASM runs in its own linear memory — can't corrupt host
   - Capabilities granted explicitly (file access, network, etc.)
   - Use case: structural analysis plugin, MEP routing plugin, cost estimation plugin

**Phase 3 — v0.5+: Marketplace**

5. **Plugin manifest + registry:**
   ```json
   {
     "name": "structural-analysis",
     "version": "1.0.0",
     "commands": ["analyze_beam", "check_deflection"],
     "permissions": ["read_entities", "create_entities"],
     "runtime": "wasm"  // or "iframe"
   }
   ```
   - Install = download WASM + manifest, register commands
   - NEXUS's command registry automatically exposes new commands to CLI, GUI menus, and AI agents

6. **AI agents ARE plugins:**
   - A LangGraph agent that specializes in MEP design is functionally a plugin
   - It reads entities, calls commands, creates geometry — same as any plugin
   - The MCP protocol is the plugin protocol for AI
   - This means NEXUS gets "AI plugins" for free when the MCP server ships

### Key Libraries & Patterns
| Library | Purpose | When |
|---------|---------|------|
| iframe + `postMessage` | Figma's model — sandboxed JS plugins with no direct DOM/document access | v0.3 |
| Extism | Universal WASM plugin framework — bytes-in/bytes-out ABI, capability grants, runtime limiters | v0.5 |
| waPC | WebAssembly Procedure Calls — standardized host↔guest invocation, format-agnostic | v0.5 |
| WASI Preview 2 | Component Model — plugins declare typed interfaces via WIT files, type-level isolation | v0.6+ |
| MCP dynamic tool updates | Tools registered/deregistered at runtime — domain plugins become MCP tool bundles | v0.3 |

### Figma's Proven Isolation Architecture
Figma splits plugin execution into two threads: a **Realms JS sandbox** (no browser APIs, direct document model access) and a **sandboxed iframe** (browser APIs, no document access). Communication exclusively via `postMessage` with strict origin checks. This prevents filesystem/network escapes while keeping JS JIT performance.

### AutoCAD's Lesson: Avoid the In-Process Trap
AutoCAD's trajectory (AutoLISP 1986 → ADS C → ObjectARX C++ DLLs → .NET/COM) shows the gravity trap: in-process DLLs give power but lock plugin versions to host versions. The browser WASM sandbox avoids this entirely — plugins can't crash the host.

### The Ecosystem Bootstrap Problem

> Building an ecosystem requires a critical mass of developers. How to start?

- **Start with internal plugins:** Build BIM, GIS, and Civil modules as plugins on your own command API. This validates the API before external developers use it.
- **Target AI agent developers first:** MCP ecosystem is growing explosively. AI developers building agents need tools (CAD, BIM, GIS). NEXUS's MCP server makes it a target — they bring the "plugin" ecosystem.
- **Open the command schema publicly:** Publish JSON schema for all commands. Anyone can build a tool that generates command JSON — no SDK needed.
- **Speckle Kit pattern:** Each domain plugin exports a geometry converter + command bundle, hot-swappable into the existing ECS world.

---

## Challenge 6: Trust and Certification

### The Problem

In real engineering, software output must be defensible in court. If a bridge collapses, the engineer must prove the software calculated according to accepted standards. New products have zero certification track record.

### Why It Matters for NEXUS

NEXUS targets AEC — an industry where software output has legal liability. Structural calculations, survey deliverables, and civil designs must meet professional standards. A new product can't claim "our algorithm is correct" — it needs proof.

### NEXUS-Specific Solution Methodology

**Strategy: Start where certification requirements are lightest, build trust incrementally.**

1. **v0.1 target: Conceptual design and drafting only**
   - Drawing lines and shapes has no certification requirement
   - DXF export to established tools (AutoCAD, LibreCAD) for final production
   - NEXUS is the "fast authoring" tool; established tools sign off on the result

2. **Event sourcing IS an audit trail (Rule 2):**
   - Every `EventEnvelope` records: who (Actor), what (CadEvent), when (timestamp), which version (schema_version)
   - This is more auditable than any desktop CAD (which has no built-in change tracking)
   - When AI agents make edits, `Actor::Agent { agent_id, model }` distinguishes human vs AI work
   - ISO 19650 (BIM information management) requires exactly this kind of audit trail

3. **Build trust through transparency:**
   - Open-source kernel: anyone can audit the geometry algorithms
   - Property-based tests in CI: publish test results showing algorithm correctness
   - DXF round-trip tests: prove NEXUS output matches industry tools
   - Reproducible results: WASM float determinism means same input = same output on every browser

4. **Gradual certification path:**

   | Phase | Trust Level | How |
   |-------|-------------|-----|
   | v0.1 | "I can draw with this" | DXF round-trip to AutoCAD proves geometry correct |
   | v0.3 | "I can export BIM from this" | IFC validation (buildingSMART mvd checker) |
   | v0.5 | "I can design roads with this" | Compare alignments against Civil 3D output |
   | v1.0 | "I can stamp drawings from this" | Third-party audit of geometry kernel accuracy |

5. **Leverage domain expertise:**
   - You (the founder) are a geomatic engineer. Your domain knowledge IS the initial certification.
   - Document calculation methods with references to standards (e.g., "horizontal curve computed per AASHTO 2018 Chapter 3")
   - When users ask "how does this calculate X?", point to the algorithm source + standard reference

---

## Methodology Summary: How to Tackle All Six

### Execution Timeline

```
v0.1 (NOW — ship in 3 sprints):
  ✅ Tolerance constants in kernel
  ✅ Command system = serializable messages (future worker-ready)
  ✅ Event envelope = audit trail from day one
  ✅ AutoCAD conventions matched
  → Ship. Get 10 users. Watch them use it.

v0.2 (3D CAD):
  → OCCT memory management (FinalizationRegistry + localGC)
  → Geometry healing layer (ShapeFix + BRepCheck)
  → Kernel Worker (Comlink)
  → Plugin API v1 (iframe sandbox)

v0.3 (BIM):
  → Binary transfer protocol (replace JSON bridge)
  → Yjs collaboration (multiplayer = killer differentiator)
  → IFC validation against buildingSMART checker
  → WASM plugin runtime (Extism)

v0.4 (GIS):
  → Floating origin / RTC rendering
  → wasm-bindgen-rayon for parallel processing
  → Publish command schemas for plugin developers

v0.5 (Civil):
  → Emulated double precision for large coordinates
  → Algorithm documentation with standards references
  → Civil calculation validation against desktop tools
```

### Priority Framework

The challenge statement says: *"For a solo founder, challenges four and five matter most."* This is correct.

| Challenge | Technical Risk | Market Risk | When to Address |
|-----------|---------------|-------------|-----------------|
| 1. Numerical Stability | High | Low (users don't see it if you handle it) | v0.1 infrastructure, v0.2 healing |
| 2. Memory Management | Medium | Low (performance, not functionality) | v0.2 workers, v0.3 binary |
| 3. Concurrency | Medium | Low | v0.2 kernel worker |
| 4. Learning Curve | Low | **Critical** | v0.1 user testing NOW |
| 5. Plugin Ecosystem | Low | **Critical** | v0.1 command API, v0.3 sandbox |
| 6. Trust/Certification | Low | High (but slow-burn) | Every version, incrementally |

### The One-Line Methodology

**Ship fast (technical challenges have solutions), then watch real users (human challenges don't).**

Every technical challenge in this document has a concrete library, algorithm, or pattern that solves it. The market challenges (4, 5, 6) only resolve through real usage, real feedback, and real trust built over time. The methodology is: solve technical problems preemptively with architecture, solve human problems reactively with user testing.
