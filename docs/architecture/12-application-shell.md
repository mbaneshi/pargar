# 12 — Application Shell Architecture

> **Status:** Spec — ready for implementation  
> **Author:** Cowork consulting agent  
> **Date:** 2026-04-13  
> **Implements:** CLAUDE.md Rules 1, 2, 5, 6  
> **Sources:** Blender modal operators, FreeCAD DrawSketchHandler, tldraw StateNode, Excalidraw ActionManager, Zoo/KittyCAD XState, Figma plugin model, Comlink, WASI Component Model, Cursor/Copilot UX patterns, Svelte 5 runes  

---

## 0. Problem Statement

The current `+page.svelte` is a ~800-line monolith containing all tool logic, state management, command parsing, file I/O, and UI layout in a single file. Every agent merge risks destroying previously working features because there are no structural boundaries to merge against. The file has:

- A single giant `handleClick()` with 15 if/else branches (one per tool)
- 30+ top-level `$state` variables with no grouping
- Tool state tracked by a single `drawStep` integer shared across all tools
- No component decomposition (LayerPanel exists but is not imported)
- No tool state machines — tool transitions happen via scattered `setTool()` calls
- Inline constraint buttons with kernel calls directly in the template

This spec defines the architecture that replaces it. The goal is a structure where each tool, each panel, and each subsystem lives in its own file — so agent merges touch isolated files, not a shared monolith.

---

## 1. Component Tree

```
+page.svelte                          ← ~50 lines: layout shell only
├── Toolbar.svelte                    ← tool buttons, undo/redo, snap toggle
│   ├── FileMenu.svelte               ← (exists) new/open/save/export
│   ├── ToolGroup.svelte              ← draw tools (Line, Circle, Rect, Arc, Polyline)
│   ├── EditGroup.svelte              ← edit tools (Move, Copy, Rotate, Delete)
│   ├── ModifyGroup.svelte            ← modify tools (Offset, Trim, Mirror, Scale)
│   ├── ConstraintGroup.svelte        ← constraint buttons (H, V, Parallel, Perp)
│   └── ViewControls.svelte           ← snap toggle, zoom extents, entity count
├── Workspace.svelte                  ← flex container for canvas + panels
│   ├── CanvasViewport.svelte         ← canvas container + renderer lifecycle
│   ├── PropertiesPanel.svelte        ← (exists) entity property editor
│   ├── LayerPanel.svelte             ← (exists, not imported) layer management
│   └── AgentPanel.svelte             ← (Sprint 9) AI action log + accept/reject
├── CommandLine.svelte                ← command input + coordinate parsing
└── StatusBar.svelte                  ← status text, coordinates, autosave indicator
```

**File locations:**
```
packages/app/src/
├── routes/+page.svelte               ← shell only
├── lib/
│   ├── stores/                        ← state management
│   │   ├── AppState.svelte.ts         ← central state class
│   │   ├── ToolMachine.svelte.ts      ← tool state machine
│   │   └── SelectionState.svelte.ts   ← selection management
│   ├── tools/                         ← one file per tool
│   │   ├── BaseTool.ts                ← abstract tool interface
│   │   ├── SelectTool.ts
│   │   ├── LineTool.ts
│   │   ├── CircleTool.ts
│   │   ├── RectangleTool.ts
│   │   ├── ArcTool.ts
│   │   ├── PolylineTool.ts
│   │   ├── MoveTool.ts
│   │   ├── CopyTool.ts
│   │   ├── RotateTool.ts
│   │   ├── OffsetTool.ts
│   │   ├── TrimTool.ts
│   │   ├── MirrorTool.ts
│   │   ├── ScaleTool.ts
│   │   ├── TextTool.ts
│   │   ├── DimensionTool.ts
│   │   └── registry.ts               ← tool registry (name → class)
│   ├── components/                    ← UI components
│   │   ├── Toolbar.svelte
│   │   ├── ToolGroup.svelte
│   │   ├── EditGroup.svelte
│   │   ├── ModifyGroup.svelte
│   │   ├── ConstraintGroup.svelte
│   │   ├── ViewControls.svelte
│   │   ├── Workspace.svelte
│   │   ├── CanvasViewport.svelte
│   │   ├── CommandLine.svelte
│   │   ├── StatusBar.svelte
│   │   └── AgentPanel.svelte
│   ├── PropertiesPanel.svelte         ← (existing, keep)
│   ├── LayerPanel.svelte              ← (existing, keep)
│   ├── FileMenu.svelte                ← (existing, keep)
│   └── HelpOverlay.svelte             ← (existing, keep)
```

---

## 2. State Management

### 2.1 Design Decision

Use **Svelte 5 runes with class-based state** via the Context API. No external library (no Zustand, no XState, no Redux). Rationale:

