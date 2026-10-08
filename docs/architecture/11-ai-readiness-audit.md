# 11 — AI-Readiness Architecture Audit

> **Date:** 2026-04-14
> **Scope:** Full codebase audit of NEXUS 2D CAD for AI agent collaboration readiness
> **Method:** Deep read of every package (kernel, renderer, core, file-io, app), tracing data flow from user interaction → command dispatch → kernel execution → event emission → rendering → persistence

---

## Why This Audit Exists

NEXUS's thesis is human-AI-robot co-engineering (CLAUDE.md Rule 6: "AI Agents Are First-Class Users"). Before building the `@nexus/ai` MCP server, we need to know exactly where the codebase stands — what's already AI-compatible, what's structurally sound but incomplete, and what's missing entirely. This audit maps the gap between "kernel works" and "an AI agent can effectively operate this tool."

The audit evaluates 8 categories that determine whether an AI can: (1) read a drawing, (2) understand it, (3) make edits programmatically, (4) verify its edits were correct, and (5) collaborate with human users on the same drawing.

---

## What We Examined

### Files Read (Complete)

**Kernel (Rust/WASM) — `packages/kernel/src/`:**
- `lib.rs` (1600+ lines) — Kernel struct, all WASM-exported methods, execute_command dispatcher
- `entity.rs` — Entity struct, GeometryType enum (18 variants), Point2D, Layer, BlockDef, EntityStyle
- `commands.rs` — Command enum (60+ variants), CommandResult struct
- `events.rs` — CadEvent enum, EventEnvelope, Actor enum, EventStore (cursor-based undo/redo)
- `constraints.rs` — ConstraintType enum (8 types), ConstraintSolver (iterative, 50 iterations, 1e-6 tolerance)
- `tolerance.rs` — Tiered precision constants (1e-8 to 1e-12)

**Core (TypeScript types) — `packages/core/src/`:**
- `types.ts` — TypeScript entity type definitions (mirrors Rust)
- `events.ts` — TypeScript command/event type definitions (mirrors Rust serde tags)
- `index.ts` — Re-exports

**Renderer — `packages/renderer/src/`:**
- `CadRenderer.ts` (800 lines) — Three.js WebGL renderer, entity→mesh mapping, snap indicators, incremental updates
- `SelectionManager.ts`, `SnapEngine.ts` — Supporting systems

**App (Svelte 5) — `packages/app/src/`:**
- `lib/stores/AppState.svelte.ts` — Central state, executeCommand(), syncView(), file I/O handlers
- `lib/tools/BaseTool.ts` — Tool abstract base class (step-based, point collection)
- `lib/tools/registry.ts` — 25 tools registered by ID and alias
- All 25 tool implementations (LineTool, CircleTool, MoveTool, etc.)

**File I/O — `packages/file-io/src/`:**
- `persistence.ts` — OPFS + localStorage, serializeProject/deserializeProject
- `dxf-export.ts` — DXF R2000 writer
- `dxf-import.ts` — DXF parser
- `index.ts` — Re-exports

---

## Phase 1 — Codebase Discovery

### Tech Stack
| Layer | Technology | Notes |
|---|---|---|
| Framework | SvelteKit + Svelte 5 (runes) | `$state`, `$derived`, `$effect` |
| Renderer | Three.js (WebGL) | Orthographic camera, wireframe 2D |
| Geometry Kernel | Rust → WASM (`wasm-bindgen`) | All computation in Rust |
| State | Svelte 5 runes in `AppState.svelte.ts` | Kernel typed as `any` to avoid WASM coupling |
| Build | pnpm monorepo + Turborepo + `wasm-pack` | |
| Persistence | OPFS (Origin Private File System) + localStorage fallback | |
| File Format | `.nexus` (JSON) + DXF R2000 import/export | |

### Package Structure
```
packages/
├── @nexus/kernel     — Rust/WASM geometry engine, ECS, event store, constraints
├── @nexus/renderer   — Three.js 2D rendering, snap engine, selection manager
├── @nexus/core       — Shared TypeScript types mirroring Rust structs
├── @nexus/file-io    — DXF parser/writer, OPFS persistence, serialization
└── @nexus/app        — SvelteKit shell, 25 tools, UI components
```

