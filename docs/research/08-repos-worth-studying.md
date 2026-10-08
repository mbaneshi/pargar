# NEXUS — Repos Worth Studying (and What to Steal)

> Not "what to integrate" — that's in `06-ecosystem-integration-analysis.md`.
> Not "what to prioritize" — that's in `07-oss-exploration-priority-matrix.md`.
> This is: **what to clone, read source code, and learn engineering lessons from**.
>
> Wearing the hat of: a builder who wants to avoid mistakes others already made.
>
> Created: 2026-04-12

---

## The 13 Repos That Will Make You a Better NEXUS Builder

Ranked by **learning density** — how much transferable engineering insight per hour of study.

> **13th entry added 2026-09-22.** `02-open-source-tools-catalog.md` already flagged OpenCAD Studio as "the closest **architectural** analog" back in v2.2, but it never got the full study writeup the other 12 got here. This closes that gap after actually cloning it and reading `src/`, `crates/ocs_plugin_api/`, and `docs/`.

---

### 1. CADmium — Your Mirror Image

**Clone:** `github.com/CADmium-Co/CADmium`
**Time:** 8-10 hours (deepest study on this list)
**Language:** Rust + TypeScript + Svelte

This is the only project on Earth with nearly identical architecture to NEXUS: Rust/WASM kernel + SvelteKit + Three.js. They're 12-18 months ahead. Every hard problem you'll hit, they already hit.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| `packages/cadmium/src/` (Rust kernel) | How they structure the Rust side: project → workbench → sketch → solid. Their entity model is NOT ECS — it's hierarchical. Study why, and confirm ECS is better for multi-domain. |
| WASM bridge layer | How they serialize complex geometry across the bridge. Are they using JSON? serde? SharedArrayBuffer? Their choices reveal performance trade-offs you'll face. |
| Svelte ↔ Three.js wiring | How they handle reactive state flowing into Three.js without triggering full re-renders. This is the hardest UI problem in browser CAD. |
| Truck kernel integration | How they wrap Truck's B-Rep API. Truck is your potential 3D kernel alternative to OCCT. See what's mature and what's missing. |
| Sketch constraint handling | How they bridge between 2D sketch constraints and 3D feature tree. Informs how planegcs fits into your system. |
| Worker threading | Do they offload kernel ops to a Web Worker? How does the UI stay responsive during heavy geometry? NEXUS will need this at scale. |

**Key question to answer:** "What would break in their architecture if they tried to add BIM and GIS?" Their hierarchical model (project → workbench → sketch) probably can't accommodate GIS features or BIM property sets naturally. Your ECS can. Confirm this.

---

### 2. Zoo Design Studio (KittyCAD/modeling-app) — AI-First CAD Done Differently

**Clone:** `github.com/KittyCAD/modeling-app` ✅ Cloned + studied (2026-04-18)
**Time:** 6 hours
**Language:** Rust + TypeScript (React, NOT Svelte)

Zoo took the opposite approach: code-first (KCL language) with AI text-to-CAD. Their engine is proprietary, but the app is MIT. The most interesting thing isn't their geometry — it's their **AI ↔ CAD pipeline**.

**What we found:**
| File/Area | Finding |
|-----------|---------|
| KCL language design | KCL stdlib functions ARE their command system. No separate command objects. GUI actions are "codemods" — clone AST, insert stdlib call, return new AST. Simpler than our command pattern but can't support multi-domain (BIM/GIS). |
| AI text-to-CAD pipeline | `src/lib/promptToEdit.tsx` constructs rich semantic context — annotates selections with geometry type ("this is the end cap of a sweep extrusion, reference it via tag"), not just IDs. **Adopt this pattern for NEXUS MCP tools.** |
| Real-time preview | Cloud-only rendering — 3D viewport is a `<video>` element receiving WebSocket GPU stream. No local Three.js/WebGL. Requires internet for any operation. **Opposite of NEXUS's local-first approach — validates our decision.** |
| Error handling | `KCLError` carries partial results: `variables`, `operations`, `artifactGraph` alongside the error. UI shows what succeeded + error markers. **Adopt this: when AI commands fail, return partial results, don't roll back everything.** |
| Undo/redo | Source-code snapshots: `{ before: string, after: string }`. Undo = revert text, re-execute. AST-diff caching (`execution/cache.rs`) finds first changed node, re-executes from there (~3x speedup). |
| State management | XState finite state machines (modelingMachine, mlEphantManagerMachine, selectionMachine). No Redux/Zustand. |
| WASM bridge | serde JSON across boundary (not SharedArrayBuffer). Command batching per frame via `ModelingBatch`. TypeScript types auto-generated from Rust via `tsify`. |

