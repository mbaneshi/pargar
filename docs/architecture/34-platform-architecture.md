# 34 — Platform Architecture: Domain Plugin System

> **Date:** 2026-04-15
> **Status:** Architecture reference — binding for domain expansion (post-v0.1)
> **Companion to:** `33-input-state-machine.md` (input dispatch), `33-exhaustive-standards-analysis.md` (standards), `35-implementation-plan.md` (implementation phases)
> **Implements:** CLAUDE.md Rules 3 (ECS), 4 (Additive Expansion), 6 (AI First-Class)

---

## 1. Problem Statement

NEXUS today is a monolithic 2D CAD application. Every command variant lives in a single Rust `Command` enum (`packages/kernel/src/commands.rs`), every tool in a single `registry.ts` map (`packages/app/src/lib/tools/registry.ts`), every entity type in a single `GeometryType` enum (`packages/kernel/src/entity.rs`). This works at v0.1 scale — 19 geometry types, 50 commands, 37 tools — but breaks at platform scale.

### Why the monolith breaks

**Adding BIM requires kernel recompilation.** An `IfcWall` entity needs `BIMProperties`, `StructuralProperties`, `ThermalProperties` components. Today, adding a geometry type means modifying the `GeometryType` enum in Rust, recompiling WASM, and updating every `match` arm. BIM alone adds ~40 new entity types and ~60 commands. GIS adds another ~30. Civil adds ~25. The `Command` enum grows to 200+ variants, each change touching core kernel code.

**Shortcuts collide across domains.** `W` means "Wipeout" in 2D CAD. In BIM, `W` should mean "Wall." Today, shortcuts are hardcoded in `+page.svelte`. There is no mechanism for context-dependent shortcut binding.

**Renderers can't coexist.** The renderer package is `CadRenderer` — a single Three.js OrthographicCamera setup for 2D line geometry. BIM needs PerspectiveCamera + mesh rendering. GIS needs CesiumJS. Point clouds need Potree. There is no abstraction that allows multiple renderers to compose within the same viewport or switch between views.

**AI agents can't discover domain tools.** MCP tool schemas are defined alongside commands (AD-06), but with a monolithic command enum, an agent querying "what BIM tools are available?" gets the entire 200+ command list. There is no domain scoping for tool discovery.

**File formats are hardcoded.** DXF import/export lives in `packages/file-io`. Adding IFC, STEP, GeoJSON, Shapefile, LAS/LAZ each requires modifying the file-io package directly rather than registering parsers from domain modules.

### What must NOT change

The kernel's core is correct and stays:
- **ECS data model** — entities = IDs, components = data bags, systems = queries (AD-03)
- **Event sourcing** — immutable `CadEvent` + `EventStore` for replay (AD-02)
- **Command pattern** — every operation dispatched as a command (AD-01)
- **Rust/WASM computation** — geometry in Rust, interaction in TypeScript (AD-05)
- **MCP protocol** — AI agents as first-class users (AD-06)

The problem is not the architecture — it's that the architecture is hardcoded to one domain. The fix is a registration layer that lets domains plug into the existing core.

---

## 2. How Blender Addons Work

*Source: the Blender source tree*

Blender's addon system is the most mature browser-applicable reference for extensible creative software.

### Discovery without execution

Blender scans addon directories and extracts metadata using AST parsing — it reads the `bl_info` dictionary from each addon's `__init__.py` without importing the module (`scripts/modules/addon_utils.py`, `_fake_module()`, lines 125-208). This means broken addons don't crash startup.

```python
bl_info = {
    "name": "BioVision Motion Capture (BVH)",
    "author": "Blender Foundation",
    "version": (1, 0, 1),
    "blender": (2, 81, 6),          # minimum version
    "location": "File > Import-Export",
    "category": "Import-Export",
    "support": "OFFICIAL",
}
```

### Clean registration contract

Every addon implements exactly two functions:

```python
def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_import.append(menu_func_import)

def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
    bpy.types.TOPBAR_MT_file_import.remove(menu_func_import)
```

`register()` adds operators, panels, menus to Blender's global registries. `unregister()` removes them cleanly. Both are idempotent. An owner ID (`_bl_owner_id_set(module_name)`) is stamped on every registered type, enabling "which addon owns this operator?" queries.

### Operator structure

Every interactive operation is an `Operator` with a standard interface:

- **`bl_idname`**: Namespaced identifier (`import_anim.bvh`) — prevents collisions
- **`bl_label`**: Human-readable name
- **`bl_options`**: Flags (`REGISTER`, `UNDO`)
- **`execute(context)`**: Non-interactive execution
- **`invoke(context, event)`**: Start interactive mode
- **`modal(context, event)`**: Per-event dispatch during interaction
- **`poll(context)`**: Precondition check (silent fail if false)

This `execute` / `invoke` / `modal` trichotomy maps directly to NEXUS's existing `CommandDef.execute(params)` vs `CommandDef.invoke()` split.

### Workspace and editor composition

Blender separates **workspaces** (screen layouts) from **editor types** (space types). A workspace contains screen areas, each hosting a space type (3D Viewport, Node Editor, Timeline, etc.). Each `SpaceType` registers its own operators, gizmos, and drop handlers (`source/blender/editors/space_api/spacetypes.cc`, lines 63-150). Tools are per-mode within a workspace — a `bToolRef` binds `(space_type, mode)` → `tool_idname`.

### Message bus

Change notification uses a typed message bus (`source/blender/windowmanager/message_bus/wm_message_bus.hh`):
- Three message types: RNA property changes, static UI events, remote I/O
- Subscribers register with owner pointer + callback
- `WM_msgbus_handle()` processes pending messages each frame
- Persistent subscriptions survive file loads

### Key takeaways for NEXUS

| Blender pattern | NEXUS application |
|-----------------|-------------------|
| `bl_info` metadata without import | `DomainManifest` parsed without loading domain code |
| `register()` / `unregister()` contract | Domain `activate()` / `deactivate()` lifecycle |
| Owner ID tracking | Domain ID stamped on every registered command/component |
| `bl_idname` namespacing | `domain:command_name` namespacing (e.g. `cad2d:draw_line`) |
| `execute` / `invoke` / `modal` | `execute(params)` / `invoke()` → ToolHandler |
| `poll()` preconditions | Command `isActive()` predicate |
| Space types + workspace layouts | Renderer slots + workbench configuration |
| Message bus | EventStore observers + cross-domain hooks |