- Svelte 5 `$state` in classes gives fine-grained reactivity without boilerplate
- Context API provides dependency injection without globals
- Classes group related state and methods, making each concern a self-contained unit
- No serialization overhead from external stores
- Matches Svelte 5 idioms (runes, not stores)

### 2.2 AppState — Central State Class

```typescript
// packages/app/src/lib/stores/AppState.svelte.ts

import type { Kernel } from '@nexus/kernel';
import type { CadRenderer } from '@nexus/renderer';
import { ToolMachine } from './ToolMachine.svelte';
import { SelectionState } from './SelectionState.svelte';

export class AppState {
  // Core references
  kernel: Kernel | null = $state(null);
  renderer: CadRenderer | null = $state(null);

  // Project
  projectName = $state('untitled');
  autoSaveStatus = $state('');

  // Viewport
  cursorX = $state(0);
  cursorY = $state(0);
  snapX = $state(0);
  snapY = $state(0);
  hasSnap = $state(false);
  snapType = $state('');
  snapEnabled = $state(true);

  // Status
  statusText = $state('Ready');
  entityCount = $state(0);
  canUndo = $state(false);
  canRedo = $state(false);

  // Sub-state objects
  tools: ToolMachine;
  selection: SelectionState;

  constructor() {
    this.tools = new ToolMachine(this);
    this.selection = new SelectionState(this);
  }

  /** Snap-aware cursor position */
  get cursorPoint(): { x: number; y: number } {
    return this.hasSnap
      ? { x: this.snapX, y: this.snapY }
      : { x: this.cursorX, y: this.cursorY };
  }

  /** Sync renderer with kernel state — single source of truth */
  syncView() {
    if (!this.kernel || !this.renderer) return;
    const json = this.kernel.get_entities_json();
    const layerColors = new Map([['default', '#00ff88']]);
    this.renderer.syncEntities(json, layerColors);
    this.entityCount = this.kernel.entity_count();
    this.canUndo = this.kernel.can_undo();
    this.canRedo = this.kernel.can_redo();
    if (this.renderer.selectionManager?.selectedIds.size > 0) {
      this.renderer.updateSelection();
    }
    this.renderer.render();
  }

  /** Execute a Command JSON through the kernel (Rule 1) */
  executeCommand(command: object): { success: boolean; created_ids: string[]; error?: string } {
    if (!this.kernel) return { success: false, created_ids: [], error: 'Kernel not initialized' };
    const result = JSON.parse(this.kernel.execute_command(JSON.stringify(command)));
    this.syncView();
    return result;
  }

  undo() {
    if (this.kernel?.can_undo()) {
      this.kernel.undo();
      this.syncView();
      this.statusText = 'Undo';
    }
  }

  redo() {
    if (this.kernel?.can_redo()) {
      this.kernel.redo();
      this.syncView();
      this.statusText = 'Redo';
    }
  }
}
```

### 2.3 Context Wiring

```typescript
// In +page.svelte
import { setContext } from 'svelte';
import { AppState } from '$lib/stores/AppState.svelte';

const app = new AppState();
setContext('app', app);
```

```typescript
// In any child component
import { getContext } from 'svelte';
import type { AppState } from '$lib/stores/AppState.svelte';

const app = getContext<AppState>('app');
```

### 2.4 SelectionState

```typescript
// packages/app/src/lib/stores/SelectionState.svelte.ts

import type { AppState } from './AppState.svelte';

export class SelectionState {
  private app: AppState;
  selectedIds = $state<string[]>([]);
  selectedEntity = $state<any>(null);

  constructor(app: AppState) {
    this.app = app;
  }

  select(id: string) {
    this.selectedIds = [id];
    if (this.app.kernel) {
      const json = this.app.kernel.get_entity_json(id);
      this.selectedEntity = json ? JSON.parse(json) : null;
    }
    this.app.renderer?.selectionManager.clear();
    this.app.renderer?.selectionManager.select(id);
    this.app.renderer?.updateSelection();
    this.app.renderer?.render();
  }

  clear() {
    this.selectedIds = [];
    this.selectedEntity = null;
    this.app.renderer?.selectionManager.clear();
    this.app.renderer?.updateSelection();
    this.app.renderer?.render();
  }

  getSelectedIds(): string[] {
    return this.app.renderer?.selectionManager.getSelectedIds() ?? [];
  }
}
```

---

## 3. Tool State Machine

### 3.1 Design Decision

Adapt **tldraw's StateNode pattern** for Svelte 5. Each tool is a class with lifecycle methods (`onEnter`, `onExit`, `onPointerDown`, `onPointerMove`, `onKeyDown`). The ToolMachine holds the active tool and dispatches events to it.