**Key files worth reading:**
- `src/lib/promptToEdit.tsx` — best example of constructing rich AI context from CAD selections
- `rust/kcl-lib/src/execution/cache.rs` — AST-diff caching for incremental re-execution
- `rust/kcl-lib/src/execution/cad_op.rs` — `Operation` enum with bidirectional source↔geometry links

**Question answered:** "Is a textual DSL (like KCL) better than MCP tool calls for AI ↔ CAD?" Both valid. KCL gives composability (scripts) but locks AI into one language. MCP gives interoperability (any agent, any LLM) and extends naturally across domains. **NEXUS's MCP approach is correct for multi-domain.**

**Also cloned from KittyCAD org (2026-04-18):**
| Repo | Stars | What we learned |
|------|-------|----------------|
| `KittyCAD/ezpz` | 24 | Pure Rust constraint solver. 24 constraint types, Gauss-Newton solver. Missing ellipse/spline/point-on-line. Monitor, don't adopt yet. See `docs/architecture/26-constraint-solver-integration.md`. |
| `KittyCAD/mcp` | 4 | Zoo's MCP server — 21 tools, thin wrapper pattern, error-as-return-value, dual input (code OR path). Copy this design for NEXUS MCP. |
| `KittyCAD/ruststep` | 1 | Pure Rust STEP parser. AP203 import works, export not yet. Useful for v0.2 3D expansion. |
| `KittyCAD/svg2kcl` | 2 | SVG→geometry via De Casteljau subdivision + planar face detection. Adapt for vector site plan import. |
| `KittyCAD/llm-spatial-reasoning-tests` | 11 | 60 spatial reasoning prompts for LLM evaluation. All models fail at visual/physical reasoning. Use as NEXUS AI agent eval suite. |
| `KittyCAD/machine-api` | 26 | Trait-based manufacturing machine abstraction (FDM printers, CNC). Pattern for Construction domain. |

Full extraction notes: `refrence-repos/zoo_dev_content/25-31_repo_*.md`

---

### 3. Chili3D — OCCT in the Browser Done Right

**Clone:** `github.com/xiangechen/chili3d`
**Time:** 5 hours
**Language:** TypeScript + C++ (WASM)

Chili3D compiles OpenCASCADE to WASM and builds a full parametric 3D CAD on top. If you choose opencascade.js for v0.2, this is your implementation reference.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| OCCT WASM compilation pipeline | How they handle the 30MB+ WASM binary. Lazy loading? Code splitting? Compression? |
| Boolean operation reliability | OCCT booleans fail on edge cases. How do they handle failures? Retry with tolerance? Fallback? |
| Memory management across WASM boundary | OCCT creates C++ objects. How do they prevent memory leaks? When does JS garbage collection vs explicit `delete()`? |
| File format I/O (STEP, IGES) | OCCT includes format readers. How do they expose these through WASM? Performance? |
| Feature tree / parametric history | Their undo/redo and parametric editing. Compare to your event sourcing — what does event sourcing give you that they don't have? |

**Key question to answer:** "What's the real-world WASM size and load time? Can we lazy-load OCCT only when user enters 3D mode?"

---

### 4. replicad — The Clean OCCT Wrapper

**Clone:** `github.com/sgenoud/replicad`
**Time:** 3 hours
**Language:** TypeScript

replicad wraps opencascade.js in a beautiful, code-friendly TypeScript API. It's what your `@nexus/kernel` 3D API should feel like.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| API design (`src/`) | How they make OCCT ergonomic. `new Sketch().circle(10).extrude(5).fillet(1)` — chainable, readable. Your MCP tool schemas should feel this natural. |
| Error handling | OCCT throws cryptic C++ exceptions through WASM. How does replicad translate these into useful JS errors? |
| Headless usage | replicad works without a renderer — pure geometry. This is exactly what your kernel needs: geometry operations decoupled from any UI. Validates Rule 1. |
| STEP/STL export | Their serialization path from OCCT internal representation to file bytes in the browser. |

