# 14 — Strategic Reality Check

> **Date:** 2026-04-14
> **Author:** Architecture audit agent after deep codebase review
> **Context:** Written after reading every source file in the kernel, renderer, core, file-io, and app packages; all architecture docs (01-13); the 792-line AI integration spec; the USES schema; the PRD; the sprint plan; the master plan; and the agent server design session. This is not opinion from the outside — it's a diagnosis from inside the code.

---

## What I Found vs What the Vision Claims

### The founding insight is real

The vision document states:

> "A CAD operation and an AI instruction are the same data structure."

I verified this in the code. It is not marketing. It is literally true.

`packages/kernel/src/lib.rs:1311` — the kernel's single entry point:
```rust
pub fn execute_command(&mut self, command_json: &str) -> String
```

This function does not know whether the JSON came from:
- A mouse click dispatching through `LineTool.ts` → `AppState.executeCommand()`
- A typed command in the `CommandLine.svelte` component
- An AI agent calling through an MCP tool
- A workflow engine triggering a step
- A test harness replaying a command log

The `Actor` enum in `events.rs` tags the source (`User`, `Agent`, `System`) but the kernel processes them identically. Every operation produces the same `CommandResult`, emits the same `CadEvent`, and feeds the same constraint solver.

Most companies that claim "AI-native architecture" have a chatbot wrapper calling internal APIs through an adapter layer. This codebase has the actual thing. The command bus is the architecture, not a feature bolted on.

This is worth building on. It is rare. I've audited many codebases and most get this wrong — they bury logic in UI event handlers, use mutable state without event logs, or make the AI a second-class citizen that calls a different code path than the user.

### The event sourcing bet is correct and almost nobody makes it

`packages/kernel/src/events.rs` — the EventStore:

```rust
pub struct EventEnvelope {
    pub seq: u64,
    pub timestamp_ms: u64,
    pub actor: Actor,
    pub schema_version: u16,
    pub payload: CadEvent,
}
```

Every mutation is an immutable event with:
- Monotonic sequence number (for ordering and conflict detection)
- Wall-clock timestamp (for audit trails)
- Actor attribution (who did this — human, agent, system)
- Schema version (for forward compatibility when event format evolves)
- Full payload with old geometry for reversal

This was built in the foundation sprint, before the renderer worked. That decision — to build the event infrastructure before the visual output — is the kind of choice that separates infrastructure from applications. It's the decision Figma made (CRDT-based operational transforms from day one) and that Notion made (block-based data model before the UI was pretty).

The implementation is incomplete:
- Event store is trapped in Rust memory — no WASM binding exposes it to JavaScript
- Events are not persisted to disk
- The Actor field defaults to `User { session_id: "local" }` — no actual session tracking
- No event replay to reconstruct state from scratch

But the *shape* is right. The gaps are engineering tasks, not architecture mistakes. When you fix them (expose events to JS, persist to SQLite, wire actor context from sessions), you get: unlimited undo, design branching, AI replay, audit trails, collaborative merge, and training data. For free. Because the foundation is correct.

### The kernel-renderer separation is textbook

```
Kernel (Rust/WASM) → JSON → CadRenderer (Three.js) → Canvas
```

The kernel has zero DOM knowledge. Zero Three.js knowledge. Zero rendering knowledge. The renderer receives serialized JSON and creates visual objects. This was verified by reading both `packages/kernel/src/lib.rs` (no `web_sys` DOM calls, only `console::log`) and `packages/renderer/src/CadRenderer.ts` (receives JSON strings, creates `THREE.Object3D`).

This means:
- The kernel can run headlessly (in Node.js, in a test harness, on a server)
- The same kernel code compiles to both WASM (browser) and native Rust (server)
- The `Cargo.toml` already declares `crate-type = ["cdylib", "rlib"]` — native linking is ready
- An AI agent can operate the kernel without any rendering context

This is the hardest thing to get right in a CAD system and it's already correct.

### The Autodesk diagnosis is accurate

AutoCAD's architecture is file-based (DWG, designed 1982), single-user, desktop-only, and hasn't fundamentally changed its core data model in 40 years. Revit is better architecturally but still a C++ monolith with no real-time collaboration, no meaningful programmatic API, and no browser deployment. The $2,000/year pricing survives on institutional inertia, training investment lock-in, and the switching cost of decades of DWG files — not on technical merit.

The market is genuinely vulnerable to disruption. But vulnerable is not the same as easy.

---

## Where the Vision Diverges from Reality

### The timeline is not honest

The vision says "22 weeks to alpha" with 3D parametric CAD, CSG booleans, STEP file support, constraint solver, feature tree, bevy_ecs integration, and AI copilot.

What the codebase actually has today:
- 18 geometry types (all 2D: line, circle, arc, polyline, rectangle, ellipse, spline, text, dimensions, blocks, hatches, tables)
- 60+ commands (all 2D operations)
- A constraint solver with 8 constraint types (Fixed, Coincident, Horizontal, Vertical, Distance, Parallel, Perpendicular, EqualLength) using iterative projection
- No 3D geometry of any kind
- No B-Rep kernel
- No CSG booleans
- No STEP parser
- No feature tree
- No sketch-on-plane