---

## 3. How FreeCAD Workbenches Work

*Source: the FreeCAD source tree*

FreeCAD's workbench system is the most direct reference for domain switching in a CAD platform.

### Workbench as UI configuration

A workbench is not a plugin runtime — it's a UI configuration. The base class (`src/Gui/Workbench.h`, lines 117-123) requires four virtual methods:

```cpp
virtual MenuItem* setupMenuBar() const = 0;
virtual ToolBarItem* setupToolBars() const = 0;
virtual ToolBarItem* setupCommandBars() const = 0;
virtual DockWindowItems* setupDockWindows() const = 0;
```

Each returns a tree structure describing menus, toolbars, and dock panels. The framework's managers (`MenuManager`, `ToolBarManager`, `DockWindowManager`) build actual Qt widgets from these trees. Workbenches also implement lifecycle hooks:

```cpp
virtual void activated();    // called on switch-in
virtual void deactivated();  // called on switch-out
```

### Workbench manager and switching

`WorkbenchManager` (`src/Gui/WorkbenchManager.h`) is a singleton that caches workbench instances and coordinates switching:

1. User selects workbench → `WorkbenchManager::activate(name, className)`
2. Manager creates workbench instance via `Base::Type::createInstance()` if not cached
3. `workbench->activate()` runs the UI reconfiguration sequence:
   - Build toolbar trees via `setupToolBars()` → apply `WorkbenchManipulator` for user customizations
   - Build menu trees via `setupMenuBar()` → inject permanent items (File, Edit, Help)
   - Build dock window config via `setupDockWindows()`
   - Delegate to managers for widget creation
4. Previous workbench's transient UI is destroyed

**Key insight:** Standard workbenches (`StdWorkbench`) provide permanent UI (File, Edit, View, Help menus). Domain workbenches extend `StdWorkbench` and add only domain-specific UI. This is the "permanent vs transient" split.

### Module structure

FreeCAD has 34 modules under `src/Mod/`, each following a standard layout:

```
ModuleName/
├── Init.py          # App-level init (no GUI) — registers file formats, tests
├── InitGui.py       # GUI init — registers workbench class
├── App/             # Core logic (document objects, features) — no GUI deps
├── Gui/             # UI layer
│   ├── Workbench.h/cpp    # Workbench configuration
│   ├── Command*.cpp       # Command implementations
│   ├── ViewProvider*.cpp  # 3D view representation
│   └── Resources/icons/
└── Resources/
```

The split between `Init.py` (app logic, file formats) and `InitGui.py` (workbench, UI) enforces that core functionality works headlessly. This matters for NEXUS because AI agents operate without GUI.

### Lazy loading

Modules are not loaded at startup. `InitGui.py` registers a lightweight Python workbench adapter:

```python
class SketcherWorkbench(Workbench):
    def __init__(self):
        self.__class__.Icon = "Mod/Sketcher/Resources/icons/SketcherWorkbench.svg"
        self.__class__.MenuText = "Sketcher"

    def Initialize(self):
        import SketcherGui  # C++ module loaded on first activation
        import Sketcher

    def GetClassName(self):
        return "SketcherGui::Workbench"  # links to C++ class

Gui.addWorkbench(SketcherWorkbench())
```

The expensive C++ module import only happens when the user first activates that workbench. This keeps startup fast regardless of how many domains are installed.

### Command registration

Commands are registered with a global `CommandManager` singleton (`src/Gui/Command.h`, lines 964-1000):

```cpp
void CreateSketcherCommands() {
    Gui::CommandManager& rcCmdMgr = Gui::Application::Instance->commandManager();
    rcCmdMgr.addCommand(new CmdSketcherNewSketch());
    rcCmdMgr.addCommand(new CmdSketcherEditSketch());
    // ...
}
```

This happens inside the C++ module's `PyMOD_INIT_FUNC` — commands become available when the module loads. Commands have a `sAppModule` attribute linking them to their module, enabling queries like "all commands from Sketcher."

### File format registration

Import/export handlers are registered globally:

```python
# Init.py (BIM module)
FreeCAD.addImportType("Industry Foundation Classes (*.ifc)", "nativeifc.ifc_import")
FreeCAD.addExportType("Industry Foundation Classes (*.ifc)", "importers.exportIFC")
```

Multiple modules can handle the same format, with priority switching via `changeImportModule()`.

### Key takeaways for NEXUS

| FreeCAD pattern | NEXUS application |
|-----------------|-------------------|
| Workbench = UI configuration, not runtime | Workbench configures toolbar, shortcuts, panels — core stays |
| `StdWorkbench` + domain extension | Base shell + domain overlay |
| `Init.py` / `InitGui.py` split | Headless domain registration + GUI domain registration |
| Lazy module loading | Lazy WASM module loading per domain |
| `CommandManager` singleton | `CommandRegistry` already exists — extend with domain scoping |
| `setupToolBars()` returns tree | Domain manifest declares toolbar groups |
| `setupMenuBar()` with permanent items | Shell provides permanent menus, domain adds transient items |
| `addImportType()` / `addExportType()` | `FileFormatRegistry.register()` per domain |

---

## 4. How Django, VS Code, and Linux Solve Domain Registration

These three systems solve the same fundamental problem — letting independent modules register capabilities into a shared core — in ways applicable to NEXUS.

### Django: Declarative app registration

Django's `INSTALLED_APPS` is a list of module paths. Each app provides an `AppConfig` class with metadata:

```python
class BimConfig(AppConfig):
    name = 'bim'
    verbose_name = 'BIM'
    default_auto_field = 'django.db.models.BigAutoField'
    
    def ready(self):
        import bim.signals  # register event handlers
```

On startup, Django iterates `INSTALLED_APPS`, imports each, calls `ready()`, and auto-discovers `models.py`, `admin.py`, `urls.py` by convention. The key insight: **convention-based discovery** — put a file in the right place, and the framework finds it.

**NEXUS application:** Domain manifests follow a fixed interface. The platform discovers and loads them from a known location.

