# AI Research Prompts — UI Architecture for Browser CAD

Use these prompts to query Gemini, Claude, GPT, Grok, and Perplexity. Each prompt targets a specific open question. Copy-paste directly.

---

## Prompt 1: Framework Choice for Professional CAD UI (Send to ALL)

```
I'm building a professional 2D/3D CAD application that runs entirely in the browser. Think AutoCAD/FreeCAD level complexity, not a simple drawing tool. The architecture:

- Rust/WASM geometry kernel (ECS data model, event-sourced state, command pattern)
- Three.js for rendering (2D now, 3D later)
- TypeScript for all UI/interaction code
- AI agents are first-class users (MCP protocol, every operation callable without GUI)

The UI needs to support:
- 30+ drawing/editing tools, each with multi-step interactive input (state machines)
- Command line input (AutoCAD-style: type "LINE", click points, type coordinates)
- Property inspector that shows/edits selected entity geometry
- Layer manager (CRUD, visibility, lock, color toggles)
- Dockable/resizable panels (properties, layers, AI agent log, console)
- Toolbar with grouped tool buttons (Draw, Edit, Modify, View)
- Status bar with live coordinates, snap info, selection count
- Context menus per entity type
- Keyboard shortcuts with layered scoping (global, viewport, tool-mode)
- Future: workbench switching (2D CAD → BIM → GIS → Civil) that swaps toolbar/panel configs

I've studied how these projects built their UI:
- LibreCAD (Qt/C++): factory pattern, action type enum, tool state machines, command line
- FreeCAD (Qt/C++/Python): workbench system, task panels, command framework, property factory
- Blender (custom C): area/editor system, operator pattern (exec/invoke/modal), RNA auto-UI
- Chili3D (vanilla Web Components): typed PubSub, command decorators
- MLightCAD (Vue 3 + Element Plus): AutoCAD-faithful command prompt, prompt state machine
- ReplicAD (React + MobX-State-Tree): Worker+Comlink for WASM, React-Three-Fiber
- CADmium (Svelte 4 + Threlte): staleness-flag cascade, CRC32 change detection

Currently using Svelte 5 (runes) + SvelteKit, but I'm NOT locked in. Willing to switch if another framework is genuinely better for this use case.

Questions:
1. Which JS framework would you choose for this specific use case and why? Consider: render performance during 60fps pointer tracking, ecosystem for complex UI components, developer velocity, WASM interop, bundle size.
2. What's the biggest technical risk with each option (Svelte 5, React 18, Vue 3, Solid, vanilla Web Components)?
3. Is a hybrid approach viable? (e.g., Svelte app shell + Web Components for portable UI library)
4. What JS libraries would you recommend for: panel docking, command palette, virtual scrolling for entity lists, keyboard shortcut management?
5. Are there any browser-based CAD or spatial applications I should study that I'm missing?
```

---

## Prompt 2: Panel/Docking System (Send to ALL)

```
I need a panel/docking system for a browser-based CAD application. Requirements:

- Central viewport (Three.js canvas) that must always be visible
- 6-10 auxiliary panels: properties, layers, command line, AI agent log, console, project browser, entity list
- Panels should be: resizable, collapsible, and ideally dockable to edges (like Qt QDockWidget)
- Panels should support tabification (multiple panels sharing same space as tabs)
- Layout state should persist (save/restore to localStorage)
- Future: "workbench switching" that changes which panels are visible
- Must work with Svelte 5 (or be framework-agnostic)
- Performance: panels should not affect viewport rendering performance (60fps)

I've evaluated these libraries:
- dockview (claims framework-agnostic, active development)
- lumino (JupyterLab's panel system, vanilla TS)
- golden-layout (classic but jQuery legacy)
- allotment / svelte-splitpanes (resizable splitters only, no docking)
- rc-dock (React only)

Questions:
1. Which library would you recommend and why?
2. If none are suitable, what's the minimum viable custom implementation? What are the hardest parts to get right?
3. How does JupyterLab's lumino handle panel docking? Is it extractable from JupyterLab?
4. Can dockview render Svelte 5 components inside its panels?
5. Is there a web-component-based docking library I'm missing?
6. Would you recommend starting with fixed layout + splitters and adding docking later? Or is it better to start with docking from day one?
7. How do production desktop-class web apps (VS Code, Figma, Linear) handle their panel layouts?
```

---

## Prompt 3: WASM-to-UI State Bridge (Send to Claude + Gemini)