Why tldraw's pattern over alternatives:
- **vs Blender modal operators:** Blender's invoke→modal→exit is C-specific; tldraw's is already TypeScript
- **vs FreeCAD DrawSketchHandler:** FreeCAD uses a state integer (like our current `drawStep`) — exactly the pattern we're escaping
- **vs Zoo/KittyCAD XState:** XState adds 15kb and a DSL; the same pattern works with plain classes
- **vs Excalidraw ActionManager:** Actions are one-shot; tools need multi-step state (click→click→done)

### 3.2 Tool Interface

```typescript
// packages/app/src/lib/tools/BaseTool.ts

import type { AppState } from '../stores/AppState.svelte';

export interface ToolContext {
  app: AppState;
}

export abstract class BaseTool {
  /** Unique tool ID — matches Command aliases */
  abstract readonly id: string;
  /** Display name for toolbar */
  abstract readonly label: string;
  /** Keyboard shortcut (single key or combo) */
  abstract readonly shortcut: string;
  /** Command-line aliases (e.g., ['l', 'line']) */
  abstract readonly aliases: string[];
  /** Category for toolbar grouping */
  abstract readonly category: 'draw' | 'edit' | 'modify' | 'annotate' | 'select';

  protected ctx!: ToolContext;

  /** Internal state — each tool manages its own steps */
  protected step = 0;
  protected points: { x: number; y: number }[] = [];

  attach(ctx: ToolContext) {
    this.ctx = ctx;
  }

  /** Called when tool becomes active */
  onEnter(): void {
    this.step = 0;
    this.points = [];
  }

  /** Called when tool is deactivated */
  onExit(): void {
    this.step = 0;
    this.points = [];
    this.ctx.app.renderer?.clearPreview();
  }

  /** Primary click (left mouse button) */
  onPointerDown(pt: { x: number; y: number }, worldX: number, worldY: number): void {}

  /** Mouse/pointer move */
  onPointerMove(pt: { x: number; y: number }): void {}

  /** Keyboard event while tool is active */
  onKeyDown(e: KeyboardEvent): boolean { return false; /* not handled */ }

  /** Command-line input while tool is active (e.g., distance, angle) */
  onCommandInput(input: string): boolean { return false; /* not handled */ }

  /** Status text for the current step */
  abstract getStatusText(): string;
}
```

### 3.3 Tool Implementations

```typescript
// packages/app/src/lib/tools/LineTool.ts

import { BaseTool } from './BaseTool';

export class LineTool extends BaseTool {
  readonly id = 'line';
  readonly label = 'Line';
  readonly shortcut = 'l';
  readonly aliases = ['l', 'line'];
  readonly category = 'draw' as const;

  onEnter() {
    super.onEnter();
  }

  onPointerDown(pt: { x: number; y: number }) {
    if (this.step === 0) {
      this.points = [pt];
      this.step = 1;
    } else {
      // Rule 1: dispatch through Command system
      this.ctx.app.executeCommand({
        type: 'CreateLine',
        x1: this.points[0].x,
        y1: this.points[0].y,
        x2: pt.x,
        y2: pt.y,
        layer_id: 'default',
      });
      // Chain: next line starts from this endpoint
      this.points = [pt];
    }
  }

  onPointerMove(pt: { x: number; y: number }) {
    if (this.step === 1 && this.points.length > 0) {
      this.ctx.app.renderer?.setPreview('line', this.points[0], pt);
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (this.step > 0) {
        this.step = 0;
        this.points = [];
        this.ctx.app.renderer?.clearPreview();
        return true;
      }
    }
    return false;
  }

  onCommandInput(input: string): boolean {
    // Handle coordinate input: "10,5" or "@5,5" or "@10<45"
    if (this.step === 1) {
      const pt = parseCoordinate(input, this.points[0]);
      if (pt) {
        this.onPointerDown(pt);
        return true;
      }
    }
    return false;
  }

  getStatusText(): string {
    return this.step === 0
      ? 'Line: click start point'
      : 'Line: click end point or type coordinates (Esc to cancel)';
  }
}

/** Shared coordinate parser — extracted from monolith */
export function parseCoordinate(
  input: string,
  lastPoint: { x: number; y: number }
): { x: number; y: number } | null {
  const trimmed = input.trim();

  // Polar: @distance<angle
  const polar = trimmed.match(/^@([\d.]+)<([\d.]+)$/);
  if (polar) {
    const dist = parseFloat(polar[1]);
    const angle = parseFloat(polar[2]) * Math.PI / 180;
    return { x: lastPoint.x + dist * Math.cos(angle), y: lastPoint.y + dist * Math.sin(angle) };
  }

  // Relative: @dx,dy
  const rel = trimmed.match(/^@([-\d.]+),([-\d.]+)$/);
  if (rel) {
    return { x: lastPoint.x + parseFloat(rel[1]), y: lastPoint.y + parseFloat(rel[2]) };
  }

  // Absolute: x,y
  const abs = trimmed.match(/^([-\d.]+),([-\d.]+)$/);
  if (abs) {
    return { x: parseFloat(abs[1]), y: parseFloat(abs[2]) };
  }

  return null;
}
```

