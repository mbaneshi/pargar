# Desktop CAD Patterns → JavaScript/Browser Mapping

Every desktop CAD app solves the same UI problems. This document maps their Qt/GTK/custom solutions to browser equivalents — framework-agnostic where possible.

---

## 1. Command Registry

### Desktop Pattern
- LibreCAD: `RS2::ActionType` enum + `RS_Commands` singleton (string → action ID → factory → instance)
- FreeCAD: `CommandManager` map of string ID → Command object with metadata + execute + isActive
- Blender: `wmOperatorType` registered with idname, callbacks (exec/invoke/modal/poll), RNA properties

### Browser Equivalent
```
CommandRegistry = Map<string, CommandDef>

CommandDef = {
  id: string                    // "draw_line", "modify_offset"
  label: string                 // "Line"
  icon?: string                 // SVG or icon class
  shortcut?: string             // "L", "Ctrl+Shift+O"
  aliases?: string[]            // ["li", "line", "ln"]
  category: string              // "draw", "modify", "view"
  isActive?: () => boolean      // can this run now?
  execute: (params) => void     // non-interactive execution (AI/scripts)
  invoke?: () => ToolHandler    // interactive mode (returns a tool state machine)
  schema: JSONSchema            // parameter schema (MCP tool schema)
  undoable: boolean
}
```

### Key Insight
Blender's `exec` vs `invoke` split is critical:
- `execute(params)` = what AI agents and command-line type. No UI context needed.
- `invoke()` = what toolbar clicks trigger. Returns a modal tool handler for interactive input.
- Same command, two entry points. This is NEXUS Rule 1 made concrete.

### JS Libraries
- None needed — a typed Map + registration function is sufficient
- Consider: decorator-based registration like Chili3D's `@command` pattern

---

## 2. Tool State Machine

### Desktop Pattern
- LibreCAD: integer `status` field + switch-based dispatch per status. `onCoordinateEvent(status, point)`.
- FreeCAD Sketcher: `DrawSketchHandler` with SeekFirst/SeekSecond/End states + template hierarchy
- Blender: modal operators with `RUNNING_MODAL` return + `PASS_THROUGH` for non-conflicting events

### Browser Equivalent
```
interface ToolHandler {
  status: number
  onPointerDown(point: Vec2, raw: PointerEvent): void
  onPointerMove(point: Vec2, raw: PointerEvent): void
  onKeyDown(key: string, event: KeyboardEvent): boolean
  onCoordinateInput(point: Vec2): void     // from command line typed input
  onCommandInput(cmd: string): boolean     // sub-commands ("close", "undo")
  getAvailableCommands(): string[]         // context-sensitive commands
  getStatusText(): string                  // "Specify start point:"
  getMouseHints(): { left: string, right: string }  // what clicks do
  getPreviewGeometry(): PreviewEntity[]    // rubber-band lines etc.
  activate(): void
  deactivate(): void
}
```

### Key Insight
**Coordinate event abstraction** (from LibreCAD): Mouse clicks AND typed coordinates produce the same `onCoordinateInput(point)`. This decouples input method from tool logic. A tool doesn't care if the point came from a click, a typed "10,20", or an AI agent parameter.

### JS Implementation Options
- Simple class with status integer + switch statements (LibreCAD pattern — proven, simple)
- XState state machine (Zoo pattern — more formal, better visualization/debugging)
- Svelte 5 runes-based state ($state for status, $derived for computed) — reactive but tool-local

---

## 3. Property Inspector

### Desktop Pattern
- LibreCAD: per-entity-type editing dialogs (modal)
- FreeCAD: `PropertyItemFactory` maps property types to editor widgets. SelectionObserver rebuilds on change. Multi-select support.
- Blender: RNA definitions auto-generate UI. Type metadata includes min/max/default/flags.
- OpenSCAD: Customizer reads annotations → type→widget mapping with debounce

### Browser Equivalent
```
PropertyEditorRegistry = Map<string, SvelteComponent>  // or any framework

// Register editors for types
registry.set("number", NumberInput)
registry.set("color", ColorPicker)
registry.set("enum", EnumSelect)
registry.set("point2d", Point2DEditor)
registry.set("angle", AngleInput)

// Entity properties defined as schema
EntityPropertySchema = {
  fields: [{
    key: "radius",
    type: "number",
    label: "Radius",
    min: 0,
    precision: 4,
    unit: "drawing_units"
  }, ...]
}
```