```
I have a Rust/WASM geometry kernel for a browser-based CAD app. The kernel uses ECS (Entity-Component-System) and event sourcing. The UI is TypeScript (Svelte 5). The problem is efficiently bridging state between WASM and the reactive UI.

Current approach:
- After every command, JS calls `kernel.get_entities_json()` which serializes ALL entities to JSON
- JS parses the JSON and updates Svelte stores
- This works at <1k entities but won't scale to 50k+

I've studied how others handle this:
- CADmium: same problem (full JSON dump), uses CRC32 hashes to skip unchanged meshes
- ReplicAD: Worker + Comlink for async WASM calls, keeps UI responsive
- Speckle: incremental streaming of object changes

Options I'm considering:
1. Incremental serialization: kernel tracks dirty entities, only serializes changed ones
2. SharedArrayBuffer: kernel writes entity data to shared memory, JS reads directly
3. Event callbacks: kernel emits typed change events via wasm-bindgen, JS applies granular updates
4. Binary protocol: instead of JSON, use a compact binary format (flatbuffers, protobuf)

My Rust kernel uses: wasm-bindgen, serde, tsify for type generation.

Questions:
1. What's the most efficient pattern for WASM-to-JS state sync in a CAD/spatial context?
2. Can wasm-bindgen support efficient event callbacks from Rust to JS? What's the overhead?
3. Is SharedArrayBuffer viable for entity component data? What are the synchronization concerns?
4. At what entity count does JSON serialization become the bottleneck vs rendering vs layout?
5. How would you implement incremental change tracking in a Rust ECS that bridges to JS reactivity?
6. Are there existing Rust crates that solve the "sync ECS state to external consumer" problem?
```

---

## Prompt 4: CAD Tool State Machine in TypeScript (Send to Claude + GPT)

```
I'm implementing interactive drawing tools for a browser-based 2D CAD application. Each tool (Line, Circle, Arc, Rectangle, Polyline, etc.) needs a multi-step state machine that handles:

1. Sequential point input (click or typed coordinates)
2. Real-time preview geometry (rubber-band line, circle preview at cursor)
3. Context-sensitive sub-commands (e.g., during Line: "Close", "Undo last point")
4. Options that change behavior mid-tool (e.g., Arc: "Center/Start/End" vs "3-point")
5. Constraint snapping (endpoint, midpoint, center, perpendicular, tangent)
6. Ortho mode (constrain to horizontal/vertical)
7. Coordinate event abstraction (same handler for mouse click and typed "10,20")

I've studied:
- LibreCAD's RS_ActionInterface: integer status + switch dispatch + onCoordinateEvent(status, point)
- FreeCAD's DrawSketchHandler: SeekFirst/SeekSecond/End states + auto-constraint suggestions
- Blender's modal operators: invoke → modal loop → exec/cancel
- MLightCAD's AcEdPromptStateMachine: AutoCAD-faithful prompt/keyword/jig system

Currently using TypeScript with Svelte 5. My tool base class:
```typescript
interface ToolHandler {
  onPointerDown(snap: Vec2, world: Vec2, shift: boolean): void
  onPointerMove(snap: Vec2, world: Vec2): void
  onKeyDown(event: KeyboardEvent): boolean
  onCoordinateInput(point: Vec2): void
  onCommandInput(cmd: string): boolean
  getStatusText(): string
  getAvailableCommands(): string[]
  getPreviewGeometry(): PreviewEntity[]
  activate(): void
  deactivate(): void
}
```

Questions:
1. What's the cleanest TypeScript pattern for multi-step tool state machines? Integer status + switch? Union type states? XState? Something else?
2. How should tools communicate with the command system? (dispatch "CreateLine" command on commit)
3. How to implement the coordinate event abstraction cleanly? (mouse click + typed input → same handler)
4. What's the best pattern for tool chaining? (finish line → auto-restart line tool for continuous drawing)
5. How to handle tool options that change mid-operation? (e.g., Arc switches from 3-point to center-radius mode)
6. Show me a complete TypeScript implementation of a Line tool with: point input, rubber-band preview, "Close" and "Undo" sub-commands, ortho constraint, and coordinate input from command line.
```

---

## Prompt 5: Design System for CAD (Send to Perplexity + Grok)

