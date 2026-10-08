# 35 — UI System Design: Domain-Agnostic Shell Architecture

> **Status:** Implementation proposal (2026-04-19)
> **Depends on:** 12-application-shell, 31-input-state-machine, 33-ui-interaction-architecture, 34-platform-architecture
> **Research basis:** docs/research/ui/08-industry-ui-architecture-patterns.md
> **Scope:** The 5 structural changes needed to make the UI layer scalable from 2D CAD to BIM/GIS/Civil

---

## Problem Statement

The current UI implementation is a working 2D CAD vertical slice. It has 37 tool handlers, 18 Svelte components, full keyboard routing, and a functional InteractionShell. But it is **structurally coupled to 2D CAD assumptions** in five ways that will resist additive expansion (Rule 4):

1. **Input routing** is an imperative if-chain, not a data-driven state machine
2. **Tool registration** is hard-wired constructor imports, not a plugin registry
3. **Panel updates** are full-sync after every command, not event-driven
4. **Properties panel** is a geometry-type if-chain, not component-query driven
5. **Command discovery** is toolbar-only, no universal search

Each of these is a design decision that works for 37 CAD tools but breaks at 100+ tools across 4 domains.

---

## Architectural Diagnosis

### Current Data Flow
```
User Input → +page.svelte event handler
  → InteractionShell.handleInput() [imperative if-chain]
    → ToolHandler.onCoordinateInput/onPointerMove/onCommandInput
      → AppState.executeCommand(JSON)
        → Kernel.execute_command(JSON.stringify) [WASM]
          → AppState.syncView() [full JSON re-parse]
            → CadRenderer.syncEntities(json, layerColors)
```

### Bottlenecks Identified

| Bottleneck | Location | Impact |
|---|---|---|
| Snap on every POINTER_MOVE | InteractionShell:756-781 | 60fps cap at 500+ entities |
| Full JSON re-parse on syncView | AppState:138-163 | ~2-5ms per command at 1K entities |
| N+1 WASM calls per command | AppState:166-171 | execute + has_changes + get_entities + get_layers + get_styles |
| No command batching | AppState:166 | Paste 100 items = 100 round-trips |
| Selection sync loop | SelectionSet:122-130 | O(n) renderer calls per selection change |

### Coupling Points

| Component | Coupling | Consequence |
|---|---|---|
| registerBuiltinCommands.ts | Imports 37 handler classes by name | Adding BIM tools modifies this file |
| PropertiesPanel.svelte | if-chain on geometry type | Adding entity types modifies this file |
| InteractionShell.svelte.ts | 8-step imperative routing | Adding modal behaviors modifies the router |
| AppState.svelte.ts | Hardcodes CadRenderer | Can't swap to 3D/GIS renderer |
| CommandRegistry | Flat list, no grouping | Can't activate/deactivate domain commands |

---

## The Five Architectural Moves

### Move 1: UIEventBus — Typed Notification Channels

**Pattern source:** Blender's NC_* notification system

Replace full-sync-after-every-command with typed channels. Panels subscribe to channels they care about. Most commands emit 1-2 channels, not a full rebuild.

```typescript
// packages/app/src/lib/shell/UIEventBus.svelte.ts

type UIChannel =
  | 'entities:created'
  | 'entities:modified'
  | 'entities:deleted'
  | 'selection:changed'
  | 'layers:changed'
  | 'styles:changed'
  | 'viewport:changed'
  | 'tool:changed'
  | 'mode:changed';

class UIEventBus {
  private listeners = new Map<UIChannel, Set<() => void>>();

  subscribe(channel: UIChannel, handler: () => void): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(handler);
    return () => this.listeners.get(channel)?.delete(handler);
  }

  emit(channel: UIChannel): void {
    this.listeners.get(channel)?.forEach(fn => fn());
  }

  emitMany(channels: UIChannel[]): void {
    for (const ch of channels) this.emit(ch);
  }
}
```