### Key Insight
FreeCAD + Blender both auto-generate property UI from typed metadata. Don't hand-build a property panel per entity type. Define property schemas (which ECS components already are) and let the panel component iterate + dispatch to typed editors.

### JS Libraries
- No established CAD property inspector library exists
- Generic options: dat.gui, leva (React), tweakpane — all too simplistic for CAD
- Best approach: build a minimal property panel component that reads ECS component schemas

---

## 4. Panel / Docking / Layout System

### Desktop Pattern
- LibreCAD/FreeCAD/OpenSCAD: Qt QDockWidget (dock to edges, float, tabify, save/restore layout)
- Blender: Custom area system (split/join/swap editor types in rectangular cells)

### Browser Equivalent Options

**Option A: Fixed layout with resizable splitters**
- Central viewport, collapsible left/right/bottom panels
- Resizable via drag handles
- Simplest, proven by all web CAD apps studied
- Libs: `allotment` (React), `@devbookhq/splitter` (React), `svelte-splitpanes`

**Option B: Tiling window manager (Blender-like)**
- Grid of cells, each hosts an editor type
- Split/join/swap operations
- More powerful, much harder to build
- Libs: `react-mosaic` (React only), `golden-layout` (jQuery legacy), `flexlayout-react`

**Option C: Full docking (Qt-like)**
- Panels dock to edges, float, tabify
- Most powerful, hardest to build in browser
- Libs: `rc-dock` (React), `dockview` (framework-agnostic!), `lumino` (JupyterLab's panel system)

**Option D: Web Components panel system**
- Custom elements for panels, framework-agnostic
- Most portable, can work with any framework
- No established library — would need to build or adapt

### Key Insight
**NO web CAD project has implemented proper docking.** This is a real gap. But also: professional CAD users rarely rearrange panels. A fixed layout with collapsible/resizable panels covers 90% of use cases.

### Recommendation Path
Start with Option A (fixed + resizable). Evaluate `dockview` or `lumino` for Option C when adding BIM/GIS domains that need many more panels.

### Notable Libraries to Evaluate
| Library | Framework | Stars | Approach |
|---------|-----------|-------|----------|
| `dockview` | Agnostic (React/Vue/vanilla) | 2k+ | Full docking, tabs, floating |
| `lumino` | Vanilla TS | JupyterLab uses it | Full docking, command palette |
| `allotment` | React | 1.5k+ | Resizable split panes only |
| `svelte-splitpanes` | Svelte | 400+ | Resizable split panes only |
| `golden-layout` | jQuery/vanilla | 6k+ | Classic, but jQuery legacy |

---

## 5. Command Line / Command Palette

### Desktop Pattern
- LibreCAD: `QG_CommandWidget` — input + history, auto-focus on keypress, tab completion, keycode mode
- FreeCAD: Python console — full scripting language as command input
- Blender: No traditional command line, but F3 search/command palette

### Browser Equivalent Options

**Traditional CAD command line (LibreCAD/AutoCAD style):**
- Input field docked at bottom
- Global keypress handler redirects to input
- Tab completion from active tool's available commands + global registry
- History with arrow keys
- Sub-prompt support: tool sets the prompt text ("Specify next point or [Close/Undo]:")

**Command palette (Blender/VS Code style):**
- Modal overlay triggered by shortcut (Ctrl+Shift+P or F3)
- Fuzzy search across all commands
- Shows command metadata (shortcut, description)
- Better for discoverability, worse for AutoCAD-style workflow

**Both:**
- Not mutually exclusive. Have a docked command line for power users + command palette for discovery.
- Zoo Design Studio does this (CommandBar palette + standard input).

### JS Libraries
- cmdk (command palette, React/framework-agnostic core)
- kbar (command palette, React)
- ninja-keys (web component, framework-agnostic)
- For command line: build custom (no good library exists for CAD-style command input)

---

## 6. Selection System

### Desktop Pattern
- FreeCAD: `SelectionSingleton` with preselect/select, sub-element selection, SelectionGate, bidirectional sync
- LibreCAD: simpler — select/deselect on graphic view, no sub-element

### Browser Equivalent
```
SelectionStore = {
  selected: Map<EntityId, SelectionEntry>
  preselected: EntityId | null              // hover highlight
  gate: SelectionGate | null                // filter during tool
  
  add(id, subElement?, point?): void
  remove(id): void
  clear(): void
  setPreselect(id): void
  clearPreselect(): void
  installGate(gate): void
  removeGate(): void
}

SelectionGate = {
  canSelect(entity): boolean
  reason: string                           // "Select a line or arc"
}
```

### Key Insight
Preselection (hover highlight) separate from selection is essential for CAD UX. The selection gate pattern (restricting what can be selected during a tool operation) is brilliant — e.g., during "trim," only allow selecting entities near the cutting edge.

---

## 7. Keyboard Shortcuts

### Desktop Pattern
- Blender: layered keymaps (global → space → region → tool → modal), stored as data, user-customizable
- LibreCAD: keycode mode (short codes invoke actions without Enter)
- FreeCAD: per-workbench shortcut context

### Browser Equivalent
```
KeymapLayer = {
  scope: "global" | "viewport" | "properties" | "commandline" | "tool:line"
  bindings: Map<string, string>  // "L" → "draw_line", "Ctrl+Z" → "undo"
}

// Resolution order (most specific wins):
// 1. Active tool modal keymap
// 2. Active editor/panel keymap  
// 3. Global keymap
```

### JS Libraries
- hotkeys-js (lightweight, no framework)
- tinykeys (tiny, modern)
- mousetrap (classic, jQuery-era)
- Or build layered system on native `addEventListener('keydown', ...)` — scoping is the hard part, not key detection

---

## 8. Notification / Event System

### Desktop Pattern
- Blender: typed notification bus (NC_SCENE, NC_OBJECT, etc.), editors subscribe to categories
- FreeCAD: Qt signals/slots
- LibreCAD: listener interfaces

### Browser Equivalent
```
// Option A: Typed EventEmitter
bus.on("entity:changed", (ids: EntityId[]) => ...)
bus.on("selection:changed", (selection: SelectionState) => ...)
bus.on("layer:changed", (layerId: string) => ...)

// Option B: Svelte stores (reactive)
// Each concern is a store. Components subscribe implicitly via $state/$derived.

// Option C: Chili3D pattern — typed PubSub with event map
type EventMap = {
  "entity:changed": EntityId[]
  "selection:changed": SelectionState
  "command:executed": CommandResult
  ...
}
```

### Key Insight
Svelte's reactivity model ($state, $derived, $effect) handles most of what Blender's notification system does. The question is whether to add an explicit event bus on top for cross-cutting concerns (undo notifications, save triggers, AI agent events) or let Svelte stores suffice.

---

## 9. Workbench / Mode Switching

### Desktop Pattern
- FreeCAD: workbenches swap entire toolbar/menu/panel config declaratively
- Blender: editor types plugged into area cells, each with own operators/keymap

### Browser Equivalent
```
Workbench = {
  id: "cad2d" | "bim" | "gis" | "civil"
  label: string
  toolbars: ToolbarDef[]           // arrays of command IDs per toolbar group
  panels: PanelConfig              // which panels show where
  keymap: KeymapLayer              // workbench-specific shortcuts
  defaultTool: string              // "select"
}

// On switch:
// 1. Update active workbench store
// 2. Svelte reactivity re-renders toolbars from new command ID arrays
// 3. Panel visibility updates
// 4. Keymap layer swaps
```

### Key Insight
Not needed for v0.1 (2D CAD only). But the architecture should support it from day one — just have a single "cad2d" workbench that defines the current toolbar/panel config. Adding BIM/GIS later is just adding new workbench configs.

---

## 10. Status Bar

### Desktop Pattern
- LibreCAD: coordinates (4-format), mouse hints, selection count, active layer, grid info, snap toggles
- FreeCAD: similar + progress bar
- Blender: header per editor with context-aware info

### Browser Equivalent
```
StatusBar sections (left to right):
[Mouse hints: LMB=specify point, RMB=cancel]
[Coordinates: X:125.000 Y:89.500 | dX:10.000 dY:5.000]  
[Snap: Endpoint]
[Selection: 3 entities, L=45.23]
[Active layer: Layer 0]
[Grid: 10.0]
[Ortho: ON] [Snap: ON]
```

### Key Insight
The mouse hint section (what left/right click does NOW) is the most underrated CAD UI feature. It eliminates the "what do I do next?" confusion that plagues all CAD apps. LibreCAD implements this per-action — every tool updates its hints.