```typescript
// packages/app/src/lib/tools/OffsetTool.ts

import { BaseTool } from './BaseTool';

export class OffsetTool extends BaseTool {
  readonly id = 'offset';
  readonly label = 'Offset';
  readonly shortcut = 'o';
  readonly aliases = ['o', 'offset'];
  readonly category = 'modify' as const;

  private distance = 0;

  onEnter() {
    super.onEnter();
    this.distance = 0;
    // Step 0: waiting for distance input via command line
  }

  onPointerDown(pt: { x: number; y: number }, worldX: number, worldY: number) {
    if (this.step !== 1) return;
    const hitId = this.ctx.app.renderer?.hitTest(worldX, worldY);
    if (hitId) {
      this.ctx.app.executeCommand({
        type: 'OffsetEntity',
        id: hitId,
        distance: this.distance,
      });
    }
  }

  onCommandInput(input: string): boolean {
    if (this.step === 0) {
      const dist = parseFloat(input.trim());
      if (!isNaN(dist) && dist > 0) {
        this.distance = dist;
        this.step = 1;
        this.ctx.app.statusText = `OFFSET — Select entity (distance: ${dist}):`;
        return true;
      }
    }
    return false;
  }

  getStatusText(): string {
    return this.step === 0
      ? 'OFFSET — Specify offset distance:'
      : `OFFSET — Select entity (distance: ${this.distance}):`;
  }
}
```

### 3.4 Tool Machine (Dispatcher)

```typescript
// packages/app/src/lib/stores/ToolMachine.svelte.ts

import type { AppState } from './AppState.svelte';
import { BaseTool } from '../tools/BaseTool';
import { toolRegistry } from '../tools/registry';

export class ToolMachine {
  private app: AppState;
  activeTool = $state<BaseTool | null>(null);
  activeToolId = $state<string>('select');

  constructor(app: AppState) {
    this.app = app;
  }

  /** Switch to a tool by ID */
  setTool(id: string) {
    // Exit current tool
    this.activeTool?.onExit();

    // Create and enter new tool
    const ToolClass = toolRegistry.get(id);
    if (!ToolClass) {
      this.app.statusText = `Unknown tool: ${id}`;
      return;
    }

    const tool = new ToolClass();
    tool.attach({ app: this.app });
    tool.onEnter();

    this.activeTool = tool;
    this.activeToolId = id;
    this.app.statusText = tool.getStatusText();
  }

  /** Dispatch pointer down to active tool */
  handlePointerDown(worldX: number, worldY: number) {
    const pt = this.app.cursorPoint;
    this.activeTool?.onPointerDown(pt, worldX, worldY);
    if (this.activeTool) {
      this.app.statusText = this.activeTool.getStatusText();
    }
  }

  /** Dispatch pointer move to active tool */
  handlePointerMove(worldX: number, worldY: number) {
    // Update snap
    if (this.app.snapEnabled && this.app.renderer) {
      const entities = this.app.renderer.getEntitiesForSnap();
      const snap = this.app.renderer.snapEngine.findSnap(worldX, worldY, entities);
      if (snap && snap.type !== 'grid') {
        this.app.hasSnap = true;
        this.app.snapX = snap.x;
        this.app.snapY = snap.y;
        this.app.snapType = snap.type;
        this.app.renderer.setSnapIndicator(snap);
      } else if (snap && snap.type === 'grid') {
        this.app.hasSnap = true;
        this.app.snapX = snap.x;
        this.app.snapY = snap.y;
        this.app.snapType = 'grid';
        this.app.renderer.setSnapIndicator(null);
      } else {
        this.app.hasSnap = false;
        this.app.renderer.setSnapIndicator(null);
      }
    }

    this.app.cursorX = worldX;
    this.app.cursorY = worldY;

    const pt = this.app.cursorPoint;
    this.activeTool?.onPointerMove(pt);
  }

  /** Dispatch key event — returns true if handled */
  handleKeyDown(e: KeyboardEvent): boolean {
    return this.activeTool?.onKeyDown(e) ?? false;
  }

  /** Dispatch command-line input — returns true if consumed by active tool */
  handleCommandInput(input: string): boolean {
    return this.activeTool?.onCommandInput(input) ?? false;
  }
}
```

### 3.5 Tool Registry