### Data Flow (traced through code)
```
User Click → Tool.onPointerDown()
  → AppState.executeCommand({ type: 'CreateLine', ... })
    → kernel.execute_command(JSON.stringify(cmd))  // WASM boundary
      → Rust: serde deserialize → Command enum
      → Rust: Kernel.execute(cmd)
        → create entity, push to Vec<Entity>
        → emit CadEvent to EventStore
        → run constraint solver
        → mark dirty IDs
      → Rust: serialize CommandResult to JSON
    → AppState.syncView()
      → kernel.get_entities_json()  // full state as JSON
      → renderer.syncEntities(json, layerColors)
        → Three.js creates/updates meshes
```

### Key Finding: Drawing Representation
Every entity in the kernel is an `Entity` struct:
```rust
struct Entity {
    id: String,              // "ent_1", "ent_2", ...
    geometry: GeometryType,  // Line | Circle | Arc | ... (18 variants)
    layer_id: String,        // organizational grouping
    style: EntityStyle,      // optional color, linetype, lineweight
}
```

18 geometry types: Line, Circle, Arc, Polyline, Rectangle, Ellipse, Spline, Text, Dimension, AlignedDimension, AngularDimension, RadialDimension, DiameterDimension, ConstructionLine, BlockRef, Hatch, MText, Table.

All serialize/deserialize via serde JSON. The full drawing state is accessible as structured JSON at any time.

---

## Phase 2 — Representation Layer

### 2.1 — Text-Based Serialization

**What we looked for:** Can the entire drawing be read and written as structured text (JSON, YAML, DSL)? Can an AI reconstruct the full drawing from the serialized form alone?

**What we found:** The kernel exposes complete state via JSON:
- `kernel.get_entities_json()` — all entities with full geometry
- `kernel.get_layers_json()` — all layers with properties
- `kernel.get_constraints_json()` — all geometric constraints
- `kernel.get_entity_json(id)` — single entity lookup
- `kernel.get_block_defs_json()` — block definitions

The `.nexus` project file is human-readable JSON (`persistence.ts:130-139`):
```json
{
  "version": "0.1.0",
  "format": "nexus-project",
  "timestamp": 1713100000000,
  "metadata": { "name": "my-drawing" },
  "entities": [
    {
      "id": "ent_1",
      "geometry": { "Line": { "start": {"x": 0, "y": 0}, "end": {"x": 100, "y": 50} } },
      "layer_id": "layer_0",
      "style": {}
    }
  ],
  "constraints": [
    { "id": "con_1", "constraint_type": { "Horizontal": { "entity_id": "ent_1" } } }
  ]
}
```

**Verdict: 9/10.** An AI can read and write this format natively. The drawing is fully reconstructible from the serialized form. One gap: the event log (construction history) is not serialized — you get the current state but not how it was built.

### 2.2 — Semantic vs Geometric Data Model

**What we looked for:** Are entities stored as raw coordinates (hard for AI to reason about) or as semantic objects with meaning ("wall", "door", "dimension")?

**What we found:** Entities are typed geometric primitives. Each entity knows *what kind of shape it is* (Line, Circle, Dimension, etc.) but not *what it represents* in the design (wall, boundary, pipe). The organizational mechanisms are:
- **Layer assignment** — the only semantic grouping (e.g., entities on a "walls" layer)
- **Entity type** — geometric classification (Line vs Circle vs Dimension)
- **Block definitions** — reusable groups of entities
- **Constraints** — geometric relationships (parallel, perpendicular, coincident)
- No `metadata`, `tags`, `name`, or `description` field on entities

**Verdict: 6/10.** Adequate for 2D CAD scope. An AI can understand geometry types and layer organization. But it cannot know that "ent_5 through ent_8 form a door" without parsing the geometry itself. No way to attach semantic annotations to entities.

### 2.3 — Constraints and Relationships

**What we looked for:** Are geometric constraints stored explicitly? Does moving one entity update related entities? Or is everything absolute coordinates with no relationships?

**What we found:** The `ConstraintSolver` (`constraints.rs`) implements 8 constraint types:

| Constraint | What It Does |
|---|---|
| Fixed | Pin a point to a position |
| Coincident | Two points share the same location |
| Horizontal | Line has dy=0 |
| Vertical | Line has dx=0 |
| Distance | Fixed distance between two points |
| Parallel | Two lines share the same direction |
| Perpendicular | Two lines are at 90° |
| EqualLength | Two line segments have the same length |

The solver runs after every move/rotate/scale operation (`lib.rs:196`, `lib.rs:216`, `lib.rs:237`):
```rust
self.constraint_solver.solve(&mut self.entities);
```

It uses iterative projection (max 50 iterations, convergence at 1e-6). Constraints are serializable and queryable.

