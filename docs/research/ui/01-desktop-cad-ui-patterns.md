# Desktop CAD UI Patterns — Extracted from Reference Repos

## 1. LibreCAD (C++/Qt5 — 2D CAD)

### Architecture Summary
- **Main window:** `QC_ApplicationWindow` singleton owns everything
- **Factory pattern:** 4 factories initialize the UI declaratively:
  - `LC_ActionFactory` — creates all QActions (grouped: line, circle, modify, etc.)
  - `LC_ToolbarFactory` — creates toolbars
  - `LC_MenuFactory` — creates menus + context menus
  - `LC_WidgetFactory` — creates dock widgets + status bar widgets

### Command/Action System
- `RS2::ActionType` enum (~400 entries) = universal command ID
- `QG_ActionHandler` = central dispatcher: `setCurrentAction(ActionType)` → factory creates action instance
- `RS_Commands` singleton maps strings → ActionType (full commands, short keycodes, aliases, tab completion, i18n)
- **Flow:** GUI click → QAction → ActionHandler → factory → RS_ActionInterface subclass → set on graphic view

### Tool State Machine (most important pattern)
- `RS_ActionInterface` base class for all tools
- **Integer status field** (`m_status`) drives state machine. 0 = initial, -1 = finished
- Each tool defines its own Status enum: e.g. `SetStartpoint = 0`, `SetEndpoint = 1`
- Virtual methods dispatch by status: `onMouseLeftButtonRelease(status, ...)`, `onCoordinateEvent(status, ...)`
- **Coordinate event abstraction:** Mouse clicks AND typed coordinates produce the same coordinate event — decouples input method from geometry logic
- `getAvailableCommands()` returns context-sensitive command strings
- Options widget per action — each tool provides its own options panel
- Predecessor pattern — actions stack, predecessor resumes when child finishes

### Layer Panel
- `QTableView` + `QAbstractTableModel` with columns: VISIBLE, LOCKED, PRINT, CONSTRUCTION, COLOR, NAME
- Icon toggles per column (click to toggle)
- Filter/search input
- Both flat and hierarchical (tree) views available

### Command Line
- `QG_CommandWidget` = input field + history output area
- Auto-focus on any keypress (global event filter redirects to command line)
- Tab completion from current action's available commands, fallback to global command registry
- Keycode mode: 2-3 char codes invoke actions without Enter
- Resizable, dockable/floatable

### Coordinate Display
- 4-label grid: Absolute Cartesian, Absolute Polar, Relative Cartesian, Relative Polar
- Updated on every mouse move by snapper
- Respects drawing's format/precision settings

### Mouse Hint Widget (unique and valuable)
- Shows what left-click and right-click will DO in current state
- Updated by each action's `updateMouseButtonHints()`
- Critical for discoverability

### Snap Toolbar
- Toggle buttons per snap mode: Free, Grid, Endpoint, OnEntity, Center, Middle, Distance, Intersection
- Restriction toggles: Horizontal, Vertical, Orthogonal
- Relative zero controls

---

## 2. FreeCAD (C++/Python/Qt5 — 3D Parametric CAD)

### Workbench System (killer feature)
- `Workbench` = declarative UI config object, NOT a widget
- Returns data trees of command IDs: `setupMenuBar()`, `setupToolBars()`, `setupDockWindows()`
- `WorkbenchManager` singleton tracks active workbench
- On activation: workbench returns trees → managers diff current UI and add/remove/show/hide
- `PythonBaseWorkbench` allows Python-defined workbenches
- `WorkbenchManipulator` hook modifies any workbench's UI before materialization
- Sub-modes: toolbars can be ForceAvailable/ForceHidden within a workbench (e.g., Sketcher edit mode)

### Command Framework
- `Command` class: metadata (label, icon, shortcut, tooltip) + `activated()` + `isActive()`
- `CommandManager` = `Map<string, Command>` singleton, referenced by string ID everywhere
- `PythonCommand` wraps Python objects as commands
- `GroupCommand` aggregates children into dropdown groups
- ALL mutations route through Python: `doCommand(Doc, "App.getDocument(...).addObject(...)")`
- Provides macro recording for free — every operation is a Python script line

### Task Panel System
- `TaskDialog` base: holds content widgets + button config + lifecycle hooks
- `ControlSingleton` enforces one dialog at a time per document
- `isAllowedAlterDocument/View/Selection()` — controls what else can happen during dialog
- `TaskWatcher` — passive, selection-driven contextual panels (show/hide based on selection filters)
- `TaskBox` — collapsible accordion sections