```typescript
// packages/app/src/lib/tools/registry.ts

import type { BaseTool } from './BaseTool';
import { SelectTool } from './SelectTool';
import { LineTool } from './LineTool';
import { CircleTool } from './CircleTool';
import { RectangleTool } from './RectangleTool';
import { ArcTool } from './ArcTool';
import { PolylineTool } from './PolylineTool';
import { MoveTool } from './MoveTool';
import { CopyTool } from './CopyTool';
import { RotateTool } from './RotateTool';
import { OffsetTool } from './OffsetTool';
import { TrimTool } from './TrimTool';
import { MirrorTool } from './MirrorTool';
import { ScaleTool } from './ScaleTool';
import { TextTool } from './TextTool';
import { DimensionTool } from './DimensionTool';

type ToolConstructor = new () => BaseTool;

const registry = new Map<string, ToolConstructor>();

function register(ToolClass: ToolConstructor) {
  // Instantiate temporarily to read static-like properties
  const temp = new ToolClass();
  registry.set(temp.id, ToolClass);
  for (const alias of temp.aliases) {
    registry.set(alias, ToolClass);
  }
}

register(SelectTool);
register(LineTool);
register(CircleTool);
register(RectangleTool);
register(ArcTool);
register(PolylineTool);
register(MoveTool);
register(CopyTool);
register(RotateTool);
register(OffsetTool);
register(TrimTool);
register(MirrorTool);
register(ScaleTool);
register(TextTool);
register(DimensionTool);

export const toolRegistry = registry;

/** All registered tools grouped by category (for toolbar rendering) */
export function getToolsByCategory(): Map<string, BaseTool[]> {
  const seen = new Set<string>();
  const categories = new Map<string, BaseTool[]>();

  for (const [key, Ctor] of registry) {
    const tool = new Ctor();
    if (seen.has(tool.id)) continue;
    seen.add(tool.id);
    const cat = tool.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(tool);
  }
  return categories;
}
```

---

## 4. Command Dispatch (Rule 1 Compliance)

Every tool calls `app.executeCommand(commandJson)` instead of calling kernel methods directly. This ensures GUI clicks, keyboard shortcuts, command-line input, and AI agent tool calls all go through the same Command system.

### 4.1 Flow

```
User clicks canvas
  → ToolMachine.handlePointerDown()
    → ActiveTool.onPointerDown()
      → app.executeCommand({ type: 'CreateLine', ... })
        → kernel.execute_command(json)
          → Event emitted (Rule 2)
          → CommandResult returned
        → app.syncView()
```

```
AI agent calls MCP tool
  → MCP server receives tool call
    → Builds Command JSON
    → kernel.execute_command(json)     ← same entry point
      → Event emitted
      → CommandResult returned
    → Response to agent
```

```
User types "L" then "10,5"
  → CommandLine dispatches to ToolMachine
    → ToolMachine.handleCommandInput("l") → sets LineTool
    → ToolMachine.handleCommandInput("10,5") → LineTool.onCommandInput()
      → parseCoordinate() → app.executeCommand(...)
```

### 4.2 Command-Line Router

```typescript
// packages/app/src/lib/components/CommandLine.svelte — logic excerpt

function handleCommand(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return;

  // 1. Let active tool try to consume the input first
  if (app.tools.handleCommandInput(input)) return;

  // 2. Check if it's a tool alias
  if (toolRegistry.has(trimmed)) {
    app.tools.setTool(trimmed);
    return;
  }

  // 3. Built-in commands
  if (trimmed === 'u' || trimmed === 'undo') { app.undo(); return; }
  if (trimmed === 'redo') { app.redo(); return; }
  if (trimmed === 'ze' || trimmed === 'zoom extents') {
    app.renderer?.zoomExtents(); return;
  }

  // 4. Coordinate input → default to line tool
  const pt = parseCoordinate(input, { x: 0, y: 0 });
  if (pt) {
    app.tools.setTool('line');
    app.tools.handlePointerDown(pt.x, pt.y);
    return;
  }

  app.statusText = `Unknown: ${input}`;
}
```

---

## 5. +page.svelte — The Shell

After decomposition, the page file becomes a thin layout shell:

