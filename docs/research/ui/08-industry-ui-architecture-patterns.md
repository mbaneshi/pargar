# Industry UI Architecture Patterns for Browser CAD

> **Date:** 2026-04-19
> **Purpose:** Distilled patterns from Figma, Blender, AutoCAD, FreeCAD, VS Code, and Linear applicable to NEXUS UI architecture. Research feeding into architecture proposal `35-ui-system-design.md`.

---

## 1. Figma — Canvas/UI Separation + Plugin Sandboxing

### Architecture
- **Hard split:** C++ compiled to WASM owns scene graph + rendering. React owns everything outside the canvas (toolbars, panels, dialogs).
- The UI framework **never touches the canvas**. React renders DOM elements *around* a WebGL/WebGPU canvas that native code paints to. No framework overhead in the render loop.
- Communication crosses the WASM boundary via serialized messages — directly analogous to our Rust/WASM kernel + Svelte UI split.

### Rendering
- Custom tile-based GPU renderer, originally WebGL, now migrating to **WebGPU** (shipped 2023+).
- Compute shaders move work from CPU to GPU for parallelism.
- 60fps at scale by treating the canvas like a game engine, not a DOM application.

### Performance at Scale
- **Multiplicative complexity** is the core challenge: "everything needs to work with everything else" — heterogeneous selections, varying resize behaviors, text reflow.
- WASM memory is grow-only and 32-bit (4GB max). They pre-allocate expected memory and use lazy page loading for large files.
- Full in-browser integration tests with real GPU to catch WebGL + CSS + React interaction bugs.

### Plugin System
Two-zone architecture:
1. **QuickJS compiled to WASM** (main thread sandbox) — accesses Figma document/scene but NOT browser APIs.
2. **iframe** — accesses browser APIs (fetch, DOM, Canvas, WebGL) but NOT the Figma scene.
3. Communication between zones is **message-passing only**.

They moved from JavaScript Realms shim to QuickJS-in-WASM after security vulnerabilities. This is the gold standard for plugin sandboxing on the web.

**NEXUS applicability:** Our MCP tool schema approach is superior for AI agents. For human-authored plugins, QuickJS-in-WASM + iframe UI + message-passing is the proven pattern.

---

## 2. Blender — Operator System + Notification Bus

### Operator System (Commands-as-Data)
`wmOperatorType` registry defines three execution modes:
- **`exec`** — non-interactive (scripts, AI, repeat-last). No events, no modal state.
- **`invoke`** — starts interactive mode. May finish immediately or return `RUNNING_MODAL`.
- **`modal`** — handles every subsequent event while modal. Returns `RUNNING_MODAL`, `FINISHED`, or `CANCELLED`.
- **`poll`** — precondition check. Failed polls silently disable the operator.

Maps to our `CommandDef`: `execute(params)` = exec, `invoke()` = invoke, `ToolHandler` = modal.

### Notification Bus
Typed notification categories: `NC_SCENE`, `NC_OBJECT`, `NC_MATERIAL`, etc.
- Editors subscribe only to categories they care about — redraw only on relevant changes.
- Events (user input) strictly separated from Notifiers (data change signals to UI).
- Each Area is independent — two 3D viewports showing different camera angles, both reacting to same `NC_OBJECT` notifications.

**NEXUS applicability:** Our `CadEvent` types ARE the notification categories. Panels subscribe to event types they care about. Renderer subscribes to geometry events. Properties panel subscribes to selection events. Layer panel subscribes to layer events.

### Multiple Editors Sharing State
- `PASS_THROUGH` — a modal operator can pass events it doesn't handle to lower-priority handlers (viewport navigation). Zoom/pan works during any tool.
- This enables transparent commands without canceling the active tool.

---

## 3. AutoCAD — Command-First Interaction

### Prompt State Machine
Every operation is a string command: `LINE`, `CIRCLE`, `MOVE`, `TRIM`. Toolbar buttons emit command strings, they don't call functions directly. The command line and toolbar are equivalent input paths.

### Dynamic Input / Heads-Up Display (HUD)
DYNMODE has three components at the cursor:
1. **Pointer Input** — coordinates, lengths, angles as you move.
2. **Dimension Input** — editable fields for exact values beside the cursor.
3. **Dynamic Prompts** — command instructions and options at the crosshair.

This is a floating command line at the cursor. It does NOT replace the traditional command line — it mirrors it. Same state source, two views.

### Command Dispatch Priority (LibreCAD implementation)
In `LC_EventHandler::commandEvent()`:
1. Parse as coordinate. If valid, send to current action. **Stop.**
2. Send as `commandEvent()` to current action. If action accepts, **stop.**
3. Propagate to global command resolution (`cmdToAction()`).

This three-level dispatch (coordinate -> tool sub-command -> global command) solves the class of bugs where global shortcuts override tool-local commands.

---

## 4. FreeCAD — Workbench System (Domain Plugins)

### Architecture
A `Workbench` is a **declarative UI config**, NOT a widget:
- Returns data trees of command IDs: `setupMenuBar()`, `setupToolBars()`, `setupDockWindows()`.
- On activation: the manager diffs current UI and adds/removes/shows/hides elements.
- Adding a domain = creating a new Workbench, not modifying core UI code.