**Verdict: 7/10.** Moving a constrained entity correctly propagates to related entities. An AI's edits preserve design intent for the constraint types that exist. Gaps: no tangent, no angular, no radius, no symmetric, no "on curve" constraints. The custom solver is simpler than planegcs but works for the current set.

---

## Phase 3 — Command / Operation Architecture

### 3.1 — Command Pattern

**What we looked for:** Is every edit a discrete, named, serializable command? Can commands be replayed? Is there undo/redo?

**What we found:** Every operation goes through a `Command` enum (`commands.rs`) with 60+ variants, using serde `#[serde(tag = "type")]` for JSON serialization. The kernel has a single entry point:

```rust
pub fn execute_command(&mut self, command_json: &str) -> String
```

This deserializes the JSON to a `Command`, executes it, and returns a `CommandResult`:
```rust
pub struct CommandResult {
    pub success: bool,
    pub created_ids: Vec<String>,
    pub error: Option<String>,
    pub measurement: Option<f64>,
}
```

Every command emits a `CadEvent` to the `EventStore` (`events.rs`). The event store supports cursor-based undo/redo. Events capture old geometry for reversal:
```rust
EntityMoved { id, dx, dy, old_geometry }
EntityModified { id, old_geometry, new_geometry }
```

**Verdict: 9/10.** Textbook command pattern. The same JSON command from any source (UI, command line, AI) produces identical results. One gap: the command that produced each event is not stored alongside the event, so you can undo/redo but cannot replay from a command script.

### 3.2 — Programmatic API Surface

**What we looked for:** Can operations be performed via code without simulating UI clicks?

**What we found:** The `AppState.executeCommand()` method (`AppState.svelte.ts:97-102`) is the universal dispatch:

```typescript
executeCommand(command: object): { success: boolean; created_ids: string[]; error?: string }
```

Both the UI tools and any programmatic caller use this same path. Example — the LineTool (`LineTool.ts`) does:
```typescript
this.ctx.app.executeCommand({
  type: 'CreateLine',
  x1: this.points[0].x, y1: this.points[0].y,
  x2: pt.x, y2: pt.y,
  layer_id: 'layer_0'
});
```

An AI agent would call the exact same thing. The kernel also exposes direct WASM methods:
```javascript
kernel.create_line(0, 0, 100, 50, 'layer_0');
kernel.move_entity('ent_1', 10, 20);
kernel.get_entities_json();
```

**Verdict: 9/10.** Full API parity between human and programmatic users. The only thing missing: the `@nexus/ai` package (MCP tool schemas) that wraps these commands for LLM tool-calling.

### 3.3 — Semantic vs Low-Level API

**What we looked for:** Can the API express intent ("add a door to the north wall") or only geometry ("draw rectangle at x,y,w,h")?

**What we found:** The API is purely geometric. The 60+ commands are all coordinate-level:
- `CreateLine { x1, y1, x2, y2, layer_id }`
- `CreateRectangle { x, y, width, height, layer_id }`
- `MoveEntity { id, dx, dy }`
- `AddConstraintParallel { entity_a, entity_b }`

No higher-level abstractions exist. No "create wall", "add opening", "place door". This is appropriate for 2D CAD but means an AI must do all geometric reasoning itself.

**Verdict: 4/10.** An AI must compose low-level geometric commands to achieve design intent. No abstraction layer translates intent → geometry.

---

## Phase 4 — Feedback & State Inspection

### 4.1 — Structured State Queries

**What we looked for:** Can an AI get structured data about the drawing state?

**What we found:** Comprehensive query API at the kernel level:

| Query | Method | Returns |
|---|---|---|
| All entities | `get_entities_json()` | Full JSON array with geometry |
| Single entity | `get_entity_json(id)` | Entity JSON |
| Visible entities | `get_visible_entities_json()` | Filtered by layer visibility |
| All layers | `get_layers_json()` | Layer array |
| All constraints | `get_constraints_json()` | Constraint array |
| Block definitions | `get_block_defs_json()` | Block array |
| Entity count | `entity_count()` | Number |
| Last created | `get_last_created_entity_json()` | Entity JSON |
| Delta changes | `flush_changes()` | `{ upserted: [...], deleted: [...] }` |
| Undo/Redo state | `can_undo()` / `can_redo()` | Boolean |
| Has pending changes | `has_changes()` | Boolean |

**Verdict: 8/10.** An AI can fully inspect the drawing. Missing: spatial queries (entities near a point, entities in a bounding box), per-layer entity filter at kernel level, entity bounding box query.

