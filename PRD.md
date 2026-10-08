# NEXUS — Product Requirements Document

> **Status (2026-04-29):** This PRD is the **only active spec** under scope lock SD-05 (`DECISIONS.md`). Implementation backlog lives in `docs/2D-PARITY-BACKLOG.md`. Open seat-tested findings live in `docs/audit/EXPERIENCE-AUDIT.md`.

## Product: 2D CAD Vertical Slice — AutoCAD 2D Parity in the Browser

> **Goal:** One complete end-to-end flow — create, edit, constrain, save, reload, AI-driven — in 2D CAD. Both TypeScript and Rust paths running together in the browser. Definition of done: a civil engineer can complete a real floor-plan loop without saying "this is broken."

---

## Vision

A browser-based 2D CAD that works like a minimal AutoCAD, where both humans and AI agents are first-class users. Every operation available via GUI is also callable headlessly by an AI agent via MCP tool schemas.

## Non-Functional Requirements

- **Zero install:** Runs in Chrome/Firefox/Safari. No plugins, no Electron.
- **Local-first:** All data in OPFS. Works offline.
- **Dual stack:** UI in TypeScript/Svelte 5, geometry kernel in Rust/WASM.
- **AI-native:** Every operation is a command that AI can call.
- **Open source:** Apache-2.0 license (explicit patent grant for a platform others build on). All dependencies MIT/Apache 2.0/BSD compatible.
- **Rust owns all data:** The WASM kernel owns all geometric and ECS data. The JS layer accesses entities via numeric handles (entity IDs), never by holding object references across the bridge. Only small results (render lists, command results) cross the boundary.
- **Non-blocking computation:** Heavy geometry operations (boolean, constraint solving, file conversion) must not block the main thread. v0.1 runs on main thread with small datasets; v0.2+ moves the kernel to a Web Worker via Comlink. Server must set COOP/COEP headers for SharedArrayBuffer support.
- **Numerical robustness:** Tolerance is a first-class citizen in the data model. Named constants, not inline magic numbers. See R12.

---

## Functional Requirements

### R1 — 2D Drawing Entities

| Entity | Properties | Priority |
|--------|-----------|----------|
| Line | start, end | P0 |
| Circle | center, radius | P0 |
| Arc | center, radius, start_angle, end_angle | P0 |
| Polyline | vertices[], closed | P0 |
| Rectangle | origin, width, height, rotation | P0 |
| Text | position, content, height, rotation | P1 |
| Dimension | type (linear/angular/radial), references | P1 |
| Hatch | boundary, pattern | P2 |
| Spline | control_points[], degree | P2 |

### R2 — Drawing Operations

| Operation | Description | Priority |
|-----------|------------|----------|
| Create | Draw any entity via click or coordinate input | P0 |
| Select | Click, window, crossing selection | P0 |
| Move | Translate selected entities | P0 |
| Copy | Duplicate selected entities | P0 |
| Delete | Remove selected entities | P0 |
| Rotate | Rotate selected entities around point | P0 |
| Scale | Scale selected entities from base point | P0 |
| Trim | Trim entity at intersection | P1 |
| Extend | Extend entity to boundary | P1 |
| Offset | Create parallel copy at distance | P1 |
| Fillet | Round corner between two entities | P1 |
| Mirror | Mirror selected entities across axis | P1 |
| Array | Rectangular/polar array of entities | P2 |

### R3 — Constraint System

| Constraint | Description | Priority |
|-----------|------------|----------|
| Horizontal | Force line/segment horizontal | P0 |
| Vertical | Force line/segment vertical | P0 |
| Distance | Fixed distance between points | P0 |
| Angle | Fixed angle between segments | P1 |
| Parallel | Two segments parallel | P1 |
| Perpendicular | Two segments perpendicular | P1 |
| Tangent | Line tangent to arc/circle | P1 |
| Coincident | Two points share location | P0 |
| Concentric | Two circles share center | P1 |
| Equal | Two segments equal length | P1 |
| Fixed | Point/entity locked in place | P0 |

Implementation: Dual Rust solver — native Gauss-Seidel (8 types) + ezpz crate (11 types including tangent, concentric, symmetric). ezpz is the active production solver. planegcs WASM integration deferred to post-v0.1 when full parametric sketching is needed (100+ constraint types).

### R4 — Layer System

- Create/rename/delete layers
- Assign entities to layers
- Toggle layer visibility
- Lock layers (prevent editing)
- Layer colors (entities inherit layer color unless overridden)