### VS Code: Contribution points

VS Code extensions declare capabilities in `package.json` under `contributes`:

```json
{
  "contributes": {
    "commands": [{ "command": "bim.createWall", "title": "Create Wall" }],
    "menus": { "editor/context": [{ "command": "bim.createWall" }] },
    "keybindings": [{ "command": "bim.createWall", "key": "w" }],
    "configuration": { "properties": { "bim.defaultLOD": { "type": "number" } } }
  },
  "activationEvents": ["onCommand:bim.createWall"]
}
```

**Key insights:**
- **Declarative contribution points** — extensions don't touch core UI code, they declare what they contribute
- **Activation events** — extensions load lazily, only when a relevant event fires
- **Scoped configuration** — each extension manages its own settings namespace

**NEXUS application:** The `DomainManifest` is NEXUS's equivalent of VS Code's `package.json contributes`. Domains declare commands, tools, shortcuts, panels — the platform wires them in.

### Linux kernel modules: Symbol registration

Kernel modules use `module_init()` / `module_exit()` macros and register symbols (functions, data structures) into kernel-maintained registries:

```c
static int __init mymod_init(void) {
    register_filesystem(&my_fs_type);
    register_chrdev(major, "mydev", &fops);
    return 0;
}
module_init(mymod_init);
```

**Key insight:** The kernel provides **stable registration APIs** (`register_filesystem`, `register_chrdev`, `register_netdev`). Modules don't modify kernel code — they call registration functions. The kernel iterates its registries when dispatching operations.

**NEXUS application:** The platform provides registration APIs: `registerDomain()`, `registerCommand()`, `registerFileFormat()`, `registerRenderer()`. Domains call these APIs. The platform iterates registries when dispatching.

### Synthesis: The universal pattern

Every successful plugin system follows the same three-phase pattern:

1. **Declare** — Module provides metadata (Django's `AppConfig`, Blender's `bl_info`, VS Code's `contributes`, FreeCAD's `InitGui.py`)
2. **Register** — Framework calls module's registration hook (`ready()`, `register()`, `Initialize()`, `module_init()`)
3. **Dispatch** — Framework routes operations through its registries, never through hardcoded module references

NEXUS must follow this same pattern.

---

## 5. The NEXUS 3-Layer Design: Kernel / Platform / Domains

### Architecture overview

```
┌────────────────────────────────────────────────────┐
│                    DOMAINS                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │  cad2d   │ │  cad3d   │ │   bim    │ │  gis  │ │
│  │ commands │ │ commands │ │ commands │ │ cmds  │ │
│  │  tools   │ │  tools   │ │  tools   │ │ tools │ │
│  │ renderer │ │ renderer │ │ renderer │ │render │ │
│  │ formats  │ │ formats  │ │ formats  │ │formats│ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘ │
│       │             │             │           │     │
├───────┴─────────────┴─────────────┴───────────┴─────┤
│                   PLATFORM                           │
│  ┌──────────────────────────────────────────────┐   │
│  │  DomainRegistry  CommandRegistry  ToolRegistry│   │
│  │  FileFormatRegistry  RendererSlots  HookBus  │   │
│  │  WorkbenchManager  ShortcutManager  MCP Hub  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                    KERNEL                            │
│  ┌──────────────────────────────────────────────┐   │
│  │  ECS World  EventStore  SpatialIndex         │   │
│  │  GeometryOps  ConstraintSolver               │   │
│  │  Undo/Redo  Layers  Blocks                   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Layer responsibilities

**Kernel** (Rust/WASM — exists today, mostly unchanged):
- Owns the ECS world: entity IDs, component storage, system queries
- Owns the event store: immutable event log, undo/redo via cursor
- Provides geometry operations: intersection, offset, trim, boolean
- Provides spatial queries: R-tree lookups
- Exposes a JSON API via `wasm-bindgen`: `execute_command(json) → json`
- **Does NOT know about domains.** The kernel accepts generic component data, not domain-specific types.

**Platform** (TypeScript — new layer, extracted from current monolith):
- **DomainRegistry**: Discovers, loads, activates domains
- **CommandRegistry**: Already exists (`packages/app/src/lib/commands/CommandRegistry.ts`) — extended with domain scoping and namespacing
- **WorkbenchManager**: Switches UI configuration when user changes domain
- **ShortcutManager**: Maps keys to commands per active workbench
- **FileFormatRegistry**: Maps file extensions to parser/writer modules
- **RendererSlots**: Manages which renderer(s) are active in viewport areas
- **HookBus**: Cross-domain event observation (e.g., BIM agent watches wall creation)
- **MCP Hub**: Aggregates tool schemas from all loaded domains for AI discovery

**Domains** (TypeScript + optional Rust/WASM per domain):
- Each domain is a self-contained module that registers its capabilities with the platform
- A domain provides: components, commands, tools, panels, shortcuts, file formats, renderer extensions
- Domains do not import each other directly — they interact through the ECS world and event store

### What changes vs what stays

| Component | Today | After |
|-----------|-------|-------|
| `packages/kernel` | Monolithic Command enum | Generic command dispatch — domains register handlers |
| `packages/app` | All tools hardcoded | Shell + platform registries — tools loaded from domains |
| `packages/renderer` | Single CadRenderer | Renderer slot system — domains contribute renderer extensions |
| `packages/file-io` | DXF only, hardcoded | FileFormatRegistry — domains register parsers |
| `packages/core` | Shared types | Unchanged — event types, entity IDs |
| New: `packages/platform` | — | DomainRegistry, WorkbenchManager, HookBus, MCP Hub |
| New: `domains/cad2d` | — | Everything from current packages, repackaged as a domain |

---

## 6. DomainManifest Interface

### TypeScript interface

```typescript
interface DomainManifest {
  /** Unique domain identifier. Used as namespace prefix. */
  id: string;

  /** Human-readable name shown in workbench switcher. */
  name: string;

  /** Semantic version of this domain module. */
  version: string;

  /** Domain IDs this domain requires to be loaded first. */
  dependencies: string[];

  /** Icon path or SVG string for workbench switcher. */
  icon: string;

  /** 
   * Component types this domain adds to the ECS world.
   * Each key is a component name, value is a JSON Schema
   * describing the component's data shape.
   */
  components: Record<string, ComponentSchema>;