**Integration with kernel bridge:**
```typescript
// In AppState.executeCommand()
executeCommand(command: object): CommandResult {
  const result = JSON.parse(this.kernel.execute_command(JSON.stringify(command)));
  
  // Determine which channels to emit based on command type
  const channels = resolveChannels(command);
  this.bus.emitMany(channels);
  
  return result;
}

function resolveChannels(command: object): UIChannel[] {
  const type = (command as any).type;
  if (type.startsWith('Create')) return ['entities:created'];
  if (type.startsWith('Delete')) return ['entities:deleted'];
  if (type.startsWith('Move') || type.startsWith('Rotate') || type.startsWith('Scale'))
    return ['entities:modified'];
  if (type.startsWith('SetLayer') || type.startsWith('CreateLayer'))
    return ['layers:changed'];
  if (type === 'Undo' || type === 'Redo')
    return ['entities:created', 'entities:deleted', 'entities:modified', 'layers:changed'];
  return ['entities:modified'];
}
```

**Panel subscriptions:**
```typescript
// PropertiesPanel — only rebuilds on selection change
$effect(() => {
  return bus.subscribe('selection:changed', () => refreshProperties());
});

// LayerManager — only rebuilds on layer change
$effect(() => {
  return bus.subscribe('layers:changed', () => refreshLayers());
});

// Renderer — only re-syncs on entity changes
$effect(() => {
  const unsub1 = bus.subscribe('entities:created', () => syncRenderer());
  const unsub2 = bus.subscribe('entities:modified', () => syncRenderer());
  const unsub3 = bus.subscribe('entities:deleted', () => syncRenderer());
  return () => { unsub1(); unsub2(); unsub3(); };
});
```

**Why first:** Everything else publishes/subscribes through this. Without it, every subsequent move still triggers full-sync.

---

### Move 2: Data-Driven InputRouter

**Pattern source:** LibreCAD's LC_EventHandler dispatch priority + Blender's PASS_THROUGH

Replace the imperative if-chain in InteractionShell with a registered handler chain. Each level is a function array, not a code branch. Tools register their keymaps at activation. Domains register global keymaps at load.

```typescript
// packages/app/src/lib/shell/InputRouter.svelte.ts

interface InputHandler {
  id: string;
  priority: number;
  canHandle(event: InputEvent, mode: InputMode): boolean;
  handle(event: InputEvent, context: ShellContext): HandleResult;
}

type HandleResult =
  | { action: 'consumed' }                    // handled, stop dispatch
  | { action: 'pass_through' }                // not handled, try next
  | { action: 'consumed_with_mode'; mode: InputMode }; // handled + mode transition

class InputRouter {
  private handlers: InputHandler[] = [];  // sorted by priority

  register(handler: InputHandler): () => void {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
    return () => {
      this.handlers = this.handlers.filter(h => h.id !== handler.id);
    };
  }

  dispatch(event: InputEvent, mode: InputMode, context: ShellContext): void {
    for (const handler of this.handlers) {
      if (!handler.canHandle(event, mode)) continue;
      const result = handler.handle(event, context);
      if (result.action === 'consumed') return;
      if (result.action === 'consumed_with_mode') {
        context.setMode(result.mode);
        return;
      }
      // pass_through: continue to next handler
    }
  }
}
```

**Priority levels (lower = checked first):**
```typescript
const PRIORITY = {
  MODAL_DIALOG:     100,   // active dialog captures all input
  CONTEXT_MENU:     200,   // open context menu captures
  ACTIVE_TOOL:      300,   // tool-specific sub-commands (C=close, U=undo)
  TRANSPARENT_CMD:  400,   // zoom, pan during tool (Blender PASS_THROUGH)
  ESCAPE:           500,   // cancel tool, clear selection
  GLOBAL_SHORTCUT:  600,   // Ctrl+Z, Ctrl+S, function keys
  COMMAND_ALIAS:    700,   // LINE, CIRCLE, MOVE (typed in command line)
  COORDINATE_PARSE: 800,   // 10,20 or @5<45
  IDLE_SELECTION:   900,   // click/drag to select
  UNHANDLED:       1000,   // "Unknown command" feedback
} as const;
```