### Property Panel
- `PropertyView` = SelectionObserver — rebuilds on selection change
- Two tabs: "Data" properties (App) and "View" properties (display)
- `PropertyItem` type-dispatched editors: float, int, vector, color, enum, placement
- `PropertyItemFactory` registry maps property types to editor widgets
- Multi-select support: shows shared properties, edits all at once

### Selection System
- `SelectionSingleton` global store (Observer pattern)
- Entries: `{DocName, ObjectName, SubElementName, TypeName, x, y, z}`
- Preselection (hover) separate from selection
- `SelectionGate` — filter during tool operation (allows/blocks selection by criteria + reason string)
- Bidirectional: viewport click ↔ tree view highlight

### Sketcher UI (most relevant for 2D)
- `DrawSketchHandler` base for all sketch tools
- Template hierarchy: Controller + Widget + Handler separates viewport interaction, on-view editing, taskbox editing
- `seekAutoConstraint()` — finds potential constraints near cursor
- `renderSuggestConstraintsCursor()` — visual constraint suggestion indicators
- `createAutoConstraints()` — applies on commit
- State machine: SeekFirst → click → SeekSecond → click → execute → repeat

---

## 3. Blender (C — Custom UI)

### Area/Editor System
- Window → Screen → Areas → Regions
- Each Area hosts a SpaceLink (editor type: 3D View, Node Editor, Properties, etc.)
- Areas split/join/swap at runtime
- Each SpaceType registers as a plugin: `operatortypes`, `keymap`, `listener`, `context`, `dropboxes`, `gizmos`
- Each Region has: `init`, `draw`, `listener`, `keymapflag`

### Operator System
- `wmOperatorType` with key callbacks:
  - `exec` — non-interactive (scripts, AI agents call this)
  - `invoke` — starts interactive mode
  - `modal` — handles ongoing events during interaction
  - `cancel` — cleanup
  - `poll` — can this operator run?
- `OPERATOR_PASS_THROUGH` — allows non-conflicting events during modal (e.g., viewport nav during transform)
- Properties defined via RNA → auto-generate redo panel

### RNA Property System (auto-UI generation)
- `RNA_def_*` calls define typed properties with metadata: name, description, min/max, default, flags
- UI auto-generates form controls from definitions
- Redo sidebar auto-built by iterating operator's RNA properties

### Notification System
- Typed notification bus: NC_SCENE, NC_OBJECT, NC_MATERIAL, etc.
- Editors subscribe to categories they care about → redraw only on relevant changes
- Decouples data changes from UI updates

### Keymap System
- Layered: global → space-specific → region-specific → tool-specific
- Key maps stored as data, not code → user customization
- Modal operators can have their own modal keymaps

---

## 4. OpenSCAD (C++/Qt5 — Code-Based CAD)

### Layout
- Central widget = 3D viewport
- 8 dock widgets: Editor, Console, Customizer, Error-Log, Animate, Font List, Color List, Viewport-Control
- Standard Qt docking (dock, float, tab)

### Customizer (Parameter Panel)
- Reads parameter annotations from source code comments
- Type → Widget mapping: bool→Checkbox, number→Slider/SpinBox, enum→ComboBox, string→Text, vector→Vector
- `ParameterGroup` for visual grouping
- 1-second debounce before triggering recomputation
- Preset save/load from JSON

### Console + Error Log (dual output)
- Console: streaming output, MAX_LINES cap (5000), colored, clickable source links
- Error Log: structured table (severity, file, line, message), dedup, filter by category, click → navigate
- Two complementary channels: streaming vs structured

---

## Universal Patterns (present in ALL desktop CAD apps)

| Pattern | LibreCAD | FreeCAD | Blender | OpenSCAD |
|---------|----------|---------|---------|----------|
| Central command registry | ActionType enum | CommandManager | OperatorType | N/A (code-based) |
| String-based dispatch | RS_Commands | string IDs | idname | N/A |
| Tool state machine | RS_ActionInterface | DrawSketchHandler | modal operators | N/A |
| Properties by type dispatch | Per-entity dialogs | PropertyItemFactory | RNA auto-UI | Customizer type map |
| Coordinate event abstraction | fireCoordinateEvent | onCoordinateEvent | — | — |
| Selection observer | — | SelectionSingleton | — | — |
| Context-sensitive help | MouseWidget | TaskWatcher | header hints | — |
| Dockable panels | QDockWidget | DockWindowManager | Area/Region | QDockWidget |
| Command line input | QG_CommandWidget | Python console | — | — |
| Scriptable operation layer | command strings | Python routing | Python operators | OpenSCAD language |