### 4.2 — Validation and Error Reporting

**What we looked for:** Does the system detect geometric errors? Are errors structured data?

**What we found:** `CommandResult.error` returns simple strings:
- `"Entity not found"`, `"Trim failed"`, `"Mirror failed"`, `"Block not found"`, `"Not a block ref"`

There is **no** geometric validation:
- No degenerate geometry detection (zero-length lines, zero-radius circles)
- No self-intersection detection
- No constraint conflict detection (over-constrained systems)
- No duplicate entity detection
- No overlap/interference checking
- The constraint solver silently fails if it doesn't converge (returns `false` but this is not exposed)

**Verdict: 3/10.** An AI gets basic success/failure but has no way to assess geometric validity. It can create broken geometry without knowing.

### 4.3 — Change Detection

**What we looked for:** After an operation, can the system report what changed?

**What we found:** `kernel.flush_changes()` returns:
```json
{
  "upserted": [/* entities that were created or modified */],
  "deleted": ["ent_5", "ent_8"]
}
```

This is used by the renderer for incremental updates. However:
- No description of *what* changed within an entity (old vs new state)
- Events in the Rust EventStore DO capture old geometry (`EntityMoved { old_geometry }`) but this is **not exposed to JavaScript**
- No structured change explanation (e.g., "moved ent_1 by (10,20), constraint con_3 resolved, ent_2 also moved")

**Verdict: 5/10.** Basic "what entities were touched" tracking exists. Missing: semantic change descriptions, old/new diffs, constraint propagation reports.

---

## Phase 5 — State Management

### 5.1 — Immutability

**What we looked for:** Is state managed immutably (snapshots) or mutably?

**What we found:** **Mutable in-place.** The kernel stores `entities: Vec<Entity>` and mutates directly:
```rust
entity.geometry.translate(dx, dy);  // mutates
```

Events store `old_geometry` clones for undo, but there are no state snapshots, no structural sharing, no copy-on-write.

**Verdict: 4/10.** Mutable state makes diffing, branching ("what if" scenarios), and time-travel harder. The event store provides a partial workaround for undo/redo specifically.

### 5.2 — Event Sourcing

**What we looked for:** Are changes stored as an append-only event log? Can state be reconstructed from events?

**What we found:** `EventStore` in `events.rs` captures every mutation:

```rust
pub struct EventEnvelope {
    pub seq: u64,                // monotonic sequence number
    pub timestamp_ms: u64,       // wall-clock time
    pub actor: Actor,            // User | Agent | System
    pub schema_version: u16,     // for forward compatibility
    pub payload: CadEvent,       // what happened
}

pub enum CadEvent {
    EntityCreated { entity: Entity },
    EntityDeleted { entity: Entity },
    EntityMoved { id, dx, dy, old_geometry },
    EntityRotated { id, cx, cy, angle, old_geometry },
    EntityScaled { id, cx, cy, factor, old_geometry },
    EntityCopied { original_id, new_entity },
    EntityModified { id, old_geometry, new_geometry },
    EntityStyleChanged { id, old_style, new_style },
    CompoundEvent { events: Vec<CadEvent> },
}
```

The Actor model is defined but unused — all events default to `User { session_id: "local" }`.

**Critical gap:** The event store is **entirely internal to Rust**. No WASM binding exposes events to JavaScript. The only accessible operations are `undo()` and `redo()`. An AI cannot:
- Read the event history
- Filter events by actor or time range
- Export the event log
- Replay events to reconstruct state

**Verdict: 6/10.** The architecture is correct — events, actors, schema versions, sequence numbers all exist. But the implementation traps this data inside Rust memory with no JS access. The event log is an internal implementation detail, not a first-class API.

### 5.3 — Collaboration Readiness

**What we looked for:** Can multiple agents (human + AI) edit simultaneously? Is there conflict resolution?

**What we found:** Single-user only. No CRDT, no OT, no WebSocket sync. The `Actor` enum is defined but never differentiated — there's no way to track which actor made which change at the application level.

**Verdict: 2/10.** Types are future-proofed but no collaboration infrastructure exists.

---

## Phase 6 — Rendering & Separation of Concerns

### 6.1 — Rendering Decoupled from Data

**What we looked for:** Can the kernel be operated without the renderer? Are data and rendering tightly coupled?

**What we found:** **Clean separation.** The data flow is one-directional:

```
Kernel (Rust/WASM) → JSON → CadRenderer (Three.js) → Canvas
```