### R5 — Snapping

| Snap | Priority |
|------|----------|
| Endpoint | P0 |
| Midpoint | P0 |
| Center | P0 |
| Intersection | P0 |
| Perpendicular | P1 |
| Nearest | P1 |
| Grid | P0 |

### R6 — Coordinate Input

- Absolute: `x,y` (e.g., `100,200`)
- Relative: `@dx,dy` (e.g., `@10,20`)
- Polar: `@distance<angle` (e.g., `@50<45`)
- Command line input (AutoCAD-style)

### R7 — Undo/Redo

- Event-sourced: every operation = immutable event
- Unlimited undo depth
- Undo/redo via Ctrl+Z / Ctrl+Shift+Z
- Event log viewable for debugging and AI replay

### R8 — File I/O

| Format | Read | Write | Priority |
|--------|------|-------|----------|
| DXF R2000 (AC1015) | Yes (dxf-parser) | Yes (custom) | P0 |
| Native JSON | Yes | Yes | P0 |
| SVG export | No | Yes | P1 |
| PDF export | No | Yes (jsPDF) | P1 |
| DWG | Deferred | No | P2 |

### R9 — Local Persistence

- Auto-save to OPFS every 30 seconds
- Project browser showing saved files
- Open/save/save-as workflow

### R10 — AI Agent Interface

**v0.1 scope:** Every R2 operation is callable headlessly via `execute_command(json)` WASM binding. This is the foundation — same command, same result, whether dispatched by GUI click or JSON call.

```json
{"type": "CreateLine", "x1": 0, "y1": 0, "x2": 100, "y2": 50, "layer_id": "layer_0"}
```

- `execute_command(json: &str) -> String` WASM entry point (DONE — Foundation Sprint)
- `CommandResult` with success/created_ids/error (DONE)
- `Actor::Agent` in EventEnvelope distinguishes human vs AI edits (DONE)
- Same result whether human clicks or agent calls API (DONE — verified by test)

**Post-v0.1 scope (deferred):**
- MCP server with 10 typed tools (Phase 1, Week 12-13)
- Chat bar in UI for natural language input
- LLM decomposes NL to tool calls via LangGraph.js
- Agent action log visible in UI
- See `ROADMAP.md` Phase 1 and `docs/architecture/00-thesis.md`

### R11 — Viewport

- Pan (middle mouse drag or space+drag)
- Zoom (scroll wheel, pinch on tablet)
- Zoom extents (fit all entities)
- Zoom window (rubber-band zoom)
- Orthographic 2D view (no perspective)
- Grid display with dynamic spacing based on zoom level

---

## Technical Architecture

```
packages/
├── @nexus/core          # Shared types, events, entity IDs
├── @nexus/kernel         # Rust/WASM geometry kernel + ECS
├── @nexus/renderer       # Three.js 2D rendering
├── @nexus/file-io        # DXF/SVG/PDF export, DXF import, OPFS persistence
├── @nexus/mcp            # MCP server (91 tool definitions via @modelcontextprotocol/sdk)
├── @nexus/logger         # Structured logging
└── @nexus/app            # SvelteKit app (UI shell, tools, AI chat, cloud auth)
```

---

### R12 — Geometry Validation

Every command that creates or modifies geometry must validate the result before persisting to the event store:

- Reject degenerate geometry (zero-length lines, zero-radius circles, coincident start/end)
- Use named tolerance constants (not inline `0.001`):
  - `GEOMETRIC_EPSILON: 1e-8` — point coincidence
  - `ANGULAR_EPSILON: 1e-10` — parallel/perpendicular detection
  - `INTERSECTION_TOLERANCE: 1e-7` — line/arc intersection
- Validation runs inside `execute()` — invalid geometry returns `CommandResult { success: false, error: "..." }`
- Post-v0.1: Shewchuk exact predicates (`robust` crate) for intersection tests, OCCT geometry healing for 3D

See `docs/challenges/00-six-real-challenges.md` Challenge 1 and `docs/architecture/00-thesis.md`.

---

## Success Criteria

1. User can draw a floor plan (walls as lines, doors as arcs) in < 5 minutes
2. Save as DXF, open in AutoCAD/LibreCAD, geometry is correct
3. AI agent can reproduce the same floor plan from: "Draw a 10m x 8m rectangle, add a 0.9m door opening on the south wall"
4. Constraint solver keeps walls perpendicular when user drags a corner
5. 60fps with 10,000 entities on screen
6. Works fully offline after first load