  /**
   * Commands this domain provides. Keys are command IDs
   * (will be prefixed with `domain.id:`).
   */
  commands: CommandDef[];

  /**
   * Interactive tools (commands with invoke/modal flow).
   * Subset of commands that have a ToolHandler.
   */
  tools: ToolGroupDef[];

  /** Keyboard shortcuts active when this workbench is selected. */
  shortcuts: ShortcutBinding[];

  /** Panels contributed to the sidebar/properties area. */
  panels: PanelDef[];

  /** File format parsers and writers this domain supports. */
  fileFormats: FileFormatDef[];

  /** Renderer extension or standalone renderer for this domain. */
  renderer?: RendererDef;

  /** Snap modes this domain adds. */
  snapModes?: SnapModeDef[];

  /** Context menu items when entities of this domain are selected. */
  contextMenuItems?: ContextMenuDef[];

  /** Settings schema for domain-specific configuration. */
  settings?: SettingsSchema;
}

interface ComponentSchema {
  /** JSON Schema for the component data. */
  schema: object;
  /** Whether this component should be indexed for spatial queries. */
  spatiallyIndexed?: boolean;
}

interface ToolGroupDef {
  /** Group label shown in toolbar. */
  label: string;
  /** Tool IDs in this group (references commands). */
  tools: string[];
}

interface ShortcutBinding {
  /** Key or key combo (e.g., "l", "ctrl+shift+w"). */
  key: string;
  /** Command ID to invoke. */
  command: string;
  /** Only active when these conditions are met. */
  when?: string;
}

interface FileFormatDef {
  /** Format identifier (e.g., "dxf", "ifc", "geojson"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** File extensions including dot (e.g., [".dxf", ".dxb"]). */
  extensions: string[];
  /** Dynamic import path for the parser module. */
  parser?: string;
  /** Dynamic import path for the writer module. */
  writer?: string;
}

interface RendererDef {
  /** Renderer type: extends existing, or standalone. */
  type: 'extension' | 'standalone';
  /** For extensions: which base renderer to extend (e.g., "threejs-2d"). */
  extends?: string;
  /** Dynamic import path for the renderer module. */
  module: string;
}

interface PanelDef {
  /** Panel identifier. */
  id: string;
  /** Display name. */
  label: string;
  /** Where the panel appears: 'sidebar' | 'properties' | 'bottom'. */
  location: string;
  /** Dynamic import path for the Svelte component. */
  component: string;
}
```

### Concrete example: cad2d domain

```typescript
const cad2dManifest: DomainManifest = {
  id: 'cad2d',
  name: '2D CAD',
  version: '0.1.0',
  dependencies: [],
  icon: '/icons/cad2d.svg',

  components: {
    'Geometry2D': {
      schema: { /* Point, Line, Circle, Arc, Polyline, ... */ },
      spatiallyIndexed: true,
    },
    'DimensionAnnotation': {
      schema: { /* Linear, Aligned, Angular, Radial */ },
      spatiallyIndexed: false,
    },
  },

  commands: [
    { id: 'draw_line', label: 'Line', icon: 'line', category: 'draw',
      schema: { startPoint: 'Vec2', endPoint: 'Vec2' },
      execute: (params) => kernel.execute({ CreateLine: params }),
      invoke: () => new LineToolHandler(),
    },
    { id: 'draw_circle', label: 'Circle', icon: 'circle', category: 'draw',
      schema: { center: 'Vec2', radius: 'number' },
      execute: (params) => kernel.execute({ CreateCircle: params }),
      invoke: () => new CircleToolHandler(),
    },
    // ... 50+ commands
  ],

  tools: [
    { label: 'Draw', tools: ['draw_line', 'draw_circle', 'draw_arc', 'draw_polyline',
                              'draw_rectangle', 'draw_ellipse', 'draw_spline', 'draw_point'] },
    { label: 'Modify', tools: ['move', 'copy', 'rotate', 'scale', 'mirror',
                                'offset', 'trim', 'extend', 'fillet', 'chamfer'] },
    { label: 'Annotate', tools: ['dim_linear', 'dim_aligned', 'dim_angular',
                                  'dim_radial', 'text', 'mtext'] },
  ],

  shortcuts: [
    { key: 'l', command: 'draw_line' },
    { key: 'c', command: 'draw_circle' },
    { key: 'a', command: 'draw_arc' },
    { key: 'r', command: 'draw_rectangle' },
    { key: 'p', command: 'draw_polyline' },
    { key: 'm', command: 'move' },
    { key: 'o', command: 'offset' },
    { key: 't', command: 'trim' },
  ],

  panels: [
    { id: 'layers', label: 'Layers', location: 'sidebar', component: './panels/LayerManager.svelte' },
    { id: 'properties', label: 'Properties', location: 'properties', component: './panels/PropertiesPanel.svelte' },
    { id: 'blocks', label: 'Blocks', location: 'sidebar', component: './panels/BlockBrowser.svelte' },
  ],

  fileFormats: [
    { id: 'dxf', name: 'AutoCAD DXF', extensions: ['.dxf'],
      parser: './formats/dxf-import.ts', writer: './formats/dxf-export.ts' },
    { id: 'nexus-json', name: 'NEXUS JSON', extensions: ['.nexus'],
      parser: './formats/nexus-import.ts', writer: './formats/nexus-export.ts' },
  ],

  renderer: {
    type: 'standalone',
    module: './renderer/Cad2DRenderer.ts',
  },

  snapModes: [
    { id: 'endpoint', label: 'Endpoint', icon: 'snap-endpoint' },
    { id: 'midpoint', label: 'Midpoint', icon: 'snap-midpoint' },
    { id: 'center', label: 'Center', icon: 'snap-center' },
    { id: 'intersection', label: 'Intersection', icon: 'snap-intersection' },
    { id: 'perpendicular', label: 'Perpendicular', icon: 'snap-perpendicular' },
    { id: 'nearest', label: 'Nearest', icon: 'snap-nearest' },
    { id: 'grid', label: 'Grid', icon: 'snap-grid' },
  ],

  settings: {
    'defaultUnits': { type: 'string', default: 'mm', enum: ['mm', 'cm', 'm', 'in', 'ft'] },
    'gridSpacing': { type: 'number', default: 10 },
    'snapEnabled': { type: 'boolean', default: true },
    'orthoMode': { type: 'boolean', default: false },
  },
};
```

---

## 7. Workbench Switching Flow

When the user switches from "2D CAD" to "BIM," this is the step-by-step sequence:

### Step 1: User triggers switch

User clicks workbench selector or types `:workbench bim` in command line.

### Step 2: Platform validates

```
WorkbenchManager.switchTo('bim')
  → DomainRegistry.get('bim') → manifest
  → Check dependencies: manifest.dependencies.every(dep => DomainRegistry.isLoaded(dep))
  → If dependency missing: load it first (e.g., BIM depends on cad3d)