The kernel has zero knowledge of Three.js, the DOM, or any rendering concepts. The renderer receives JSON strings and creates Three.js objects. Key evidence:
- `CadRenderer.syncEntities(entitiesJson: string, layerColors: Map<string, string>)` — takes serialized data
- `CadRenderer.applyChanges(changesJson: string, layerColors: Map<string, string>)` — incremental updates from JSON
- Kernel tests run in pure Rust with `cargo test` — no browser needed

An AI agent can instantiate and operate the WASM kernel in Node.js or any JavaScript runtime without a DOM.

**Verdict: 9/10.** Textbook decoupling. The kernel is headless-capable. This is the hardest thing to get right and it's already correct.

### 6.2 — Renderer Technology

**What we looked for:** What rendering approach? Can it handle large drawings?

**What we found:** Three.js WebGL with orthographic camera. All geometry rendered as `THREE.Line` wireframes (no filled meshes). Text uses `THREE.Sprite` with dynamically-generated canvas textures.

Performance features:
- Material caching (`materialCache: Map<string, THREE.Material>`)
- Dirty-ID-based incremental updates via `flush_changes()` / `applyChanges()`
- Proper disposal of geometries and textures
- ResizeObserver for responsive viewport

No instanced rendering, no LOD, no spatial partitioning for draw calls. Adequate for typical 2D CAD drawings but would need optimization for 10,000+ entity drawings.

**Verdict: 7/10.** Solid for current scope. WebGL provides hardware acceleration. The incremental update path avoids full scene rebuilds.

---

## Phase 7 — Final Scorecard

| # | Category | Score | Key Evidence | Critical Gap |
|---|---|---|---|---|
| 1 | Text-based representation | **9/10** | Full JSON serialization, `.nexus` format, all state queryable | Event log not serialized |
| 2 | Semantic data model | **6/10** | 18 typed geometry variants, layers, blocks, constraints | No entity metadata/tags, no domain semantics |
| 3 | Constraint system | **7/10** | 8 constraint types, iterative solver, auto-resolve on edit | Missing tangent/angular/radius, custom solver limits |
| 4 | Command pattern | **9/10** | 60+ typed commands, serde JSON, single entry point | Command log not persisted for replay |
| 5 | Programmatic API | **9/10** | `execute_command(json)→json`, full parity with UI | No MCP tool schemas (`@nexus/ai` empty) |
| 6 | Structured feedback | **3/10** | Basic `CommandResult {success, error}` | No geometric validation, no diagnostics |
| 7 | State management | **4/10** | EventStore exists with actors + schema versions | Mutable state, event log trapped in Rust |
| 8 | Rendering decoupling | **9/10** | Kernel headless, JSON boundary, zero DOM dependency | — |
| | **Overall AI-Readiness** | **7/10** | | |

---

## Top 3 Strengths

1. **Command-first architecture is production-ready for AI.** The `execute_command(json) → json` interface is exactly what an MCP tool schema wraps. Every operation — from creating a line to adding constraints — is a serializable JSON command with typed parameters and structured results. An AI agent can operate this system today with zero UI simulation. Evidence: `commands.rs` (60+ variants), `AppState.executeCommand()`, all 25 UI tools dispatch through the same path.

2. **Full JSON serialization of all state.** Entities, layers, constraints, and block definitions are all queryable as JSON via `get_entities_json()`, `get_layers_json()`, `get_constraints_json()`, `get_block_defs_json()`. An AI can read the complete drawing state, understand every entity's geometry and relationships, and make informed edits. The `.nexus` file format is human-readable and round-trips perfectly.

3. **Clean kernel/renderer separation.** The Rust/WASM kernel operates headlessly with no DOM dependency. The only interface between kernel and renderer is serialized JSON. The kernel can be instantiated in Node.js, a test harness, or a server-side batch processor. This is the hardest architectural decision to get right, and it's already correct.

## Top 3 Critical Gaps

1. **No MCP tool schema or AI interface layer.** The `@nexus/ai` package is planned in `CLAUDE.md` but has zero code. Without MCP tool schemas, an AI agent has no standardized way to discover available commands, their parameters, or their semantics. This is the single highest-priority gap — it's the door the AI needs to walk through.

2. **No geometric validation or structured diagnostics.** When an AI creates geometry, it gets back `{ success: true }` but has no way to know if the result is geometrically valid. No intersection detection, no degenerate geometry checks (zero-length segments, zero-radius circles), no constraint conflict reporting (over-constrained systems silently fail). An AI operating blindly will produce invalid geometry without feedback.