**Key question to answer:** "Can we use replicad AS our 3D API layer instead of wrapping OCCT ourselves?" Possibly. It's MIT licensed.

---

### 5. web-ifc — The WASM Parser You'll Depend On

**Clone:** `github.com/ThatOpen/engine_web-ifc`
**Time:** 5 hours
**Language:** C++ → WASM + TypeScript

You'll integrate this directly. Study it to design your BIM ECS components correctly.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| IFC entity model | How 876 IFC entity types map to code. This informs your ECS component design — you need to decompose IFC entities into reusable components, not mirror the IFC class hierarchy. |
| Fragments binary format | Their custom format for 10x faster loading than raw IFC. Study the FlatBuffers schema. Your native save format might want something similar. |
| Geometry processing | How they convert IFC geometry representations (CSG, B-Rep, extrusions) into triangle meshes for rendering. |
| WASM API surface | What's exposed to JS? Is it a thin binding or a high-level API? How does memory flow? |
| Write capability | web-ifc can WRITE IFC, not just read. How? This is rare and essential for BIM authoring. |

**Key question to answer:** "How do we decompose an IFC Wall into ECS components?" Answer: `{EntityId, Geometry, BIMProperties{ifcClass: "IfcWall", propertysets: [...]}, Layer, SpatialContainment{buildingStorey: id}}`. Verify this by reading how web-ifc represents walls internally.

---

### 6. Yjs — CRDT Engineering at Scale

**Clone:** `github.com/yjs/yjs`
**Time:** 4 hours
**Language:** JavaScript

Yjs has 900k+ weekly npm downloads. It powers collaborative editing in dozens of products. The source code is a masterclass in CRDT implementation.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| `src/structs/` | How they represent CRDT items (insert, delete). The internal linked-list structure that makes merge O(n) in document size. |
| `src/types/` (YMap, YArray, YText) | Shared types. Your event store maps to YArray (append-only event log). Entity properties map to YMap (last-writer-wins per key). |
| Awareness protocol | Cursor positions, selection state, "who's editing what." This is how multiplayer CAD shows other users' selections. |
| Offline sync | How Yjs handles reconnection after offline edits. Your OPFS auto-save + Yjs sync must coexist. |
| Binary encoding (`src/utils/encoding.js`) | How they compress CRDT state for network transfer. Performance at scale depends on this. |

**Key question to answer:** "Does our event-sourced architecture map to Yjs naturally, or do we need an adapter?" Event append → YArray.push. Entity property change → YMap.set. Undo → application-level (revert event), not Yjs undo. Confirm by prototyping.

---

### 7. LangGraph.js — Agent Architecture Patterns

**Clone:** `github.com/langchain-ai/langgraphjs`
**Time:** 4 hours
**Language:** TypeScript

Your Sprint 4 orchestration layer. But more importantly, the codebase teaches stateful graph execution patterns that apply beyond AI.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| Graph construction API | How they define nodes (functions) and edges (conditionals). Your command system is already a graph: command → validate → execute → event. LangGraph formalizes this. |
| State management | How agent state persists across turns. Your MCP tool calls need context ("the rectangle I just drew" = state). |
| Human-in-the-loop | How they pause execution for human approval. NEXUS needs this: AI proposes geometry, human approves before commit. |
| Tool calling integration | How they bridge LLM tool calls to actual function execution. This is your MCP tool call → kernel command bridge. |
| Checkpointing | How they save/restore graph state. Maps to your event store snapshots. |

**Key question to answer:** "Should the command system itself be a LangGraph graph?" Probably not — too heavy for simple operations. But the AI agent layer should be, with the command system as the tool backend.

---

### 8. Potree — Rendering at Extreme Scale

**Clone:** `github.com/potree/potree`
**Time:** 3 hours
**Language:** JavaScript + WebGL