```
I need to design a design system (tokens, components, patterns) for a professional browser-based CAD application. This is not a typical web app — it's closer to VS Code, Figma, or Blender in complexity.

Requirements:
- Dark theme by default (like AutoCAD, Blender, VS Code)
- Dense information display (small fonts, compact spacing, no wasted space)
- Toggle buttons that show state (snap on/off, ortho on/off, layer visible/locked)
- Property grids (label-value pairs, editable, typed inputs)
- Toolbar buttons with icons, grouped, with optional flyout submenus
- Collapsible panel sections (accordion style)
- Tree views (layer hierarchy, entity tree, project browser)
- Coordinate displays (monospace, right-aligned numbers, unit suffixes)
- Color swatches (layer colors, entity colors)
- Command line (input + scrollable history output)
- Context menus with icons and keyboard shortcut hints
- Must work with Svelte 5 (or be framework-agnostic CSS)

Questions:
1. What design tokens (CSS custom properties) would you define for a CAD app? (colors, spacing, typography, borders, shadows, z-indices)
2. What existing design systems are closest to what a CAD app needs? (VS Code's, JetBrains', Figma's, Blender's)
3. What CSS approach works best for dense, professional UIs? (Tailwind utilities, CSS Modules, CSS-in-JS, plain CSS custom properties?)
4. Are there any open-source design systems specifically for developer tools / professional applications (not consumer web apps)?
5. How do Figma and VS Code handle their internal design tokens?
6. What are the typography best practices for CAD? (monospace for coordinates, proportional for labels, font-size hierarchy)
7. Show me a complete set of CSS custom properties (design tokens) for a dark-themed professional CAD application.
```

---

## Prompt 6: Browser-Based CAD UI Landscape (Send to Perplexity + Grok)

```
I'm researching browser-based CAD applications and their UI implementations. I need a comprehensive survey of what exists and how they built their interfaces.

I already know about:
- Chili3D (vanilla Web Components + Three.js)
- MLightCAD/CAD Viewer (Vue 3 + Element Plus)
- ReplicAD (React + MobX-State-Tree + React-Three-Fiber)
- CADmium (Svelte + Threlte)
- Zoo Design Studio (React + cloud rendering)
- That Open Components (framework-agnostic Three.js components)
- Speckle (Vue + Three.js viewer)
- OnShape (commercial, browser-native CAD)
- Shapr3D (commercial, started iPad, now web)

Questions:
1. What other browser-based CAD/design applications exist? (open source and commercial)
2. For each, what framework/UI toolkit do they use?
3. Which browser-based professional tools (not just CAD — also EDA, GIS, audio/video editing) have the best UI architectures I should study?
4. How does OnShape's UI work? What framework? How do they handle panels, tools, command input?
5. How does Figma's UI architecture work? (they have a similar constraint: canvas app with complex panels)
6. Are there any open-source browser-based applications with dockable panel systems I can study?
7. What JavaScript libraries exist specifically for building professional/desktop-class browser UIs? (not consumer web components)
8. Are there any academic papers or blog posts about building CAD-class UIs in the browser?
```

---

## Prompt 7: Workbench/Mode Switching Architecture (Send to Claude + Gemini)

```
I'm designing a workbench/mode system for a browser-based spatial engineering platform. The platform will eventually support multiple domains:

- 2D CAD (line, circle, arc, dimension, constraints)
- 3D CAD (extrude, revolve, fillet, chamfer, boolean)
- BIM (walls, doors, windows, IFC import, clash detection)
- GIS (layers, CRS transforms, feature attributes, map tiles)
- Civil Engineering (alignments, profiles, grading, pipe networks)
- Point Cloud (LAS/LAZ viewing, classification, segmentation)

Each domain needs different:
- Toolbars (different tools/commands)
- Panels (BIM needs IFC tree, GIS needs layer control, Civil needs alignment table)
- Keyboard shortcuts (domain-specific)
- Viewport behavior (2D pan/zoom vs 3D orbit vs globe navigation)
- Entity types and property schemas

I've studied FreeCAD's workbench system:
- Workbench = declarative config returning trees of command IDs
- Switching = managers diff current UI against new config, add/remove/show/hide
- Sub-modes within workbenches (Sketcher edit mode shows extra toolbars)

Questions:
1. How would you design this workbench system in TypeScript for a Svelte 5 app?
2. Should workbenches be static configs or dynamic plugins? (loaded at build time vs runtime)
3. How to handle cross-domain tools? (Select, Move, Copy, Undo, Zoom work everywhere)
4. How to handle entities that span domains? (a BIM wall has both geometry and IFC properties)
5. What's the data structure for a workbench definition?
6. How to handle the transition? (switching from GIS to BIM shouldn't lose GIS state)
7. Should the renderer change per workbench? (2D Canvas renderer vs 3D WebGL vs CesiumJS globe)
```

---

## Prompt 8: AI Agent UX in CAD (Send to Claude + GPT)