The gap from 2D drafting to 3D parametric CAD is not incremental. It is a cliff:

**Sketch-on-plane alone** — projecting a 2D sketch onto an arbitrary 3D face, solving constraints in the sketch coordinate system, then extruding the profile — is a multi-month engineering project. FreeCAD's sketch solver took years to stabilize.

**CSG booleans** — Manifold (the library referenced in the research docs) does CSG on triangle meshes, not on B-Rep solids. Mesh booleans and B-Rep booleans are fundamentally different problems. Mesh gives you visual output. B-Rep gives you parametric editability. A real parametric modeler needs B-Rep. OpenCASCADE (the only open-source B-Rep kernel) took 30 years and hundreds of engineers.

**STEP file support** — STEP (ISO 10303) is one of the most complex file formats ever designed. The specification is over 1,000 pages. The `opencascade.js` WASM port exists but integrating it with an event-sourced command bus is a research project, not a sprint task.

A timeline that respects reality:
- **8 weeks:** 2D + AI MVP (MCP server, DraftingAgent, live demo)
- **6 months:** 3D primitives (extrude, revolve, basic booleans via Manifold mesh ops)
- **12 months:** Parametric alpha (sketch-on-plane, feature tree, STEP import via OCCT)
- **18+ months:** Production-grade parametric CAD

An honest timeline builds trust — with yourself, with potential co-founders, and with investors. A fantasy timeline builds disappointment.

### "First AI-native, browser-first engineering design platform" — this claim is false

Competitors that already exist:

**Onshape** (PTC, launched 2015) — browser-native parametric 3D CAD with real-time collaboration, REST API, full parametric feature tree. Not AI-native (no command bus), but browser-first and shipping to paying customers for 11 years.

**Zoo.dev** (formerly KittyCAD, $30M funded) — Rust geometry kernel, browser-native, AI API, command-based architecture. This is almost exactly the same thesis. They have a team and capital.

**Shapr3D** — iPad/browser CAD with a real ACIS kernel. Consumer-friendly. Growing.

**CADmium** (open source) — Rust + WASM + Three.js CAD. Similar architecture. Early but active.

The claim of being "first" is dangerous because:
1. It's factually wrong, which damages credibility
2. It focuses attention on primacy instead of differentiation
3. It invites comparison on dimensions where competitors are ahead (funding, team size, feature completeness)

What IS genuinely unique about NEXUS:
- **Event-sourced command bus** — no competitor has this. Onshape has version history but not an append-only event log with actor attribution and AI replay.
- **Civil engineering domain focus** — no browser-native tool targets civil specifically. Onshape/Shapr3D are mechanical. Zoo.dev is general-purpose.
- **The combination** of event sourcing + command-bus AI parity + civil domain + offline-first.

Lean into the combination. Drop the "first" claim.

### The document romanticizes AI and undersells the geometry problem

The hardest unsolved problem is not "how does the AI call the kernel." That's solved — `execute_command(json)` exists, the MCP server design is done, rmcp + Rig are production-ready frameworks.

The hardest problem is: **does the kernel do enough for the AI's output to be useful?**

When the DraftingAgent calls `create_line`, `create_rectangle`, `add_constraint_parallel` — the output is a 2D wireframe. It looks like a sketch, not an engineering drawing. For the AI to produce something a civil engineer would actually use, the kernel needs:

