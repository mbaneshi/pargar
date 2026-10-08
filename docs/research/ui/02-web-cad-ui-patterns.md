# Web CAD UI Patterns — Extracted from Vendor Studies + Research Findings

## 1. Chili3D — Vanilla Web Components + Three.js

### Stack
- **Framework:** None. Pure Web Components (`customElements.define()`)
- **Rendering:** Three.js 0.181 + three-mesh-bvh
- **Bundler:** Rspack
- **Styling:** CSS Modules (scoped, no runtime)

### Architecture
- `@chili3d/core` — domain types, commands, PubSub, math, snaps (zero UI deps)
- `@chili3d/element` — DOM element factories: `div()`, `span()`, `button()`, `svg()`
- `@chili3d/ui` — Web Components: MainWindow, Editor, Ribbon, Viewport, Statusbar, PropertyView
- `@chili3d/three` — Three.js rendering layer
- `@chili3d/app` — orchestration, command service, hotkey service

### State Management
- **Typed PubSub singleton** with `PubSubEventMap` (~30 events)
- Components subscribe in `connectedCallback()`, unsubscribe in `disconnectedCallback()`
- `Observable` base class with `onPropertyChanged`
- `ObservableCollection` for arrays with `onCollectionChanged`
- No external state lib — all hand-rolled

### Command System
- `ICommand` interface with `execute(application)`
- `CancelableCommand` with async lifecycle: `beforeExecute()` → `executeAsync()` → `afterExecute()`
- `CommandStore` — global `Map<string, CommandConstructor>`, registered via `@command` decorator
- **Dispatch:** UI click → `PubSub.pub("executeCommand", key)` → `CommandService` → `CommandStore.getCommand()` → execute

### Layout
- MainWindow → Editor (ribbon + sidebar + viewport + statusbar)
- Manual drag-resize for sidebar (mousedown/mousemove)
- No docking library

### Verdict
- Clean command architecture, good decoupling
- Manual DOM management is verbose (reinventing React/Svelte)
- No reactive binding system — hand-built `Binding` and `Localize` classes
- **Take:** Command pattern + PubSub. **Leave:** Manual DOM manipulation.

---

## 2. CAD Viewer / MLightCAD — Vue 3 + Element Plus

### Stack
- **Framework:** Vue 3 (Composition API, `<script setup>`)
- **UI Library:** Element Plus (menus, buttons, dialogs, messages)
- **Rendering:** Three.js 0.172
- **i18n:** vue-i18n

### Architecture
- `@mlightcad/cad-simple-viewer` — core engine (framework-agnostic): document, commands, editor, view, spatial index
- `@mlightcad/cad-viewer` — Vue component library (the full UI)
- `@mlightcad/three-renderer` — Three.js rendering
- `@mlightcad/data-model` — DWG/DXF data model
- `@mlightcad/ui-components` — shared toolbar/button components

### State Management
- Minimal Vue `reactive()` store: just fileName + dialog state
- Event bus from core engine for engine-to-UI communication
- Composables: `useSettings()`, `useLocale()`, `useNotificationCenter()`, `useEntityDrawStyle()`

### Command System (AutoCAD-faithful)
- Commands extend `AcEdCommand` (AutoCAD naming: `AcApLineCmd`, `AcApZoomCmd`)
- `AcEdCommandStack` registers by name
- String dispatch: `AcApDocManager.instance.sendStringToExecute(command)`
- **Prompt state machine** (`AcEdPromptStateMachine`): prompt → keyword → jig system
- Toolbar buttons dispatch strings: `handleCommand = (cmd) => sendStringToExecute(cmd)`

### Layout
- Header (menu + language), Main (toolbars + palettes + dialogs), Footer (status bar)
- Canvas at z-index 1, UI overlay at z-index 2
- Fixed toolbars on right side
- `MlPaletteManager` for layer/property palettes

### Verdict
- Faithful AutoCAD command API is powerful and proven
- Element Plus gives production-ready widgets fast
- Heavy framework lock-in to Element Plus design system
- **Take:** String-based command dispatch + prompt state machine. **Leave:** Element Plus lock-in.

---

## 3. ReplicAD Studio — React + MobX-State-Tree

### Stack
- **Framework:** React 18 (JSX, not TSX)
- **Styling:** styled-components (CSS-in-JS)
- **State:** MobX-State-Tree (MST)
- **3D:** React-Three-Fiber + drei
- **Editor:** Monaco Editor (VS Code in browser)
- **WASM bridge:** Web Worker + Comlink

### Architecture
- `replicad` — core geometry (wraps OpenCascade.js, zero UI deps)
- `replicad-opencascadejs` — WASM OCCT bindings
- `replicad-threejs-helper` — mesh generation from OCCT shapes
- `replicad-evaluator` — code evaluation engine
- `studio` — React app (editor + viewer)

### WASM Bridge (important pattern)
- OCCT runs in a dedicated Web Worker
- `Comlink.wrap()` exposes worker API as async functions
- UI calls `api.buildShapesFromCode(code, params)`
- Keeps UI thread responsive during heavy computation

### Layout
- `@devbookhq/splitter` for resizable panes (code left, 3D right)
- Floating info panels for overlays
- React Router v5 for page routing