```
I'm designing the AI agent user experience for a browser-based CAD platform. AI agents are first-class users — they can execute any command a human can (via MCP tool schemas). The question is: how should the UI present AI agent actions and allow human review?

Context:
- Every CAD operation is a command (draw_line, modify_offset, create_layer, etc.)
- Commands have typed parameters and produce events in an event log
- AI agents call the same commands via MCP (Model Context Protocol)
- Undo/redo works on the event log (both human and AI actions are events)

Scenarios:
1. User says "draw a 10x10 rectangle at origin" → agent dispatches 4 line commands
2. User says "offset all these walls by 100mm" → agent selects entities, runs offset on each
3. Agent autonomously fixes constraint violations while user draws
4. Agent suggests "did you mean to close this polyline?" as user draws
5. Multiple agents working simultaneously (structural agent + MEP agent)

Questions:
1. Should AI actions execute immediately and rely on undo, or should they require approval before execution?
2. What's the best UI pattern for showing pending AI actions? (inline viewport preview? side panel? diff view?)
3. How should the agent action log work? (chat-like? structured table? timeline?)
4. How to distinguish between human and AI modifications in the viewport? (color coding? labels? ghosts?)
5. How to handle conflicts between simultaneous agents?
6. How should the user "prompt" the agent? (command line? chat panel? voice? selection + natural language?)
7. Study how these tools handle AI suggestions: GitHub Copilot (inline code), Cursor (chat + diff), Adobe Firefly (image gen), Figma AI (design suggestions). Which patterns transfer best to CAD?
8. What's the minimum viable AI UX for a v0.1 release?
```

---

## Prompt 9: Human-Machine Shared Workspace — The Core UX Problem (Send to ALL)

```
I'm building something that doesn't exist yet: a browser-based CAD platform where humans and AI agents are co-equal operators on the same spatial state.

The architecture:
- Event-sourced ECS (Entity-Component-System) in Rust/WASM
- Every event carries Actor attribution: Human { user_id } or Agent { agent_id, model }
- Every operation is a serializable Command callable by GUI click, keyboard shortcut, command line, or AI agent MCP tool call — identically
- Full undo/redo on the event log (both human and AI actions)
- AI agents connect via MCP (Model Context Protocol) and call the same commands humans do

The five interaction modes I've identified:
1. Human works, AI watches (builds understanding silently)
2. Human works, AI assists (ghost geometry suggestions, auto-constraints, validation warnings)
3. Human commands, AI executes ("offset all walls 200mm")
4. AI works, human watches (generative design, optimization)
5. Human and AI co-create simultaneously (human draws walls, AI places doors per code)

The unique challenges vs normal AI UX:
- This is SPATIAL, not textual. AI output is geometry in a shared coordinate space, not text in a chat
- PRECISION matters. A wall that's 0.3mm off from perpendicular is a real bug
- TRUST is critical. This geometry becomes buildings, roads, bridges. Lives depend on correctness
- PACE MISMATCH. Human: 1-5 ops/sec. AI: 100+ ops/sec. The UI can't flash 100 changes per second
- MULTI-AGENT. Eventually 3-5 specialized agents (structural, MEP, civil, compliance) work on the same model simultaneously

I've studied:
- GitHub Copilot: ghost text, Tab to accept (but text, not geometry)
- Cursor: diff preview, accept/reject (but code, not spatial)
- Figma multiplayer: cursors, names, real-time (but human-human, not human-AI)
- FreeCAD Sketcher: auto-constraint suggestions (closest to what I need, but no AI)
- Grasshopper/Rhino: parametric sliders updating geometry in real-time (closest for Mode 4)

Questions:
1. What is the right UX pattern for showing AI suggestions in a 2D/3D viewport? Ghost geometry? Overlay annotations? Something else?
2. How should the trust spectrum work? (From "preview everything and ask" to "work autonomously, I'll review later")
3. When AI modifies existing geometry, how should the viewport communicate what changed? Highlight? Animation? Diff view?
4. How should a human "steer" a generative design AI mid-run? (Mode 4)
5. How do you handle conflict when human and AI try to modify the same entity simultaneously?
6. What's the right information architecture? Where do AI interactions live in the UI? (viewport overlay, side panel, command line, all three?)
7. Are there any products — in ANY domain (games, music, design, robotics) — that have solved human-AI real-time spatial collaboration?
8. What academic research exists on human-AI co-creation in spatial/design domains?
9. What's the minimum viable human-AI UX that I should ship first?
```

---

## How to Use These Prompts

### Per-model strategy:

| Model | Best for | Send prompts |
|-------|----------|-------------|
| **Claude** | Deep architectural analysis, code examples, trade-off reasoning | 1, 3, 4, 7, 8 |
| **Gemini** | Broad research, Google ecosystem knowledge, web platform details | 1, 2, 3, 7 |
| **GPT-4** | Code generation, implementation details, React/Vue ecosystem | 1, 4, 8 |
| **Grok** | Contrarian opinions, recent open-source projects, X/Twitter discourse | 5, 6 |
| **Perplexity** | Web search, finding repos/libraries/blog posts, landscape surveys | 2, 5, 6 |

### Cross-referencing:
- Send Prompt 1 (framework choice) to ALL five. Compare answers.
- Where they agree = high confidence. Where they disagree = needs prototyping.
- Save responses as `docs/research/ui/responses/` for future reference.