Potree has rendered 597 billion points in a browser. The engineering lessons about LOD, streaming, and GPU memory management apply to ANY large-scale browser rendering, not just point clouds.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| Octree structure | How they partition 3D space for streaming. Applicable to large BIM models and GIS datasets, not just point clouds. |
| LOD (Level of Detail) | How they decide what resolution to show based on camera distance. Your CAD renderer needs this when drawing 100k entities — distant entities can be simplified. |
| GPU memory budget | How they manage limited WebGL texture/buffer memory. Load, evict, prioritize. You'll face this with large DXF files. |
| Streaming from HTTP | How they load octree nodes on demand from a server. Same pattern works for cloud-hosted GIS tiles and BIM fragments. |

**Key question to answer:** "At what entity count does our flat Three.js renderer need LOD?" Probably 50k-100k. Potree's architecture shows how to add it.

---

### 9. CesiumJS — Precision and Scale

**Clone:** `github.com/CesiumGS/cesium` (large codebase — focus on specific areas)
**Time:** 4 hours (targeted reading, not full codebase)
**Language:** JavaScript

CesiumJS solves the hardest problem in web spatial rendering: **double-precision coordinates on a GPU that only does float32**. Every CAD/GIS/BIM project eventually hits this.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| `Source/Core/Cartesian3.js` | Double-precision 3D coordinates. How they maintain precision for global-scale positions (millimeter accuracy at any point on Earth). |
| `Source/Renderer/` | How they implement Relative-to-Center (RTC) and Relative-to-Eye (RTE) rendering to work around GPU float32 limits. Your CAD renderer will need this for large civil engineering sites. |
| 3D Tiles loader | How they stream and decode tiled 3D content. The same pattern applies to streaming BIM fragments and point cloud octree nodes. |
| Camera/scene management | How they handle the extreme zoom range from orbital view to street-level. Your CAD needs zoom from site plan to bolt detail. |
| Terrain system | How they stream terrain meshes at multiple resolutions. Informs your civil engineering surface component. |

**Key question to answer:** "At what project scale does our Three.js float32 renderer break?" Probably when civil site extends beyond ~10km. CesiumJS's RTC technique is the solution.

---

### 10. Speckle — The Data Model Problem

**Read source + docs:** `github.com/specklesystems`
**Time:** 3 hours
**Language:** C# (server), TypeScript (viewer)

Speckle solved the hardest non-rendering problem in AEC: **how to represent geometry that works across AutoCAD, Revit, Rhino, QGIS, Blender, and the web.** Their object model is the best reference for NEXUS's ECS component design.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| Object model (`speckle-sharp/Objects/`) | How they represent a Wall, a Beam, a Road, a GIS Feature in ONE type system. This is the problem your ECS components must solve. |
| Kits/Converters | How they translate between native app representations (Revit families, Rhino NURBS, AutoCAD entities) and the Speckle object graph. You'll need similar converters. |
| Versioning | How they version geometric data. Their commit model (diff-based) is an alternative to your event sourcing. Understand trade-offs. |
| Viewer (`speckle-server/packages/viewer/`) | Their web viewer handles mixed BIM+GIS+CAD data. Study how they render heterogeneous geometry. |

**Key question to answer:** "What's the minimum set of ECS components that can represent entities from ALL six NEXUS domains?" Speckle's object model is the closest existing answer to this question.

---

### 11. Bevy (bevy_ecs crate) — ECS Done Right

**Clone:** `github.com/bevyengine/bevy` (focus on `crates/bevy_ecs/`)
**Time:** 4 hours
**Language:** Rust

Your kernel has a hand-rolled ECS. Bevy's ECS is the most mature Rust ECS implementation. Study it to know what your ECS is missing and what you'll eventually need.

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| Archetypal storage (`src/archetype.rs`) | How they store entities by archetype (unique component combination) for cache-friendly iteration. Your sparse array is fine at small scale; archetypes matter at 100k+. |
| Change detection (`src/change_detection.rs`) | How they track which components changed this tick. Your renderer needs this: only re-render entities whose geometry changed. Currently you flush the entire dirty set. |
| System scheduling (`src/schedule/`) | How they run systems in parallel with automatic dependency resolution. When you have 10 ECS systems (rendering, snapping, constraints, AI, persistence...), parallel scheduling matters. |
| Queries (`src/query/`) | How they query "all entities with Geometry + BIMProperties but not Hidden." Your command system needs efficient queries like this. |
| Relations (Bevy 0.15+) | How they handle parent-child and spatial containment relationships. BIM spatial hierarchy (Site → Building → Storey → Space → Element) needs this. |