```

### Step 3: Deactivate current workbench

```
1. InteractionShell.cancelActiveTool()        — abort any in-progress tool
2. ShortcutManager.unbindAll('cad2d')          — remove cad2d shortcuts
3. ToolbarManager.clear()                      — remove cad2d toolbar groups
4. PanelManager.removeTransient()              — remove cad2d panels
5. ContextMenuManager.clear('cad2d')           — remove cad2d context menu items
6. HookBus.emit('workbench:deactivating', { from: 'cad2d', to: 'bim' })
```

### Step 4: Load domain if first activation

```
If not DomainRegistry.isLoaded('bim'):
  1. Dynamically import domain module: await import('domains/bim')
  2. If domain has Rust/WASM: await loadWasmModule('bim-kernel.wasm')
  3. Call domain.register(platform) — domain registers components, commands, formats
  4. DomainRegistry.markLoaded('bim')
```

### Step 5: Activate new workbench

```
1. ShortcutManager.bindAll(bimManifest.shortcuts)     — activate BIM shortcuts
2. ToolbarManager.build(bimManifest.tools)             — build BIM toolbars
3. PanelManager.addTransient(bimManifest.panels)       — add BIM panels
4. ContextMenuManager.add('bim', bimManifest.contextMenuItems)
5. RendererSlots.configure(bimManifest.renderer)       — switch to 3D renderer
6. SnapEngine.configure(bimManifest.snapModes)         — set BIM snap modes
7. InteractionShell.setDefaultTool('bim:select')       — set default tool
8. HookBus.emit('workbench:activated', { workbench: 'bim' })
```

### Step 6: UI reflects new state

The Svelte reactive bindings update automatically:
- Toolbar component reads from `ToolbarManager.groups` (reactive `$state`)
- Panel container reads from `PanelManager.activePanels`
- Status bar shows active workbench name
- Shortcut overlay updates if visible

### What does NOT change during a switch

- **ECS world** — all entities remain. BIM entities and CAD entities coexist.
- **Event store** — event log is continuous. No reset.
- **Selection** — selected entities stay selected (if they exist in the new workbench's context).
- **Viewport position** — camera position, zoom level preserved.
- **Undo history** — undo/redo stack spans workbenches.
- **Layers** — layer structure is global, not per-domain.
- **Permanent UI** — file menu, edit menu, view menu, command line, status bar.

---

## 8. Agent Registration and MCP Tool Discovery

### Agent types

NEXUS supports three agent types (per `docs/infrastructure/05-AUTH-IDENTITY.md`):

1. **Human** — interactive user with full GUI
2. **AI Agent** — autonomous software agent with MCP tool access
3. **System** — internal processes (auto-save, constraint solver, event replay)

### MCP tool registration

Every command registered with the `CommandRegistry` automatically becomes an MCP tool. The MCP Hub aggregates tools from all loaded domains:

```
MCP Hub
  → DomainRegistry.getLoadedDomains()
  → For each domain:
    → domain.manifest.commands
    → For each command:
      → { name: `${domain.id}:${command.id}`,
          description: command.label,
          inputSchema: command.schema,
          domain: domain.id }
```

### Tool discovery protocol

When an AI agent connects via MCP, it can:

1. **List all tools**: `tools/list` → returns all registered tools across all loaded domains
2. **List domain tools**: `tools/list?domain=bim` → returns only BIM tools
3. **List tool categories**: `tools/list?category=draw` → returns draw tools across domains
4. **Get tool schema**: `tools/get?name=bim:create_wall` → returns full JSON Schema

### Agent permission model

Agents declare their domain scope on connection:

```json
{
  "agent": "structural-analysis",
  "domains": ["bim"],
  "permissions": {
    "bim": ["read", "create", "modify"],
    "cad2d": ["read"]
  }
}
```

The platform enforces these permissions before command execution. A structural agent can read 2D CAD geometry (to understand the floor plan) but can only create/modify BIM entities.

### Cross-domain agent operations

An agent working across domains (e.g., "place this GIS parcel boundary as a CAD site plan") uses the standard command protocol:

```
1. Agent calls gis:query_parcels(bbox) → returns GIS feature geometries
2. Agent calls cad2d:draw_polyline(points) → creates CAD entity from GIS geometry
3. Both operations are events in the same event store
4. Both are undoable as a single transaction (if wrapped in a command group)
```

### Agent observation

Agents can subscribe to events via the HookBus:

```typescript
hookBus.on('entity:created', { domain: 'bim', component: 'BIMProperties' }, (event) => {
  // Structural agent: validate fire rating on every new BIM element
  const entity = world.get(event.entityId);
  if (!entity.components.BIMProperties.fireRating) {
    hookBus.emit('agent:warning', {
      agent: 'structural-analysis',
      entity: event.entityId,
      message: 'Missing fire rating',
    });
  }
});
```

---

## 9. Renderer Composition

### The problem

Different domains need fundamentally different rendering:

| Domain | Camera | Geometry type | Library |
|--------|--------|---------------|---------|
| 2D CAD | Orthographic | Lines, arcs, curves | Three.js |
| 3D CAD | Perspective | Meshes, B-Rep | Three.js |
| BIM | Perspective | IFC meshes | Three.js + web-ifc |
| GIS | Globe / projected | Tiles, features | CesiumJS |
| Point Cloud | Perspective | Point buffers | Potree |

### Renderer slot model

The viewport area contains **renderer slots**. A slot is a region (usually the full viewport, but can be split) that hosts one renderer instance:

```
┌────────────────────────────────────────┐
│              Viewport Area             │
│  ┌──────────────────────────────────┐  │
│  │         Renderer Slot 0          │  │
│  │    (primary: cad2d renderer)     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