3. **Event store trapped inside Rust.** The event log captures rich history (actor, timestamp, sequence number, old/new geometry) but has no WASM binding to JavaScript. An AI cannot read the construction history, understand how a drawing was made, study a human designer's workflow, or replay commands. The architecture is correct but the data is inaccessible.

---

## Action Plan

| # | Action | Size | Addresses Gap | What to Build |
|---|---|---|---|---|
| 1 | **MCP Tool Schemas** | M | Programmatic API | Build `@nexus/ai` MCP server wrapping all 60+ commands as tools with JSON Schema parameters. Include query tools for state inspection. |
| 2 | **Expose Event Stream** | S | State management | Add WASM bindings: `get_events_json(from_seq)`, `get_event_count()`, `get_undo_stack_json()`. Let AI read construction history. |
| 3 | **Geometric Validation** | M | Structured feedback | Add `validate() → JSON` returning structured diagnostics: degenerate geometry, constraint conflicts, self-intersections. |
| 4 | **Spatial Query API** | S | State inspection | Add `query_entities_near(x,y,r)`, `query_entities_in_rect(x1,y1,x2,y2)`, `query_entities_on_layer(id)`, `get_entity_bounds(id)`. |
| 5 | **Entity Metadata** | S | Semantic model | Add `metadata: HashMap<String, String>` to Entity for semantic tagging (`{"purpose":"wall"}`). |
| 6 | **Command Replay** | S | Command pattern | Store `Command` alongside events. Add `replay_commands(json_array)` for script-based drawing construction. |

### Priority Order Reasoning

**Action 1 (MCP)** is the bridge — everything else is useless to an AI without it. **Action 2 (Events)** gives the AI contextual understanding. **Action 3 (Validation)** gives the AI feedback on its work. Actions 4-6 improve quality of life but aren't blockers.

---

## Architecture: Current vs Target

### Current
```
┌─────────────────────────────────────────────────────┐
│                      Browser                         │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐   │
│  │  Svelte  │───▶│ AppState │───▶│  CadRenderer │   │
│  │   UI     │    │ .svelte  │    │  (Three.js)  │   │
│  │ 25 Tools │    └────┬─────┘    └──────────────┘   │
│  └──────────┘         │ JSON                         │
│                  ┌────▼──────┐                       │
│                  │  Kernel   │ ◀── EventStore         │
│                  │  (WASM)   │ ◀── ConstraintSolver   │
│                  └────┬──────┘                       │
│                       │ JSON                         │
│                  ┌────▼──────┐                       │
│                  │  File I/O │ → .nexus / .dxf       │
│                  └───────────┘                       │
│                                                      │
│                  ❌ No AI entry point                 │
│                  ❌ Events trapped in Rust            │
│                  ❌ No validation feedback            │
└─────────────────────────────────────────────────────┘
```

### Target
```
┌─────────────────────────────────────────────────────┐
│                      Browser                         │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐   │
│  │  Svelte  │───▶│ AppState │───▶│  CadRenderer │   │
│  │   UI     │    │ .svelte  │    │  (Three.js)  │   │
│  │ 25 Tools │    └────┬─────┘    └──────────────┘   │
│  └──────────┘         │                              │
│        ┌──────────────┼──────────────┐               │
│        │        JSON Command Bus     │               │
│        │              │              │               │
│   ┌────▼─────┐  ┌────▼──────┐  ┌───▼────────────┐  │
│   │   MCP    │  │  Kernel   │  │   Validation   │  │
│   │  Server  │  │  (WASM)   │  │     Layer      │  │
│   │(@nexus/  │  ├───────────┤  └────────────────┘  │
│   │   ai)    │  │ Events  ● │──▶ Event Stream API  │
│   └────┬─────┘  │ Constr  ● │    (exposed to JS)   │
│        │        │ Spatial ● │──▶ Spatial Queries    │
│        │        │ Meta    ● │──▶ Semantic Tags      │
│        │        └───────────┘                       │
│   ┌────▼─────┐                                      │
│   │ AI Agent │ ← Claude / LangGraph / MCP Client    │
│   └──────────┘                                      │
└─────────────────────────────────────────────────────┘
```

---

## Conclusion

The NEXUS codebase is architecturally well-positioned for AI integration. The command-first design, JSON serialization, and kernel/renderer separation mean 80% of the hard structural work is done. The remaining 20% is building the interface layer (MCP), exposing internal data (events), and adding feedback mechanisms (validation). None of the gaps require architectural restructuring — they're all additive extensions to a sound foundation.