**Key question to answer:** "At what entity count should we swap our hand-rolled ECS for Bevy ECS?" Benchmark both. The answer is probably 50k-100k entities.

---

### 12. Text2BIM (research paper + code) — Multi-Agent BIM Generation

**Read:** Paper + `github.com/text2bim` (if available)
**Time:** 2 hours
**Language:** Python

This is a research prototype, not production code. But the **agent decomposition pattern** is directly applicable to your v0.7 multi-agent system.

**What to study:**
| Concept | Lesson |
|---------|--------|
| Agent roles | Programmer (generates geometry) + Reviewer (checks constraints) + Model Checker (validates IFC compliance). Three agents, not one. |
| Feedback loop | Reviewer sends geometry back to Programmer with specific fix instructions. This error-recovery loop is essential for reliable AI-generated CAD. |
| IFC generation from NL | How they map "3-storey building with underground parking" to specific IFC entities and spatial hierarchy. |
| Quality gates | What they check: structural validity, IFC schema compliance, spatial consistency. Your AI agent layer needs similar gates. |

**Key question to answer:** "Should Sprint 4's AI agent be one agent or three?" Start with one (Programmer). Add Reviewer at v0.7 when you have domain-specific validation (structural, MEP, compliance).

---

### 13. OpenCAD Studio — A Mature CAD App That Chose Composition Over Event Sourcing

**Clone:** `github.com/HakanSeven12/OpenCADStudio` ✅ Cloned + studied (2026-09-20/22)
**Time:** 4-5 hours
**Language:** Rust (desktop + WASM via `iced`; no browser-native equivalent to our Svelte/Three.js layer)

**License first: GPL-3.0. Learn-from only, never copy code into this Apache-2.0 repo.** Its two companion crates are separately licensed **MPL-2.0** and are the one place actual collaboration/dependency use could happen: `cadcodec` (DWG/DXF codec, `acadrust`) and `cadkernel` (2D curves + B-rep solids). Both are already tracked in `02-open-source-tools-catalog.md` (sections 3a and 7). Full comparison writeup and prioritized adoption backlog: `distributed-computation/nexus-platform#240`.