### Verdict
- Worker + Comlink for WASM is excellent — directly applicable to NEXUS
- MST is overkill when you have event sourcing
- React + styled-components is heavy
- **Take:** Comlink worker pattern, computation/rendering separation. **Leave:** MST, styled-components.

---

## 4. That Open Components — Framework-Agnostic Three.js

### Stack
- **Framework:** None (pure TypeScript + Three.js)
- **UI:** Separate `@thatopen/ui` package (web components, not in this repo)
- **Dependencies:** Three.js 0.182, three-mesh-bvh, camera-controls, web-ifc

### Architecture
- `@thatopen/components` (core) — Components, Worlds, Views, Cameras, Grids, Raycasters, Fragments
- `@thatopen/components-front` — PostproductionRenderer, Markers, Civil views, Drawings

### Component System
- `Components` root class, components registered by static UUID
- `components.get(SomeComponent)` — lazy singleton (auto-creates on first access)
- Each component has typed events: `onDisposed`, `onAfterUpdate`, etc.
- Interfaces: `Disposable`, `Updateable`, `Configurable`
- `World` owns scene + camera + renderer; `Worlds` manages multiple worlds

### Verdict
- Framework-agnostic core is the gold standard — works with any UI framework
- UUID singleton registry is elegant for plugins
- No command/tool system — this is a viewer/data library, not a CAD app
- **Take:** Framework-agnostic core, UUID registry, Disposable/Updateable interfaces. **Leave:** BIM-specific coupling.

---

## 5. CADmium — Svelte 4 + Threlte (from research findings)

### Stack
- **Framework:** Svelte 4 + SvelteKit + Tailwind
- **3D:** Threlte (declarative Three.js for Svelte)
- **WASM bridge:** tsify + serde + wasm-bindgen (JSON)

### State Bridge Pattern
- Staleness-flag cascade: mutation → `workbenchIsStale.set(true)` → refresh JSON from WASM → `realizationIsStale.set(true)` → refresh realization → Svelte re-render
- Full project state in Rust/WASM, JS gets JSON snapshot via `wasmProj.get_realization()`
- CRC32 hashes on vertex data as Svelte keyed-each keys (geometry only recreated when mesh changes)
- **Weakness:** Full JSON re-serialization on every mutation — doesn't scale past ~1k entities

### Threlte Integration
- Declarative Three.js: `{#each solids as solid}` maps to `<Solid>` components
- No manual `scene.add()/remove()` — Svelte lifecycle handles it
- Threlte v7+ supports Svelte 5

---

## 6. Zoo Design Studio (from research findings)

### Stack
- **Framework:** React + Tailwind
- **State:** XState state machines
- **WASM:** kcl-lib Rust/WASM
- **Renderer:** Cloud video stream (`<video>` element)

### Key UI Patterns
- XState `modelingMachine` manages tool states (idle, drawing, selecting, extruding)
- Codemods = GUI-to-code translation (every click → AST modification)
- `KclManager` orchestrates: parse → AST → execute (WASM) → update editor → render
- Feature Tree backed by `Operation` enum with source range + arguments — bidirectional navigation
- Command palette (CommandBar) for discoverability

---

## Cross-Project Comparison

| Concern | Chili3D | MLightCAD | ReplicAD | That Open | CADmium | Zoo |
|---------|---------|-----------|----------|-----------|---------|-----|
| **Framework** | None (Web Components) | Vue 3 | React 18 | None (pure TS) | Svelte 4 | React |
| **UI lib** | Custom | Element Plus | styled-components | Separate pkg | Tailwind | Tailwind |
| **State** | Typed PubSub | Vue reactive | MobX-State-Tree | Per-component events | Svelte stores | XState |
| **Command system** | CommandStore + decorators | AutoCAD-style string dispatch | Minimal (code eval) | None (viewer only) | Message enum | Codemods |
| **WASM bridge** | Emscripten embind | N/A | Comlink + Worker | N/A | JSON over wasm-bindgen | kcl-lib |
| **3D** | Three.js direct | Three.js direct | React-Three-Fiber | Three.js direct | Threlte | Cloud stream |
| **Layout** | Fixed + manual resize | Fixed + z-index overlay | Splitter lib | N/A | SvelteKit | React layout |
| **Docking** | No | No | No | No | No | No |

**Notable: NONE of the web CAD projects have a proper docking/panel system.** This is a gap in the entire ecosystem.

---

## Libraries Used Across Projects

| Library | Used By | Purpose | Applicable to NEXUS? |
|---------|---------|---------|---------------------|
| Three.js | All | 3D rendering | Already using |
| three-mesh-bvh | Chili3D, That Open | Fast raycasting | Yes, for selection at scale |
| camera-controls | That Open | Smooth camera | Consider for viewport |
| Comlink | ReplicAD | Worker communication | Yes, for WASM bridge |
| @devbookhq/splitter | ReplicAD | Resizable panes | Evaluate |
| Element Plus | MLightCAD | Vue UI components | No (Vue-only) |
| Monaco Editor | ReplicAD | Code editing | If adding scripting |
| Threlte | CADmium | Declarative Three.js/Svelte | Evaluate for v0.2+ |
| Tailwind | CADmium, Zoo | Utility CSS | Evaluate |