```svelte
<!-- packages/app/src/routes/+page.svelte -->
<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { AppState } from '$lib/stores/AppState.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import Workspace from '$lib/components/Workspace.svelte';
  import CommandLine from '$lib/components/CommandLine.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';

  const app = new AppState();
  setContext('app', app);

  onMount(async () => {
    const wasmModule = await import('@nexus/kernel');
    await wasmModule.default();
    app.kernel = new wasmModule.Kernel();

    const { CadRenderer } = await import('@nexus/renderer');
    const container = document.getElementById('canvas-container')!;
    app.renderer = new CadRenderer(container);

    app.renderer.onCursorMove = (wx: number, wy: number) => app.tools.handlePointerMove(wx, wy);
    app.renderer.onClick = (wx: number, wy: number) => app.tools.handlePointerDown(wx, wy);

    app.tools.setTool('select');
    app.statusText = 'Ready — select a tool or press / for command line';
    app.syncView();
    app.renderer.zoomExtents();

    return () => app.renderer?.dispose();
  });

  function handleKeydown(e: KeyboardEvent) {
    // Let tool machine handle first
    if (app.tools.handleKeyDown(e)) return;
    // Global shortcuts
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); app.redo(); }
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); app.undo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { /* delete selected */ }
    else if (e.key === '/') { e.preventDefault(); document.getElementById('cmd-input')?.focus(); }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  <Toolbar />
  <Workspace />
  <div class="bottom-bar">
    <CommandLine />
    <StatusBar />
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    user-select: none;
  }
  .bottom-bar {
    display: flex;
    align-items: center;
    background: #1a1a2e;
    border-top: 1px solid #333;
    height: 32px;
  }
</style>
```

This is ~60 lines. Every piece of logic lives elsewhere.

---

## 6. Web Worker Architecture (Designed for v0.2)

### 6.1 Why Not Now

The current kernel is fast enough for v0.1 (<1,000 entities, simple geometry). Worker migration adds complexity (async command dispatch, message serialization) that blocks shipping. Design the seams now, migrate in v0.2.

### 6.2 The Seam: `app.executeCommand()`

The current `executeCommand` is synchronous:

```typescript
executeCommand(command: object) {
  const result = JSON.parse(this.kernel.execute_command(JSON.stringify(command)));
  this.syncView();
  return result;
}
```

In v0.2, it becomes async via **Comlink** (transparent RPC over Worker postMessage):

```typescript
// v0.2 — kernel moves to Worker
import { wrap } from 'comlink';
const kernelWorker = wrap<KernelAPI>(new Worker('./kernel.worker.ts'));

async executeCommand(command: object) {
  const result = await kernelWorker.executeCommand(command);
  this.syncView();  // still on main thread
  return result;
}
```

Because every tool already calls `executeCommand` (not kernel methods directly), this migration touches exactly ONE method. No tool code changes.

### 6.3 SharedArrayBuffer for Geometry Transfer (v0.3+)

For 10k+ entities, JSON serialization of geometry for rendering becomes a bottleneck. The solution is SharedArrayBuffer:

```
Kernel Worker                          Main Thread (Renderer)
┌─────────────────┐                   ┌──────────────────────┐
│ Rust/WASM writes │ ── SAB ────────► │ Three.js reads       │
│ Float32Array     │    (zero-copy)   │ BufferGeometry       │
└─────────────────┘                   └──────────────────────┘
```

Requires COOP/COEP headers (already planned in server infrastructure doc, Layer 7). This is a v0.3+ optimization — design for it, don't build it yet.

---

## 7. Plugin System (Post-v0.1)

### 7.1 Architecture: Figma-Inspired Dual Sandbox

```
┌─────────────────────────────────────────────────┐
│                    NEXUS Host                     │
│  ┌─────────────┐           ┌──────────────────┐ │
│  │ WASM Sandbox │           │  iframe Sandbox  │ │
│  │ (Computation)│◄─────────►│  (Plugin UI)     │ │
│  │              │  postMsg   │                  │ │
│  │ Rust/C/AS    │           │ HTML/CSS/JS      │ │
│  │ via Extism   │           │ Restricted DOM   │ │
│  └─────────────┘           └──────────────────┘ │
│         │                          │              │
│         ▼                          ▼              │
│  Plugin API (Commands only)   Host postMessage   │
│  - executeCommand()            - showUI()        │
│  - queryEntities()             - closeUI()       │
│  - onEvent() subscription      - resize()        │
└─────────────────────────────────────────────────┘
```

Why this model:
- **WASM sandbox** (via Extism): plugins written in any language (Rust, C, AssemblyScript) run geometry computation without access to DOM, network, or filesystem. Bytes-in, bytes-out. Memory-safe.
- **iframe sandbox** with `sandbox="allow-scripts"`: plugin UI runs in an isolated frame. Can only communicate with host via `postMessage`. No access to host DOM or cookies.
- **Command API is the surface**: plugins call `executeCommand()` — the same Command system that GUI, CLI, and AI agents use (Rule 1). No separate plugin API to maintain.