Split viewport (e.g., GIS + CAD overlay):

┌────────────────────────────────────────┐
│  ┌─────────────────┐ ┌──────────────┐  │
│  │   Slot 0        │ │   Slot 1     │  │
│  │ (cesium globe)  │ │ (3D BIM)     │  │
│  └─────────────────┘ └──────────────┘  │
└────────────────────────────────────────┘
```

### Renderer interface

Every renderer implements:

```typescript
interface DomainRenderer {
  /** Unique renderer ID. */
  id: string;

  /** Initialize renderer in the given DOM container. */
  mount(container: HTMLElement): void;

  /** Tear down and release GPU resources. */
  unmount(): void;

  /** Full sync: render all entities matching this renderer's component query. */
  sync(world: ECSWorld): void;

  /** Incremental update: apply a set of entity changes. */
  applyDelta(delta: EntityDelta[]): void;

  /** Convert screen coordinates to world coordinates. */
  screenToWorld(x: number, y: number): Vec2 | Vec3;

  /** Convert world coordinates to screen coordinates. */
  worldToScreen(point: Vec2 | Vec3): { x: number; y: number };

  /** Hit test: find entity at screen position. */
  pick(x: number, y: number): EntityId | null;

  /** Get current camera state for serialization. */
  getCameraState(): CameraState;

  /** Restore camera state. */
  setCameraState(state: CameraState): void;

  /** Handle viewport resize. */
  resize(width: number, height: number): void;
}
```

### Renderer composition patterns

**Pattern 1: Single renderer (default).** One domain renderer fills the viewport. 2D CAD uses this.

**Pattern 2: Renderer extension.** A domain extends an existing renderer rather than replacing it. BIM extends the 3D CAD renderer by adding IFC mesh visualization to the same Three.js scene.

```typescript
// BIM renderer extends 3D CAD renderer
const bimRenderer: RendererDef = {
  type: 'extension',
  extends: 'threejs-3d',
  module: './renderer/BimRendererExtension.ts',
};
```

**Pattern 3: Renderer overlay.** Two renderers composited in the same viewport. GIS (CesiumJS) renders the globe, CAD (Three.js) renders overlay geometry with synchronized cameras.

**Pattern 4: Split viewport.** Multiple renderer slots side by side. Each slot is independent.

### Current renderer migration

The existing `CadRenderer` in `packages/renderer/src/CadRenderer.ts` becomes the `cad2d` domain's renderer. It already implements the essential interface (mount, sync, pick, camera control). The migration wraps it to implement `DomainRenderer` and registers it through the domain manifest.

---

## 10. File Format Registry

### Registry design

```typescript
interface FileFormatRegistry {
  /** Register a format handler from a domain. */
  register(domainId: string, format: FileFormatDef): void;

  /** Get all registered formats. */
  getAll(): RegisteredFormat[];

  /** Get formats that can import a given file extension. */
  getImporters(extension: string): RegisteredFormat[];

  /** Get formats that can export to a given file extension. */
  getExporters(extension: string): RegisteredFormat[];

  /** Import a file using the appropriate parser. */
  import(file: File): Promise<ImportResult>;

  /** Export entities to a file format. */
  export(format: string, entities: EntityId[]): Promise<Blob>;
}

interface RegisteredFormat extends FileFormatDef {
  /** Domain that registered this format. */
  domainId: string;
  /** Priority (higher = preferred when multiple domains handle same extension). */
  priority: number;
}
```

### How import works

```
1. User drops file.ifc onto viewport
2. FileFormatRegistry.getImporters('.ifc')
   → [{ domainId: 'bim', id: 'ifc', parser: './formats/ifc-import.ts' }]
3. If domain 'bim' not loaded: load it first (lazy loading)
4. Dynamically import parser module
5. Parser reads file → produces CreateEntity commands with domain-specific components
6. Commands dispatched through kernel → entities appear in ECS world → renderer picks them up
```

### Multi-domain format handling

Some formats span domains:
- **DXF** can contain 2D CAD geometry AND 3D objects
- **GeoJSON** is GIS, but its geometry could be imported as CAD polylines

The registry supports priority-based resolution: when multiple domains register the same extension, the active workbench's domain gets priority. The user can override via "Open With..." which lists all registered handlers.

### Current file-io migration

`packages/file-io/src/dxf-import.ts` and `dxf-export.ts` move into the `cad2d` domain as registered file formats. The `persistence.ts` (OPFS auto-save) stays in the platform layer since it handles the entire project, not domain-specific files.

---

## 11. Event/Hook System for Cross-Domain Reactions

### Why hooks matter

Domains must react to each other without importing each other:
- BIM compliance agent watches for wall creation → validates fire rating
- GIS module watches for entity movement → updates CRS coordinates
- Civil module watches for alignment changes → recomputes cross-sections
- Undo system watches for all mutations → records for replay

### HookBus design

```typescript
interface HookBus {
  /** Subscribe to events. Returns unsubscribe function. */
  on(event: string, filter: HookFilter, callback: HookCallback): () => void;

  /** Emit an event. Synchronous — all subscribers called before returning. */
  emit(event: string, payload: any): void;

  /** Subscribe to events from a specific domain. */
  onDomain(domainId: string, event: string, callback: HookCallback): () => void;
}