**Tool keymap registration (fixes bugs #1, #2, #12):**
```typescript
// When LineHandler activates, it registers its keymaps at ACTIVE_TOOL priority
class LineHandler extends BaseToolHandler {
  activate(ctx: ToolContext): () => void {
    const unregister = ctx.router.register({
      id: 'line-tool-keys',
      priority: PRIORITY.ACTIVE_TOOL,
      canHandle: (event) => event.type === 'COMMAND_INPUT',
      handle: (event) => {
        const cmd = event.text.toLowerCase();
        if (cmd === 'c' && this.points.length >= 2) {
          this.close();
          return { action: 'consumed' };
        }
        if (cmd === 'u' && this.points.length >= 1) {
          this.undoLastPoint();
          return { action: 'consumed' };
        }
        return { action: 'pass_through' };  // not our command
      }
    });
    return unregister;  // cleanup on deactivate
  }
}
```

Now `C` during LINE is caught at priority 300 (ACTIVE_TOOL) before it reaches priority 700 (COMMAND_ALIAS) where `C` = Circle.

---

### Move 3: DomainModule — Plugin Architecture

**Pattern source:** FreeCAD's Workbench system

Refactor current 2D CAD tools into the first `DomainModule`. The shell becomes domain-agnostic. Adding BIM = registering a new module.

```typescript
// packages/app/src/lib/domains/DomainModule.ts

interface DomainModule {
  id: string;                              // 'cad-2d' | 'bim' | 'gis' | 'civil'
  name: string;                            // 'CAD 2D Drafting'
  commands: CommandDef[];                  // tools this domain provides
  toolbarGroups: ToolbarGroup[];           // toolbar layout
  keymaps: KeymapEntry[];                  // domain-wide shortcuts
  propertyEditors: PropertyEditorDef[];    // per-geometry-type editors
  panels?: PanelDef[];                     // domain-specific panels
  activate(context: ShellContext): void;   // setup on domain switch
  deactivate(): void;                      // teardown on domain switch
}

interface ToolbarGroup {
  id: string;
  label: string;
  commands: string[];  // command IDs
  position: 'draw' | 'modify' | 'annotate' | 'analysis' | 'custom';
}

interface PropertyEditorDef {
  geometryType: string;            // 'Line' | 'Circle' | 'BIMWall' | ...
  component: typeof SvelteComponent; // the Svelte component to render
}

interface KeymapEntry {
  key: string;       // 'l' | 'ctrl+s' | 'f10'
  command: string;   // command ID
  mode?: InputMode;  // optional: only active in this mode
}
```

**Shell integration:**
```typescript
// packages/app/src/lib/shell/DomainManager.svelte.ts

class DomainManager {
  activeDomain = $state<DomainModule | null>(null);
  private loadedDomains = new Map<string, DomainModule>();

  register(domain: DomainModule): void {
    this.loadedDomains.set(domain.id, domain);
  }

  activate(domainId: string, context: ShellContext): void {
    this.activeDomain?.deactivate();

    const domain = this.loadedDomains.get(domainId);
    if (!domain) return;

    // Register domain commands
    for (const cmd of domain.commands) {
      context.commandRegistry.register(cmd);
    }

    // Register domain keymaps
    for (const km of domain.keymaps) {
      context.router.register({
        id: `domain-${domainId}-${km.key}`,
        priority: PRIORITY.GLOBAL_SHORTCUT,
        canHandle: (e) => e.type === 'KEY_DOWN' && matchKey(e, km.key),
        handle: () => {
          context.commandRegistry.execute(km.command);
          return { action: 'consumed' };
        }
      });
    }

    domain.activate(context);
    this.activeDomain = domain;
  }
}
```

**Current 2D CAD as first module:**
```typescript
// packages/app/src/lib/domains/cad2d/index.ts

export const cad2dModule: DomainModule = {
  id: 'cad-2d',
  name: 'CAD 2D Drafting',
  commands: [
    { id: 'LINE', aliases: ['L'], invoke: () => new LineHandler(), ... },
    { id: 'CIRCLE', aliases: ['C'], invoke: () => new CircleHandler(), ... },
    // ... all 37 current tools
  ],
  toolbarGroups: [
    { id: 'draw', label: 'Draw', commands: ['LINE', 'CIRCLE', 'ARC', ...], position: 'draw' },
    { id: 'modify', label: 'Modify', commands: ['MOVE', 'COPY', 'ROTATE', ...], position: 'modify' },
  ],
  keymaps: [
    { key: 'l', command: 'LINE' },
    { key: 'c', command: 'CIRCLE', mode: 'IDLE' },  // only when no tool active
    // ...
  ],
  propertyEditors: [
    { geometryType: 'Line', component: LinePropertyEditor },
    { geometryType: 'Circle', component: CirclePropertyEditor },
    // ...
  ],
  activate(ctx) { /* nothing special for default module */ },
  deactivate() { /* cleanup */ },
};
```

---

### Move 4: Component-Query Properties Panel

**Pattern source:** Blender's property tabs + FreeCAD's TaskWatcher

Replace the geometry-type if-chain with a registry lookup. Each domain module registers property editors for its entity types. The panel discovers editors from the registry.

```svelte
<!-- packages/app/src/lib/components/PropertiesPanel.svelte -->

<script lang="ts">
  const { domainManager, selectionState } = getShellContext();

  const editorComponent = $derived(() => {
    const entity = selectionState.selectedEntity;
    if (!entity) return null;
    
    const geometryType = Object.keys(entity.geometry)[0];
    const editors = domainManager.activeDomain?.propertyEditors ?? [];
    const match = editors.find(e => e.geometryType === geometryType);
    return match?.component ?? GenericPropertyEditor;
  });
</script>

{#if editorComponent}
  <svelte:component this={editorComponent} entity={selectionState.selectedEntity} />
{/if}
```

**Multi-select batch editing:**
```typescript
interface PropertyEditorProps {
  entity?: Entity;          // single selection
  entities?: Entity[];      // multi-selection
  mode: 'single' | 'batch';
}

// Batch editor shows only shared properties (layer, color, linetype, lineweight)
// Single editor shows geometry-specific fields
```

**Why this scales:** BIM has ~400 IFC entity types. GIS has feature attribute tables. Civil has alignment parameters. Each domain registers its editors. The panel never changes.

---

### Move 5: Command Palette

**Pattern source:** VS Code, Linear, Figma

Universal search over commands, entities, layers, recent actions. Built on existing `CommandRegistry`.

```svelte
<!-- packages/app/src/lib/components/CommandPalette.svelte -->

<script lang="ts">
  let query = $state('');
  let visible = $state(false);

  const results = $derived(() => {
    if (!query) return recentCommands();
    return fuzzySearch(query, allEntries());
  });

  function allEntries(): PaletteEntry[] {
    return [
      ...commandRegistry.getAll().map(cmd => ({
        id: cmd.id,
        label: cmd.name,
        category: 'command' as const,
        shortcut: cmd.shortcut,
        action: () => commandRegistry.execute(cmd.id),
      })),
      ...getLayerEntries(),
      ...getEntityEntries(),
    ];
  }

  function fuzzySearch(q: string, entries: PaletteEntry[]): PaletteEntry[] {
    return entries
      .map(e => ({ ...e, score: fuzzyScore(q, e.label) }))
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }
</script>
```

**Keyboard trigger:**
```typescript
// Registered at GLOBAL_SHORTCUT priority
{ key: 'ctrl+k', command: 'COMMAND_PALETTE' }
{ key: 'ctrl+shift+p', command: 'COMMAND_PALETTE' }
```

---

## Implementation Phases

| Phase | What | Depends On | Files Changed | Risk |
|---|---|---|---|---|
| **1** | UIEventBus + wire into executeCommand/syncView | None | AppState.svelte.ts + new UIEventBus.svelte.ts | Low — additive, existing behavior preserved |
| **2** | InputRouter + priority dispatch | Phase 1 | InteractionShell.svelte.ts refactor + new InputRouter.svelte.ts | Medium — core routing change |
| **3** | DomainModule interface + extract cad2d module | Phase 2 | New domains/ dir, refactor registerBuiltinCommands.ts | Medium — large but mechanical refactor |
| **4** | Property editor registry + component-query panel | Phase 3 | PropertiesPanel.svelte refactor + per-type editor components | Low — UI only |
| **5** | Command palette | Phase 2 | New CommandPalette.svelte | Low — pure addition |
| **6** | Polish (A3, A4, A5, A10, shortcuts) | Phases 1-5 | Various components | Low — straightforward features |

### Phase Dependency Graph
```
Phase 1 (UIEventBus)
  └─→ Phase 2 (InputRouter)
        ├─→ Phase 3 (DomainModule)
        │     └─→ Phase 4 (Property Registry)
        └─→ Phase 5 (Command Palette)
              └─→ Phase 6 (Polish)
```

---

## Compatibility with Existing Architecture

| Existing Doc | Relationship | Compatibility |
|---|---|---|
| 04-design-patterns (Observer) | UIEventBus IS the observer pattern | Direct implementation |
| 12-application-shell (AppState) | AppState gains bus reference, loses syncView coupling | Evolutionary refactor |
| 14-ports-adapters (RenderPort) | DomainModule wraps renderer injection | Compatible |
| 31-input-state-machine | InputRouter IS the state machine | Direct implementation |
| 33-ui-interaction-architecture | This doc supersedes 33's dispatch chain design | Replacement |
| 34-platform-architecture | DomainModule IS the domain plugin system | Direct implementation |

---

## What This Does NOT Change

- **Kernel architecture** — Rust/WASM, command dispatch, event sourcing all unchanged
- **Renderer** — Three.js, CadRenderer API unchanged
- **Tool handlers** — BaseToolHandler, ToolHandler interface unchanged. Tools gain a `router.register()` call in activate(), that's it
- **File I/O** — DXF/PDF export unchanged
- **State management** — Svelte 5 runes, $state/$derived patterns unchanged

The changes are in the **wiring layer** between tools, panels, and the kernel — not in the tools, panels, or kernel themselves.

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| InputRouter refactor breaks existing tool flow | Phase 2 runs behind feature flag; old InteractionShell stays until all tools verified |
| DomainModule extraction is too large | Phase 3 is mechanical — move files into domains/cad2d/, update imports. No logic changes. |
| UIEventBus adds overhead vs direct calls | Bus is synchronous Set iteration. Measured overhead: <0.01ms per emit. |
| Command palette search is slow with 1000+ entities | Debounce 150ms + limit to 20 results. Entity search optional (behind toggle). |

---

## Success Criteria

- [ ] Adding a new command requires: one file (handler) + one registration (in domain module). Zero core file modifications.
- [ ] Adding a new entity type to properties panel requires: one component + one registration. Zero PropertiesPanel.svelte modifications.
- [ ] Tool sub-commands (`C` = close during LINE) always resolve before global shortcuts.
- [ ] `syncView()` no longer called — replaced by channel-specific sync functions.
- [ ] `Ctrl+K` opens command palette with fuzzy search over all registered commands.
- [ ] A hypothetical BIM module can be loaded without modifying any file in `lib/shell/` or `lib/components/`.