### 7.2 Plugin Manifest

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "permissions": ["command:CreateLine", "command:CreateCircle", "query:entities"],
  "entry": {
    "wasm": "plugin.wasm",
    "ui": "ui/index.html"
  }
}
```

### 7.3 Plugin Host API

```typescript
// What plugins can call (exposed to WASM sandbox)
interface PluginAPI {
  executeCommand(command: object): CommandResult;
  queryEntities(filter?: { layer?: string; type?: string }): Entity[];
  subscribe(eventType: string, callback: (event: CadEvent) => void): Unsubscribe;
  showUI(options?: { width: number; height: number }): void;
  closeUI(): void;
}
```

This is designed but not built for v0.1. The key architectural requirement is that the Command system (which exists now) IS the plugin API surface — no additional work needed when plugins ship.

---

## 8. AI Workspace UX (Sprint 9)

### 8.1 Draft Layer Pattern

AI-generated entities go to a special `ai-draft` layer with a visual treatment that distinguishes them from human-authored geometry:

```
Entity lifecycle:
  AI creates → "proposed" (translucent, dashed outline)
  Human accepts → "accepted" (moves to target layer, normal style)
  Human rejects → "rejected" (removed)
```

Implementation:
- When AI agent calls `executeCommand({ type: 'CreateLine', ... })`, the `actor` in the EventEnvelope is `{ type: 'agent', agent_id, model }`.
- If actor is agent, entity is created on `ai-draft` layer with `proposed` status.
- PropertiesPanel shows accept/reject buttons for proposed entities.
- Accept = `executeCommand({ type: 'SetEntityLayer', entity_id, layer_id: target })`.
- Reject = `executeCommand({ type: 'DeleteEntity', id })`.

### 8.2 Agent Action Log Panel

```
┌──────────────────────────────────────┐
│ Agent Activity                    ▼  │
│──────────────────────────────────────│
│ 🤖 Created 3 lines (horizontal     │
│    alignment, STA 0+00 to 5+00)     │
│    [Accept All] [Reject All]        │
│                                      │
│ 🤖 Added parallel constraints       │
│    between Line-7 and Line-8         │
│    [Accept] [Reject]                 │
│                                      │
│ 🤖 Flagged: gradient at STA 3+20    │
│    exceeds 8% (actual: 8.7%)         │
│    [View] [Dismiss]                  │
└──────────────────────────────────────┘
```

This panel (AgentPanel.svelte) subscribes to events where `actor.type === 'agent'` and groups them into action batches. Each batch has accept/reject controls.

### 8.3 Authorship Metadata

Every entity carries authorship info via the EventEnvelope (Rule 2):
- `actor.type === 'user'` → human-authored
- `actor.type === 'agent'` → AI-authored (with `agent_id` and `model`)
- Visual toggle: "Show authorship" highlights entities by author
- DXF export: authorship goes into entity comment/metadata fields

This is already supported by the EventEnvelope architecture (F2). No kernel changes needed.

---

## 9. Migration Plan

### Phase 1: State + Tools (1 day)

1. Create `lib/stores/AppState.svelte.ts` with all state from `+page.svelte`
2. Create `lib/stores/ToolMachine.svelte.ts`
3. Create `lib/stores/SelectionState.svelte.ts`
4. Create `lib/tools/BaseTool.ts` + tool interface
5. Create `lib/tools/LineTool.ts` (first tool — validate pattern works)
6. Wire into `+page.svelte` via `setContext`
7. Test: Line tool works via GUI click + command-line input

### Phase 2: All Tools (1 day)

8. Port each tool from `handleClick()` if/else to its own class:
   - SelectTool, CircleTool, RectangleTool, ArcTool, PolylineTool
   - MoveTool, CopyTool, RotateTool
   - OffsetTool, TrimTool, MirrorTool, ScaleTool
   - TextTool, DimensionTool (stubs for Sprint 7)
9. Create `lib/tools/registry.ts`
10. Delete `handleClick()` from page
11. Test: all 15 tools work

### Phase 3: Component Extraction (0.5 day)

12. Extract `Toolbar.svelte` (reads `app.tools.activeToolId`, dispatches `app.tools.setTool`)
13. Extract `CanvasViewport.svelte` (owns canvas container + renderer lifecycle)
14. Extract `CommandLine.svelte` (routes input through ToolMachine then registry)
15. Extract `StatusBar.svelte` (reads `app.statusText`, `app.cursorX/Y`)
16. Wire `LayerPanel.svelte` (already exists, just import it)
17. `+page.svelte` becomes ~60-line shell

### Phase 4: Command System Migration (0.5 day)

18. Change all tool implementations to use `app.executeCommand()` instead of calling `kernel.create_*()` directly
19. Verify all 15 tools dispatch through Command JSON
20. Test: create entities, verify EventEnvelope has correct actor

### Phase 5: Verify (0.5 day)

21. All existing features work: draw, edit, modify, constraints, undo/redo, snap, file I/O
22. Run `pnpm test` — all Rust tests pass (kernel unchanged)
23. Manual test: DXF import/export, auto-save, keyboard shortcuts
24. Verify: agent can call `execute_command(json)` and get same result as GUI click

**Total: ~3.5 days**

### What Changes / What Doesn't

| Stays the same | Changes |
|---|---|
| Rust kernel (commands.rs, events.rs, entity.rs, constraints.rs, lib.rs) | `+page.svelte` → thin shell |
| CadRenderer (renderer package) | Tool logic → `lib/tools/*.ts` |
| PropertiesPanel, FileMenu, HelpOverlay (existing components) | State → `lib/stores/AppState.svelte.ts` |
| WASM bindings | Tool dispatch → `ToolMachine.svelte.ts` |
| DXF parser, OPFS storage | handleClick/handleKeydown → tool classes |
| All 33 Rust tests | Command-line routing → `CommandLine.svelte` |

---

## 10. Decision Log

| # | Decision | Chosen | Rejected | Rationale |
|---|---|---|---|---|
| D1 | State management | Svelte 5 runes + class + Context | XState, Zustand, Redux, Svelte stores | Runes are native to Svelte 5. Classes group state + methods. No extra dependency. XState adds 15kb for a pattern achievable with plain classes. Svelte 4 stores are deprecated. |
| D2 | Tool pattern | tldraw StateNode (class per tool, lifecycle methods) | Blender modal operators, FreeCAD integer state, Excalidraw actions | tldraw is already TypeScript, has the right abstraction (multi-step tools with onEnter/onExit), and was designed for exactly this use case. FreeCAD's integer `drawStep` is what we're escaping. |
| D3 | Tool dispatch | All tools call `executeCommand(json)` | Direct kernel method calls | Rule 1 requires every operation to be a Command. Direct calls bypass event sourcing. `executeCommand` is the single seam for Worker migration. |
| D4 | Component split | One file per tool, one file per UI panel | Keep monolith but organize with regions | Files are the merge boundary. If two agents work on different tools, they edit different files. Regions in a monolith still produce merge conflicts. |
| D5 | Worker architecture | Design seam now, migrate in v0.2 | Move kernel to Worker immediately, Don't plan for it | Worker migration is expensive (async everywhere) and not needed for v0.1 (<1k entities). But if we don't design the seam (`executeCommand`), the migration requires touching every tool. |
| D6 | Plugin sandbox | Figma dual-sandbox (WASM + iframe) | VS Code extension host process, WASI components only, No sandbox | Figma model is proven at scale. WASM sandbox provides compute isolation. iframe provides UI isolation. WASI Component Model is promising but browser support requires jco transpile — add as runtime option later. VS Code model uses Node.js processes (no browser equivalent). |
| D7 | AI workspace UX | Draft layer + accept/reject per entity | Full diff view (Cursor-style), Auto-accept all | Entity-level accept/reject maps naturally to CAD (each entity is a discrete object). Full diff views work for text code but not geometry. Auto-accept removes human oversight. |
| D8 | Coordinate parsing | Extracted to shared utility function | Keep inline in each tool | Every multi-step tool needs coordinate input. Duplication across 10 tools is a maintenance burden. Extracted function handles absolute, relative, and polar formats. |
| D9 | Toolbar rendering | Data-driven from tool registry | Hardcoded buttons per tool | Registry-driven rendering means new tools auto-appear in toolbar. Hardcoded buttons require template changes for every new tool. |
| D10 | Snap logic | Stays in ToolMachine.handlePointerMove | Move to each tool | Snapping is universal — every tool benefits. Having it in the dispatcher avoids 15 copies of snap code. |

---

## Appendix A: Tool Implementation Checklist

For each tool being ported, verify:

- [ ] Class extends `BaseTool`
- [ ] `id`, `label`, `shortcut`, `aliases`, `category` defined
- [ ] All kernel calls go through `this.ctx.app.executeCommand()`
- [ ] `onEnter()` resets internal state
- [ ] `onExit()` clears preview
- [ ] `onKeyDown` handles Escape (cancel current operation)
- [ ] `onCommandInput` handles relevant text input (coordinates, distances)
- [ ] `getStatusText()` returns context-appropriate message for each step
- [ ] Tool works via: (a) toolbar click, (b) keyboard shortcut, (c) command-line alias

## Appendix B: Files to Delete After Migration

After Phase 5 verification, the old code paths in `+page.svelte` can be removed:
- `handleClick()` — replaced by ToolMachine dispatch
- `handleCursorMove()` — replaced by ToolMachine.handlePointerMove
- `setTool()` — replaced by ToolMachine.setTool
- `handleCommand()` — replaced by CommandLine.svelte
- All top-level `$state` variables — moved to AppState
- `handleKeydown()` — simplified to global shortcuts only (tools handle their own keys)