### Task Watcher Pattern
`TaskWatcher` — passive panels that auto-show/hide based on selection filters. Selection drives which panels are visible. Combined with **SelectionObserver** pattern: properties panel rebuilds on selection change.

**NEXUS applicability:** Maps directly to `DomainModule` registration in `34-platform-architecture.md`. Each domain registers commands, toolbars, panels, keymaps. Shell loads/unloads them.

---

## 5. VS Code / Linear — Command Palette + Layered Keymaps

### Command Palette
- Single keyboard trigger (`Cmd+K` or `Cmd+Shift+P`) available from anywhere.
- Unified search over: commands, recently used commands, entities, files.
- `>` prefix for commands, no prefix for file search, `:` for line number.
- Fuzzy matching with scoring: exact > prefix > substring > fuzzy.
- Keyboard shortcuts displayed inline next to matching commands (teaches users shortcuts organically).

### Layered Keymaps
1. **Global layer:** `Ctrl+Z`, `Ctrl+S` — always active.
2. **Mode layer:** shortcuts active only in current mode (IDLE vs TOOL_ACTIVE vs SELECTED).
3. **Tool layer:** shortcuts active only during specific tool (`C` = close during line tool).
4. **Component layer:** shortcuts scoped to focused panel (Delete in layer panel vs canvas).

Keymaps stored as **data, not code** — JSON/object maps from key combos to command IDs. Enables user customization and per-domain rebinding.

### Chord Sequences
`Ctrl+K, Ctrl+W` — first key enters "chord mode", second key completes. Two-state mini state machine that resets on timeout (~1.5s).

---

## 6. Svelte 5 Patterns for Large Apps (2025-2026 Consensus)

### Reactive Classes (Primary Pattern)
```typescript
class SelectionState {
  selectedIds = $state<Set<string>>(new Set());
  get count() { return this.selectedIds.size; }  // auto-reactive
}
export const selectionState = new SelectionState();
```

Rules:
- **Classes outperform plain objects** — V8 optimizes class shapes.
- **`$derived` over `$effect`** — any computed value derivable from state should use `$derived`.
- **`$effect` is an escape hatch** — use only for DOM side effects, logging, external system sync.
- **Don't export raw `$state` variables** — they freeze at import time. Wrap in classes.
- `.svelte.ts` extension required for files using runes outside components.

### Component Composition
- **Snippets over slots** for typed, composable UI blocks.
- **Callback props over events**: `onclose` function prop instead of `dispatch('close')`.
- **Domain-driven file organization**: `src/lib/domains/cad/`, `src/lib/domains/bim/`.

---

## 7. Performance Patterns

### Canvas Interaction
- **Pointer move:** throttle to `requestAnimationFrame` cadence (RAF is the natural throttle).
- **Property panel updates:** debounce 100-300ms while typing values.
- **Snap calculations:** run synchronously per frame — must be instantaneous for perceived responsiveness.

### Web Worker Offloading
- **OffscreenCanvas** in a worker: transfer canvas via `.transferControlToOffscreen()`, run RAF inside the worker. Animation continues even if main thread blocks.
- **Comlink**: wraps worker API as async functions. WASM kernel calls can use this pattern.
- Rule of thumb: computation > 16ms goes to a worker.

### Dirty Flag Pattern
Only re-render when state changed. Set `needsRender = true` on state change, check in RAF loop. Separate update and render: `update(dt)` processes state changes, `render()` draws. Update can run at different rates.

---

## 8. What Makes Professional Tools Feel Professional

1. **Immediate visual feedback:** every input produces visible response within one frame (16ms). Snap indicators, rubber-band previews, cursor hints update at RAF cadence.
2. **The UI never blocks the canvas:** DOM rendering and canvas rendering are independent. A Svelte re-render of the toolbar does not cause a frame drop in the viewport.
3. **One state, many views:** command line, HUD, toolbar, and AI agents read/write same state machine. No divergence.
4. **Progressive disclosure:** new users use menus/toolbars, intermediate users use command palette, power users use shortcuts. Same commands, three access levels.
5. **Tools are data, not code paths:** operators/commands stored as data objects with metadata. UI auto-generates from data. Adding a tool = registering data, not modifying UI code.

---

## Sources

- [Figma Rendering: Powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)
- [Notes From Figma II: Engineering Learnings](https://andrewkchan.dev/posts/figma2.html)
- [Figma Architecture Overview (Evan Wallace)](https://madebyevan.com/figma/)
- [Figma Plugin System Architecture](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/)
- [Figma Plugin Security Update](https://www.figma.com/blog/an-update-on-plugin-security/)
- [Figma WebAssembly Performance](https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/)
- [Blender Operators Documentation](https://developer.blender.org/docs/features/interface/operators/)
- [Blender Window Manager Architecture](https://archive.blender.org/wiki/2015/index.php/Dev:2.5/Source/Architecture/Window_Manager/)
- [Svelte 5 Global State Patterns (Mainmatter)](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)
- [Svelte Best Practices 2026](https://onehorizon.ai/blog/svelte-best-practices-in-2026-scaling-with-runes-snippets-and-pure-reactivity)
- [Command Palette UX Patterns](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [OffscreenCanvas in Web Workers](https://macarthur.me/posts/animate-canvas-in-a-worker/)