- Hatching (partially implemented — `CreateHatch` command exists but renderer doesn't draw it)
- Proper dimension styles (text height, arrow styles, tolerance notation)
- Title blocks and drawing borders
- Line weights that render visibly differently
- Print/export to PDF at correct scale
- Symbol libraries (north arrow, section marks, level markers)

These are not glamorous features. They're the difference between a demo and a tool. The vision document talks about "parametric 3D design" and "digital twins" while the actual product can't yet produce a drawing that a civil engineer would print and stamp.

The 80/20 reality: **the AI architecture is ready (20% of work). The kernel and rendering completeness are not (80% of work).** The document should say this explicitly.

---

## What's Missing

### No revenue model

The document says "building infrastructure for how physical things get designed for the next 30 years" but doesn't say how you eat next year. This tension between vision project and revenue project is real and the north star document should acknowledge it.

Options to consider:
- **Freemium 2D tool + paid AI features** — the drawing tool is free, the AI drafting assistant is $20/month. Low barrier to entry, AI is the differentiator.
- **Open-source core + paid cloud/collaboration** — kernel and 2D app are MIT-licensed (attracts developers, builds community), server/collaboration/AI features are commercial.
- **Funding runway is limited** — the project needs a sustainable path (sponsors, hosting, services).

The north star should include the business model, even if it's a hypothesis. A vision without a revenue path is a hobby.

### No user validation

"The solo engineer who can't afford Autodesk" — have you talked to 10 of them?

Possible pain points they might report:
1. **"I want free/cheap CAD"** — FreeCAD already solves this (poorly, but it's free). Is the pain "browser-native" or "free"?
2. **"I want AI to help me draft"** — this is the vision's bet. But do civil engineers trust AI with geometry? Or do they want AI for the tedious parts (dimensions, title blocks, quantity takeoffs) but not the design parts?
3. **"I want collaboration"** — Onshape already does this for mechanical. Is the civil engineering community specifically underserved?
4. **"I want offline-first"** — civil engineers on job sites with poor connectivity. This is a genuine pain that cloud-only tools (Onshape, Figma) don't solve.

The architecture supports pivoting to whichever pain is sharpest — that's the beauty of the command bus. But you need to know which pain to attack.

### No scope boundary

The vision document describes: 2D CAD, 3D parametric CAD, BIM, GIS, civil engineering, structural analysis, surveying, remote sensing, construction robotics, point cloud processing, and digital twins. The USES schema in `docs/schemas/uses.ts` defines entity types for all of these domains.

That's not a product. That's an industry.

The architecture is correctly designed to *eventually* support all of these (ECS data model, domain-agnostic command bus, additive expansion rule). But trying to build all of them simultaneously is how startups die.

Pick one wedge:

> **AI-assisted civil 2D drafting in the browser. No install, no $2K/year, no file management.**

Go deep on that. Get users. Get revenue. Then expand. The 3D, BIM, GIS, and digital twin capabilities are the roadmap for years 2-5, not the launch product.

---

## What to Actually Do Next

### Immediate (this month)

1. **Build the MCP server.** Phase 1 from `13-agent-server-design.md`. Fifteen Tier 1 tools via rmcp. Connect to Claude. Test with Claude Desktop. This is 2 weeks of work and it proves the AI thesis end-to-end.

2. **Record the demo.** "User types 'draw a 3-bedroom apartment with dimensions' → AI creates it live in the browser." This video is worth more than any vision document. It's the proof that the founding insight works.

3. **Talk to 10 civil engineers.** Before building 3D. Before integrating bevy_ecs. Before spending 6 months on parametric modeling. Show them the 2D tool. Show them the AI demo. Ask: "Would you use this? Would you pay for this? What's actually painful about your current workflow?"

### Near-term (next 8 weeks)

4. **Ship the 2D+AI MVP.** Working product: browser-based 2D drafting with AI assistant that can create floor plans, structural layouts, and site plans from natural language. DXF export. Offline-capable. Free tier.

5. **Complete the kernel gaps that matter for civil 2D:**
   - Hatch rendering (command exists, renderer doesn't draw it)
   - Proper dimension styles
   - PDF export (server-side via `printpdf` or `typst`)
   - Title block templates
   - Symbol library (basic civil symbols)

6. **Write the honest pitch.** Not "first AI-native platform" but: "The only tool where you can describe a structural layout in English and get a dimensioned, constrained, DXF-exportable drawing in 30 seconds. Browser-native, offline-capable, $0 to start."

### Medium-term (3-6 months)

7. **Tier 2 semantic tools.** `draw_wall`, `place_column`, `add_beam`, `add_door`, `check_structural_spacing`. These are the civil engineering differentiator. No competitor has domain-specific AI tools for civil.

8. **Workflow engine.** "When a column is placed, auto-check spacing against ACI-318." This is the n8n-for-engineering vision. It's where the product becomes sticky.

9. **Revenue.** Launch paid tier. AI features, collaboration, workflow automation. Validate willingness to pay.

### Long-term (6-18 months)

10. **3D foundation.** Only after the 2D product has paying users and validated demand. Start with extrude/revolve of 2D sketches (the natural extension of what already works). Use Manifold for mesh booleans initially. B-Rep via OCCT later.

---

## The Three Lines for the Wall

```
INSIGHT:  Every design operation is structured data.
          AI and humans speak the same language to the kernel.

WEDGE:    AI-assisted civil engineering drafting in the browser.
          No install. No $2K/year. No file management.

MOAT:     Event-sourced command bus.
          The design history is a replayable, branchable, AI-readable stream.
          Built from day one. Not bolted on.
```

Everything else — 3D, BIM, GIS, digital twins, robots — is the roadmap. Not the mission.

---

## The Version for Investors

> We're building what Figma built for design, but for civil engineering — browser-native, AI-first, open architecture. The geometry kernel compiles from the same Rust source to both the browser and the server. Every operation is a serializable event — which means the AI reads and writes the same commands as the engineer. We have a working 2D product with 60 commands, a constraint solver, DXF import/export, and an AI agent server design ready for implementation. The civil engineering CAD market is $4B/year and no one has built a browser-native, AI-assisted tool for it. We're targeting solo engineers and small firms first with a freemium model — free 2D drafting, paid AI features at $20/month.

---

## Closing

The codebase is stronger than the vision document. The architecture decisions are sound. The AI integration isn't a future plan — it's a structural property of code that already runs. The danger is not that the foundation is wrong. The danger is that the ambition outruns the execution capacity, and you end up with a 3D prototype that doesn't work instead of a 2D product that ships.

Ship the 2D+AI. Talk to users. Get revenue. Then expand.

The command bus will be there when you're ready for 3D. That's the whole point of building the foundation right.