interface HookFilter {
  /** Only match events from this domain. */
  domain?: string;
  /** Only match events involving entities with this component. */
  component?: string;
  /** Only match events of this command type. */
  command?: string;
}
```

### Built-in hook points

These events are emitted by the platform for every domain:

| Event | Payload | When |
|-------|---------|------|
| `command:before` | `{ command, params, domain }` | Before command execution |
| `command:after` | `{ command, params, result, domain }` | After command execution |
| `entity:created` | `{ entityId, components, domain }` | After entity creation |
| `entity:modified` | `{ entityId, changes, domain }` | After entity modification |
| `entity:deleted` | `{ entityId, domain }` | After entity deletion |
| `selection:changed` | `{ selected, deselected }` | After selection changes |
| `workbench:activated` | `{ workbench, previous }` | After workbench switch |
| `file:imported` | `{ format, entityCount }` | After file import |
| `file:exported` | `{ format, entityCount }` | After file export |

### Cross-domain example

BIM compliance agent subscribing to wall creation:

```
HookBus.on('entity:created', { domain: 'bim', component: 'BIMProperties' }, (event) => {
  const props = world.getComponent(event.entityId, 'BIMProperties');
  if (props.type === 'IfcWall' && !props.fireRating) {
    // Emit a warning — doesn't block the operation
    HookBus.emit('agent:warning', {
      severity: 'warning',
      entity: event.entityId,
      message: 'Wall created without fire rating. Required by IBC 2021 §706.',
    });
  }
});
```

### Relationship to EventStore

The HookBus is **not** the EventStore. They serve different purposes:

- **EventStore** (Rust/WASM): Immutable append-only log of `CadEvent` for undo/redo, replay, audit. Every state mutation produces an event. This is the source of truth.
- **HookBus** (TypeScript): Ephemeral notification system for cross-domain reactions. Subscribers react in real-time. Not persisted. Not replayed.

The platform bridges them: after every `CadEvent` is appended to the EventStore, the platform emits the corresponding HookBus event. This keeps the kernel pure (no TypeScript callbacks in Rust) while enabling cross-domain reactions.

---

## 12. Current Code Mapping

Every existing file mapped to its fate in the platform architecture.

### packages/kernel/ — STAYS (mostly unchanged)

| File | Status | Notes |
|------|--------|-------|
| `src/lib.rs` | **STAYS** | Kernel struct, API. Command dispatch modified to accept domain-prefixed commands. |
| `src/entity.rs` | **EVOLVES** | `GeometryType` enum becomes extensible — domains register new variants via component system. Existing variants stay as `cad2d` components. |
| `src/commands.rs` | **EVOLVES** | Monolithic `Command` enum splits. Core commands (undo, redo, layer ops) stay. Domain commands registered dynamically. |
| `src/events.rs` | **STAYS** | `CadEvent` + `EventStore` unchanged. New event types added additively. |
| `src/dispatch.rs` | **EVOLVES** | Dispatch table becomes registry-based instead of `match` on enum. |
| `src/geometry_ops.rs` | **STAYS** | Geometry math doesn't change. |
| `src/spatial_index.rs` | **STAYS** | R-tree queries unchanged. |
| `src/constraints.rs` | **STAYS** | Constraint solver unchanged. |
| `src/snaps.rs` | **STAYS** | Snap detection unchanged. Domains add snap modes additively. |
| `src/layers.rs` | **STAYS** | Layer management is global, not per-domain. |
| `src/blocks.rs` | **STAYS** | Block system unchanged. |
| `src/undo.rs` | **STAYS** | Undo via event replay unchanged. |
| `src/tolerance.rs` | **STAYS** | Constants unchanged. |
| `src/solver_ezpz.rs` | **STAYS** | Constraint solver implementation unchanged. |
| `src/ports.rs` | **STAYS** | Trait abstraction unchanged. |

### packages/app/ — SPLITS into platform + cad2d domain

| File | Status | Destination |
|------|--------|-------------|
| `src/routes/+page.svelte` | **WRAPS** | Becomes thin shell. Input dispatch → `InteractionShell` (platform). Tool shortcuts → `ShortcutManager` (platform). |
| `src/lib/stores/AppState.svelte.ts` | **SPLITS** | Kernel ref + viewport state → platform. Tool state → per-domain. |
| `src/lib/stores/ToolMachine.svelte.ts` | **MOVES** | → platform (part of `InteractionShell`) — tool dispatch is domain-agnostic |
| `src/lib/stores/SelectionState.svelte.ts` | **MOVES** | → platform — selection is global |
| `src/lib/commands/CommandRegistry.ts` | **MOVES** | → platform — extended with domain namespacing |
| `src/lib/commands/registerBuiltinCommands.ts` | **SPLITS** | Core commands (undo, redo, zoom) → platform. Drawing commands → cad2d domain. |
| `src/lib/tools/BaseTool.ts` | **MOVES** | → platform — base class is domain-agnostic |
| `src/lib/tools/ToolHandler.ts` | **MOVES** | → platform — handler interface is domain-agnostic |
| `src/lib/tools/registry.ts` | **SPLITS** | Registry mechanism → platform. 37 tool classes → cad2d domain. |
| `src/lib/tools/LineTool.ts` (and all 36 others) | **MOVES** | → `domains/cad2d/tools/` |
| `src/lib/components/Toolbar.svelte` | **STAYS** | Shell component, reads from `ToolbarManager` |
| `src/lib/components/CommandLine.svelte` | **STAYS** | Shell component, dispatches to `InteractionShell` |
| `src/lib/components/StatusBar.svelte` | **STAYS** | Shell component |
| `src/lib/components/LayerManager.svelte` | **MOVES** | → `domains/cad2d/panels/` (registered as panel) |
| `src/lib/components/PropertiesPanel.svelte` | **MOVES** | → `domains/cad2d/panels/` |
| `src/lib/components/ContextMenu.svelte` | **STAYS** | Shell component, content from `ContextMenuManager` |
| `src/lib/components/WelcomeScreen.svelte` | **STAYS** | Shell component |
| `src/lib/components/Workspace.svelte` | **STAYS** | Shell layout component |
| `src/lib/components/NavigationBar.svelte` | **STAYS** | Shell component |
| `src/lib/components/ProjectBrowser.svelte` | **STAYS** | Shell component |

### packages/renderer/ — WRAPS as cad2d renderer

| File | Status | Notes |
|------|--------|-------|
| `src/CadRenderer.ts` | **WRAPS** | Implements `DomainRenderer` interface. Becomes `cad2d` domain's renderer. |
| `src/SnapEngine.ts` | **MOVES** | → platform (snap logic is domain-agnostic, snap modes are per-domain) |
| `src/SelectionManager.ts` | **MOVES** | → platform (selection is global) |

### packages/file-io/ — SPLITS

| File | Status | Destination |
|------|--------|-------------|
| `src/dxf-import.ts` | **MOVES** | → `domains/cad2d/formats/` (registered via FileFormatRegistry) |
| `src/dxf-export.ts` | **MOVES** | → `domains/cad2d/formats/` |
| `src/persistence.ts` | **MOVES** | → platform (project-level auto-save, not domain-specific) |

### packages/core/ — STAYS

| File | Status | Notes |
|------|--------|-------|
| `src/events.ts` | **STAYS** | Core event types shared across all domains. |
| `src/types.ts` | **STAYS** | Core types (Vec2, EntityId, etc.) shared across all domains. |

---

## 13. Migration Path

The migration from monolith to plugin architecture is **incremental**. Each phase leaves the app fully working. No big-bang rewrite.

### Phase M0: Extract platform registries (no domain split yet)

**Goal:** Create the registration infrastructure without moving any code.

1. Create `packages/platform/` with:
   - `DomainRegistry.ts` — empty registry, no domains yet
   - `WorkbenchManager.ts` — single hardcoded workbench ("2D CAD")
   - `ShortcutManager.ts` — reads shortcuts from registry instead of `+page.svelte` hardcoding
   - `FileFormatRegistry.ts` — wraps existing file-io
   - `HookBus.ts` — event notification system
   - `RendererSlots.ts` — single slot, current renderer

2. Wire `+page.svelte` to use platform registries instead of direct imports:
   - Shortcuts → `ShortcutManager.resolve(key)` → `CommandRegistry.execute(id)`
   - File open → `FileFormatRegistry.import(file)`

3. **Verify:** App works identically. No user-visible changes. All tests pass.

### Phase M1: Define DomainManifest, create cad2d domain

**Goal:** Package existing code as the first domain.

1. Create `domains/cad2d/` directory with:
   - `manifest.ts` — the `DomainManifest` (as shown in section 6)
   - `tools/` — move all 37 tool classes from `packages/app/src/lib/tools/`
   - `panels/` — move `LayerManager.svelte`, `PropertiesPanel.svelte`
   - `formats/` — move `dxf-import.ts`, `dxf-export.ts`

2. Update imports: everything that imported from `packages/app/src/lib/tools/` now imports from `domains/cad2d/tools/`.

3. Register `cad2d` domain on startup:
   ```typescript
   import { cad2dManifest } from 'domains/cad2d/manifest';
   DomainRegistry.register(cad2dManifest);
   DomainRegistry.activate('cad2d');
   ```

4. **Verify:** App works identically. `cad2d` is the only domain, auto-activated.

### Phase M2: Make kernel command dispatch extensible

**Goal:** Allow domains to register command handlers without modifying the `Command` enum.

1. Add a generic command path to the kernel:
   ```rust
   // In addition to the existing Command enum:
   pub fn execute_domain_command(&mut self, domain: &str, command: &str, params: &str) -> String
   ```
   
2. Domain commands route through this generic path. The kernel delegates to registered handlers (Rust trait objects or dynamic dispatch).

3. Existing `Command` enum variants continue to work — this is additive, not a replacement.

4. **Verify:** Existing commands work via both paths. New domain commands can be added without modifying the enum.

### Phase M3: Implement workbench switching

**Goal:** Enable switching between two domains.

1. Stub a `cad3d` domain with minimal manifest (even if it only has a "Hello 3D" panel).

2. Implement `WorkbenchManager.switchTo()` with the full flow described in section 7.

3. Add workbench selector to the UI shell (dropdown in navigation bar).

4. **Verify:** Switching between `cad2d` and `cad3d` reconfigures toolbar, shortcuts, panels. Switching back restores everything.

### Phase M4: Add second real domain (BIM or GIS)

**Goal:** Prove the architecture with a real domain that has genuinely different requirements.

1. Create `domains/bim/` (or `domains/gis/`) with its own manifest, commands, tools, renderer, file formats.

2. This domain adds new ECS components, registers new file formats, contributes new panels.

3. Cross-domain queries work: "select all BIM walls that intersect this CAD boundary."

4. **Verify:** Two real domains coexist. Workbench switching works. AI agents can discover and call tools from either domain.

### Phase sequencing

```
v0.1 (now)     → Monolith. Ship it.
v0.2           → Phase M0 + M1 (extract platform, create cad2d domain)
v0.3           → Phase M2 (extensible kernel dispatch)
v0.4           → Phase M3 (workbench switching) + 3D CAD domain
v0.5           → Phase M4 (BIM domain)
v0.6+          → GIS, Civil, Point Cloud, Digital Twin domains
```

Each phase is independently shippable. If priorities change after user testing (per ROADMAP.md), phases can be reordered. The only hard dependency is M0 before M1, and M1 before M3.

---

## Appendix A: Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Domain manifest format | TypeScript object, not JSON file | Type safety, can reference functions (execute, invoke) |
| Command namespacing | `domain:command` (e.g., `cad2d:draw_line`) | Prevents collisions, enables domain-scoped queries |
| Lazy domain loading | Dynamic `import()` on first activation | Fast startup, small initial bundle |
| Renderer architecture | Slot-based composition | Supports single, split, overlay, and extension patterns |
| Hook system | Synchronous emit, async subscribers optional | Simple mental model, predictable ordering |
| Kernel extensibility | Generic `execute_domain_command()` path | Additive — doesn't break existing Command enum |
| File format registry | Priority-based with active-domain preference | Handles multi-domain format ownership |
| Permanent vs transient UI | Shell owns permanent, domains own transient | Clean switch semantics, no orphaned panels |

## Appendix B: Cross-Reference to Existing Decisions

| This document | References |
|---------------|-----------|
| Section 5 (3-layer design) | AD-03 (ECS), AD-04 (Additive expansion) |
| Section 6 (DomainManifest) | AD-01 (Command pattern), AD-06 (AI first-class) |
| Section 7 (Workbench switching) | TC-03 (Layout architecture), TC-13 (Docking deferred) |
| Section 8 (Agent registration) | AD-06 (AI first-class), TC-16 (Agent panel UX) |
| Section 9 (Renderer composition) | AD-05 (Rust/WASM + TS), TC-12 (Keep Three.js), TC-14 (Threlte deferred) |
| Section 12 (Code mapping) | AD-04 (Never rewrite, always extend) |
| Section 13 (Migration path) | ROADMAP.md phase sequence |