Unlike CADmium (#1), this is a shipping, ~3,670-commit, GPL desktop app with a real plugin ecosystem, weekly calendar-versioned releases, and DWG/DXF read+write already solved. It answers a different question than CADmium: not "how do you build the WASM bridge," but "what does a mature CAD app's extension surface, AI-automation surface, and file-format resilience look like once you're past the prototype stage."

**What to study:**
| File/Area | Lesson |
|-----------|--------|
| `src/entities/traits.rs` (`RenderConvertible`, `Grippable`, `PropertyEditable`, `FallbackTess`, `MassPropsCalc`, `TextContent`) | Their answer to "how do you add a new entity type without a god-switch": small per-capability traits, one impl block per entity file. No ECS, no event sourcing — just composition. Contrast directly with our ECS + event-sourced model: theirs is cheaper to reason about per-entity, but doesn't get undo/replay/AI-command-log for free the way event sourcing does. Useful as a sanity check that NEXUS's extra upfront cost is buying something real, not just complexity for its own sake. |
| `crates/ocs_plugin_api/` + `crates/ocs_plugin_api/ARCHITECTURE.md` | Plugins run **out-of-process**: the host re-execs itself as a runner, `dlopen`s the plugin `cdylib`, and talks over a local socket (bincode, length-framed; V4 adds multiplexed frames with correlation ids; shared-memory document snapshots via `memmap2`/`rkyv`). A crashing plugin cannot take the host down. Versioning is a 3-gate check at load time: API major range, `acadrust`-source match, and exact `rustc_version` match (v4+) — turns a silent runner crash into `Plugin built with rustc 1.96.0, host requires 1.98.0`. Their plugins are native libraries and can't run in a browser, so the isolation mechanism doesn't port directly — but the 3-layer split (host / plugin / `std`-only headless domain engine) and the load-time compatibility gate both do. |
| `src/mcp.rs` (1,589 lines) + `docs/automation/README.md` | Client-neutral MCP adapter, `OpenCADStudio --mcp`, exposing 4 tools (`ocs_sessions`, `ocs_read`, `ocs_execute`, `ocs_capture`) over the *live GUI* document. Notably: a `record_schema` op returns the full flattened property paths, JSON types, units, enum variants, and write rules for any record type **before** an agent edits it — the agent discovers the schema instead of being told it out-of-band. Every mutation carries `revision` + `request_id`; after a timeout the client re-queries, it never blind-replays. We already have `packages/mcp` and a JSON command API — schema introspection, revision/idempotency guards, and a bounded-PNG capture tool are the concrete gap. |
| `src/app/automation.rs` (1,684 lines) | A **second**, separate automation surface: `OpenCADStudio --serve` runs a headless line-delimited JSON protocol on stdin/stdout (`{"op":"open","path":...}` / `{"op":"run","cmd":"LAYER Walls"}` / `{"op":"save",...}`) with no GUI and no MCP framing at all. Worth noting as a design split we don't currently have: MCP for a live agent driving an open editor session vs. a minimal scriptable pipe for CI/batch/headless use. Two different consumers, two different protocols, on purpose. |
| `src/scene/` render pipeline — `render.rs::prepare` (frame signature) | CPU tessellation feeding a hand-rolled multi-pass `wgpu` renderer through one `iced::widget::shader::Program`. The one piece worth lifting directly: `prepare()` hashes view + geometry + selection + live-preview state into a frame signature before drawing; if it matches last frame's, `skip_geometry = true` and the whole re-tessellate/re-upload/redraw path is skipped — a pure cursor move costs one blit, not a full re-rasterize. This is the same instinct as Bevy's change detection (#11) but applied concretely at the render-frame boundary. Worth checking whether our renderer currently flushes the entire dirty set every frame, and if so, adopting this signature-check pattern directly. |
| `src/scene/cache/block_cache.rs` | Each block definition (the target of an `INSERT`) is tessellated once into block-local coordinates and cached; a use-site just transform-copies the cached primitives and recurses lazily into nested inserts, rather than re-tessellating. The comment there cites a real xref with **~4,700 nested inserts** as the concrete reason this has to be lazy, not eager. If our DXF import (or the DWG spike in `#240`) ever walks block/INSERT hierarchies, this cache is close to mandatory, not optional — worth designing in from the start rather than retrofitting once a large file exposes the O(n) re-tessellation cost. |
| `src/scene/pick/` | Hit-testing/selection consumes the *same* `WireModel`/mesh data produced for rendering, rather than a separate representation — the reason grips and snapping can't drift from what's actually drawn. A useful invariant to hold ourselves to as our own selection/snap code grows. |
| `src/io/xref.rs`, `xref_model.rs`, `recovery.rs` | External-reference (xref) resolution scans a loaded document for block references and pulls geometry from the referenced DWG/DXF files, with explicit status states (`Loaded`/`Recovered`/`Failed`/`NotFound`/`Unloaded`). `recovery.rs` produces a versioned (`REPORT_SCHEMA_VERSION`), SHA-256-fingerprinted recovery report when a file loads with parser errors. NEXUS has no xref concept yet; engineering firms lean on external references almost as much as DWG itself, so this is a strong candidate to follow the DWG spike in `#240`. |
| `src/io/step.rs`, `stl.rs`, `obj.rs`, `pdf_export.rs` | Straightforward exporters from their tessellated `MeshModel` to STEP AP203 (documented as a deliberately simplified triangle-soup-as-B-Rep encoding, not full topology), STL, OBJ, and PDF plot output. Low-complexity reference for our own export path once 3D lands. |
| `docs/native-vs-web.md` | A plain, current table of what the WASM/browser build drops vs. the desktop build (hatch rendering — WebGL2 has no vertex-stage storage buffer; system font shaping; multi-window; native file dialogs) and *why*, kept honest as the two targets diverge. We should have the equivalent for NEXUS once any native/CLI target exists. |
| `.github/workflows/weekly-release.yml` + `docs/releases.md` | Every Sunday, calendar-versioned release (`2026.35`) with its own automation validated by a test script (`scripts/test_release.py`) before running. Build metadata (`2026.35+194.gef189d77`: commits past tag, short hash, `.dirty` flag) is derived from git in `build.rs` and surfaced in About/bug-reports/`--version`. Cheap and copyable regardless of anything else on this list. |

**Key question to answer:** "Where does per-entity trait composition beat ECS + event sourcing, and where does it lose?" Their model is simpler for `RenderConvertible`/`Grippable`-style per-entity behavior; ours is what makes undo/replay and the AI command log fall out of the architecture for free. Confirm we're not paying ECS's complexity tax anywhere it isn't earning its keep — `src/entities/traits.rs` is the concrete counter-example to check against.

**Correction/version note:** the plugin ABI's `rustc_version`/`acadrust_source` gate is described as "API v4 and later" in `docs/plugin-architecture.md`; reading `crates/ocs_plugin_api/ARCHITECTURE.md` directly shows the **current** major is v5 (v5 adds `BuiltinPlugin::on_load` and tab-keyed document paths). Read the source doc over the design doc when they disagree.

---

## Study Order (Optimized for Current Sprint)

```
WEEK 1 — Sprint 3 unblocking + Sprint 4 prep
  Day 1-2: CADmium (8h)        → WASM bridge, Svelte/Three.js, constraint patterns
  Day 3:   replicad (3h)       → Clean OCCT API design, headless geometry
  Day 4:   LangGraph.js (4h)   → Agent orchestration for Sprint 4
  Day 5:   Zoo/KittyCAD (3h)   → AI-first CAD pipeline, error recovery

WEEK 2 — Architecture decisions
  Day 1-2: web-ifc (5h)        → IFC entity model → ECS component design
  Day 2:   Chili3D (3h)        → OCCT WASM in production, memory management
  Day 3:   Speckle (3h)        → Cross-domain object model
  Day 4:   Yjs (4h)            → CRDT internals, offline sync
  Day 5:   Bevy ECS (4h)       → What our ECS is missing

WEEK 3 — Scale and domain prep
  Day 1:   CesiumJS (4h)       → Double-precision, terrain, 3D Tiles
  Day 2:   Potree (3h)         → LOD, streaming, GPU memory budget
  Day 3:   Text2BIM (2h)       → Multi-agent patterns for v0.7
  Day 4:   OpenCAD Studio (5h) → MCP schema/revision guards, DWG via cadcodec, xref/recovery, plugin isolation
```

---

## What You're NOT Studying (and Why)

| Repo | Why Skip |
|------|----------|
| FreeCAD | 2M+ lines of C++. You're using planegcs already. Read their sketcher UI docs, not code. |
| Three.js source | You know Three.js. Read docs for new features (WebGPU), don't study internals. |
| OpenLayers / Leaflet | Older generation. MapLibre GL JS supersedes them for your use case. |
| Babylon.js / PlayCanvas | You chose Three.js. Studying alternatives creates decision paralysis. |
| CrewAI / AutoGen | Python. You're TypeScript. LangGraph.js is the right study target. |
| Eclipse Ditto / iTwin.js | Too enterprise-framework. Read their docs for patterns, not source. |
| Most file format parsers | Use them as libraries, don't study their source. dxf-parser, geotiff.js, shpjs — just call the API. |

---

## The Meta-Lesson

After studying all 13, you'll have absorbed:

1. **From CADmium + Chili3D + replicad:** How browser CAD actually works end-to-end (Rust/WASM ↔ JS ↔ Three.js)
2. **From Zoo:** How AI-first CAD design differs from traditional CAD
3. **From web-ifc + Speckle:** How to model AEC data that spans domains
4. **From Yjs + Bevy ECS:** How to build reactive, scalable infrastructure
5. **From CesiumJS + Potree:** How to render at extreme scale in browsers
6. **From LangGraph + Text2BIM:** How to build agent systems that generate reliable geometry
7. **From OpenCAD Studio:** How a mature, shipping CAD app hardens its AI-automation surface (schema introspection, revision/idempotency), isolates its plugin system (out-of-process + load-time ABI gates), and handles file-format resilience (xref resolution, versioned recovery reports) once past the prototype stage

These 13 repos collectively contain **every hard lesson** you'd otherwise learn by failing over the next 2 years. The 50+ hours of study saves 500+ hours of wrong turns.
