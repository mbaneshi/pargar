# 35 — Implementation Plan: Two Pipelines, Six Patterns Each

> The entire NEXUS interaction + platform architecture reduces to two composing pipelines.
> This document is the implementation plan. Each phase builds one layer of the pipeline.

---

## The Two Pipelines

### Pipeline 1: Input Flow (how every input reaches its handler)

```
Input → Mediator → Chain of Responsibility → State → Command → Observer
        (Shell)    (tool→transparent→global)  (status)  (execute)  (notify)
```

### Pipeline 2: Domain Registration (how domains plug into the platform)

```
Domain → Abstract Factory → Registry → Proxy → Command → Observer
         (workbench)        (register)  (lazy)  (same)    (same)
```

The last two stages (Command + Observer) are shared. Everything flows into commands. Commands produce observable state changes.

---

## Implementation Phases

### Phase 1: The Mediator — `InteractionShell` (2 days)

**What:** One class that replaces `+page.svelte` dispatch mess, `ToolMachine.svelte.ts`, and `CommandLine.svelte` direct dispatch.

**Files to create:**
```
packages/app/src/lib/shell/InteractionShell.ts    — the mediator
packages/app/src/lib/shell/InputEvent.ts          — unified event type
packages/app/src/lib/shell/SelectionSet.ts        — authoritative selection state
packages/app/src/lib/shell/types.ts               — shared types (Vec2, MouseHints, HandleResult)
```

**What it does:**
- Owns the mode: `IDLE | TOOL_ACTIVE | TRANSPARENT | CONTEXT_MENU | DIALOG`
- Owns the selection: one `SelectionSet`, everything reads from it
- Exposes reactive state: `prompt`, `mouseHints`, `activeToolId`, `availableCommands`
- Has ONE method: `handleInput(event: InputEvent): void`
- All components (viewport, command line, toolbar) call this ONE method

**Wire to existing UI:**
- `+page.svelte`: replace `handleKeydown()`, `handleCommand()`, `handleContextMenu()` with `shell.handleInput()`
- `CommandLine.svelte`: on submit → `shell.handleInput({ type: 'COMMAND_TEXT', text })`
- `CanvasViewport.svelte`: on pointer → `shell.handleInput({ type: 'POINTER_DOWN', ... })`

**Test:** Type `L`, click two points, type `C` → line closes (not circle). If this works, the mediator is correct.

**Bugs fixed:** #5 (C→Circle), #12 (R→Redo during array), #13 (Escape doesn't reset)

---

### Phase 2: Chain of Responsibility — Dispatch Priority (1 day)

**What:** Inside `handleInput()`, implement the priority chain.

**The chain (in order):**
```typescript
handleInput(event: InputEvent): void {
  // 1. Dialog active? → feed to dialog
  if (this.mode === 'DIALOG') { this.dialog.handleInput(event); return; }
  
  // 2. Context menu? → feed to menu
  if (this.mode === 'CONTEXT_MENU') { this.contextMenu.handleInput(event); return; }
  
  // 3. Always-pass-through events (zoom, pan)
  if (this.isPassThrough(event)) { this.handlePassThrough(event); return; }
  
  // 4. Tool active? → tool gets first shot
  if (this.mode === 'TOOL_ACTIVE' && this.activeSession) {
    // 4a. Is it a coordinate? → feed to tool
    if (event.type === 'COORDINATE') {
      this.activeSession.onCoordinateInput(this.activeSession.status, event.point);
      return;
    }
    // 4b. Is it text? → check tool sub-commands first
    if (event.type === 'COMMAND_TEXT') {
      const coord = parseCoordinate(event.text, this.activeSession.getLastPoint());
      if (coord) { this.activeSession.onCoordinateInput(this.activeSession.status, coord); return; }
      if (this.activeSession.onCommandInput(this.activeSession.status, event.text)) return;
      // falls through to global dispatch
    }
    // 4c. Pointer events → tool handles
    if (event.type === 'POINTER_DOWN' && event.button === 'left') {
      this.activeSession.onCoordinateInput(this.activeSession.status, event.point);
      return;
    }
    if (event.type === 'POINTER_DOWN' && event.button === 'right') {
      this.activeSession.onRightClick(this.activeSession.status);
      return;
    }
    if (event.type === 'POINTER_MOVE') {
      this.activeSession.onPointerMove(this.activeSession.status, event.point, event.worldX, event.worldY);
      return;
    }
  }
  
  // 5. Escape → cancel tool or deselect
  if (event.type === 'KEY_DOWN' && event.key === 'Escape') {
    if (this.mode === 'TOOL_ACTIVE') { this.cancelCurrentTool(); return; }
    if (this.selection.count > 0) { this.selection.clear(); return; }
    return;
  }
  
  // 6. Global command resolution
  if (event.type === 'COMMAND_TEXT' || event.type === 'KEY_DOWN') {
    this.resolveGlobalCommand(event);
    return;
  }
  
  // 7. IDLE click → selection
  if (this.mode === 'IDLE' && event.type === 'POINTER_DOWN') {
    this.handleIdleClick(event);
    return;
  }
}
```

**Test:** During line tool, type `close` → tool closes. Type `circle` → starts circle (tool didn't claim it, falls through to global). Zoom wheel during drawing → zoom works, tool stays active.

**Bugs fixed:** All sub-command interception bugs. Zoom during drawing.

---

### Phase 3: State — `ToolHandler` interface + migrate 5 tools (3 days)

**What:** Define the `ToolHandler` interface. Migrate 5 core tools as proof.

**File to create:**
```
packages/app/src/lib/shell/ToolHandler.ts         — interface
packages/app/src/lib/shell/BaseToolHandler.ts      — abstract base with defaults
packages/app/src/lib/shell/tools/LineHandler.ts    — LINE
packages/app/src/lib/shell/tools/CircleHandler.ts  — CIRCLE
packages/app/src/lib/shell/tools/RectHandler.ts    — RECTANGLE
packages/app/src/lib/shell/tools/SelectHandler.ts  — built into IDLE, but extract logic
packages/app/src/lib/shell/tools/MoveHandler.ts    — MOVE (edit tool proof)
```

**The interface:**
```typescript
interface ToolHandler {
  readonly id: string;
  readonly status: number;
  
  activate(): void;
  deactivate(): void;
  suspend(): void;
  resume(): void;
  
  onCoordinateInput(status: number, point: Vec2): void;
  onCommandInput(status: number, command: string): boolean;
  onKeyDown(status: number, key: string, event: KeyboardEvent): HandleResult;
  onPointerMove(status: number, point: Vec2, worldX: number, worldY: number): void;
  onRightClick(status: number): void;
  
  getAvailableCommands(): string[];
  getPrompt(): string;
  getMouseHints(): MouseHints;
  getLastPoint(): Vec2 | null;
  getPreviewGeometry?(): PreviewEntity[];
}
```

**Migration per tool:** Read old `BaseTool` subclass → rewrite as `ToolHandler` implementation → register in `CommandRegistry` → old tool stays (backward compat) until all are migrated.

**Test:** Draw line with `L`, close with `C`. Draw circle with `C` (when no tool active). Move entities with `M`. All through the new shell.

**Bugs fixed:** #2 (selection — `SelectionSet` is authoritative), #6 (defaults — shell sets initial toggle state), #9 (Ctrl+A — handled in IDLE), #10 (Del — reads from `SelectionSet`)

---

### Phase 4: Command — `execute` vs `invoke` split (1 day)

**What:** Formalize the `CommandDef` with both paths.

**Update:**
```
packages/app/src/lib/shell/CommandDef.ts           — updated interface
packages/app/src/lib/shell/CommandRegistry.ts      — updated registry
```

**The interface:**
```typescript
interface CommandDef {
  id: string;
  label: string;
  aliases: string[];
  shortcut?: string;
  category: string;
  
  // Non-interactive (AI agents, scripts, command line with full params)
  execute(params: Record<string, unknown>): CommandResult;
  
  // Interactive (toolbar click, shortcut key — starts a ToolHandler)
  invoke?(): ToolHandler;
  
  // Can this command run right now?
  isActive?(): boolean;
  
  // MCP tool schema (for AI agent discovery)
  schema?: object;
  
  // Is this a transparent command (zoom, pan)?
  transparent?: boolean;
}
```

**Key rule:** `execute()` calls the kernel. `invoke()` returns a `ToolHandler` that collects input then calls `execute()` internally. Same result, two paths.

**Test:** AI agent calls `execute({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0 })` → line created. Human clicks Line button → `invoke()` → `LineHandler` → collects points → calls same `execute()`. Identical geometry.

**Bugs fixed:** Rule 1 fully satisfied. AI agents and humans produce identical results.

---

### Phase 5: Observer — Reactive state flow (1 day)

**What:** Wire the shell's reactive state to all UI components.

**Connections:**
```
shell.prompt          → CommandLine.svelte (shows prompt text)
shell.mouseHints      → StatusBar.svelte (shows LMB/RMB hints)
shell.activeToolId    → Toolbar.svelte (highlights active button)
shell.activeToolId    → StatusBar.svelte (shows "Tool: LINE")
shell.selection       → PropertiesPanel (shows selected entity properties)
shell.selection       → Renderer (highlights selected, shows grips)
shell.availableCommands → CommandLine.svelte (autocomplete filtered to context)
```

All using Svelte 5 `$derived` / `$effect` — no manual pub/sub needed. The shell exposes `$state` runes, components derive from them.

**Test:** Activate line tool → prompt changes, hints change, toolbar highlights, status bar updates. All from one state change in the shell.

**Bugs fixed:** #3 (layer visibility — observer triggers renderer update), #11 (properties read-only — selection state flows to editable panel)

---

### Phase 6: Transparent commands — predecessor pattern (1 day)

**What:** Implement tool stacking for zoom/pan during drawing.

**In InteractionShell:**
```typescript
private suspendedSession: ToolHandler | null = null;

startTransparentCommand(cmd: CommandDef): void {
  if (this.activeSession) {
    this.activeSession.suspend();
    this.suspendedSession = this.activeSession;
  }
  this.mode = 'TRANSPARENT';
  // execute the transparent command (zoom, pan)
  cmd.execute({});
  // when done:
  this.resumeFromTransparent();
}

resumeFromTransparent(): void {
  if (this.suspendedSession) {
    this.activeSession = this.suspendedSession;
    this.suspendedSession = null;
    this.activeSession.resume();
    this.mode = 'TOOL_ACTIVE';
  } else {
    this.mode = 'IDLE';
  }
}
```

**Mark transparent commands:** Zoom, Pan, Snap Override — all get `transparent: true` in their `CommandDef`.

**Test:** Start line, draw two points, scroll to zoom, draw third point → line tool still active with all points preserved.

---

### Phase 7: Selection gates + context menus (1 day)

**What:** Tools can restrict selection. Context menus adapt to state.

**Selection gate:**
```typescript
interface SelectionGate {
  canSelect(entityId: string, entityType: string): boolean;
  reason: string;  // "Select a line or arc"
}

// In InteractionShell:
installGate(gate: SelectionGate): void;
removeGate(): void;
```

Tools install gates in `activate()`, remove in `deactivate()`.

**Context menu:**
```typescript
getContextMenuItems(): ContextMenuItem[] {
  if (this.mode === 'TOOL_ACTIVE') {
    return this.activeSession.getAvailableCommands().map(cmd => ({ label: cmd, action: cmd }));
  }
  if (this.selection.count > 0) {
    return [Move, Copy, Rotate, Mirror, Scale, Delete, Properties];
  }
  return [RepeatLast, Undo, Redo, Paste, ZoomExtents, SelectAll];
}
```

**Test:** During Trim tool, only lines/arcs near cutting edge are selectable. Right-click during polyline shows Close/Undo.

**Bugs fixed:** #4 (layer lock — gate prevents editing locked entities)

---

### Phase 8: Migrate remaining tools (2-3 days)

**What:** Migrate all 25+ tools from `BaseTool` to `ToolHandler`. Mechanical work.

**Order:** Draw tools first (most used), then edit tools, then modify tools, then annotate tools.

**Per tool:** Read old class → write new handler → register → test → delete old class.

**When all migrated:** Delete `BaseTool.ts`, `ToolMachine.svelte.ts`, old `toolRegistry`. Clean cut.

---

### Phase 9: Domain registration — `DomainManifest` (2 days, post v0.1)

**What:** Extract current 2D CAD code into a `cad2d` domain manifest. This is Pipeline 2.

**File to create:**
```
packages/app/src/lib/platform/DomainRegistry.ts
packages/app/src/lib/platform/WorkbenchManager.ts
packages/app/src/lib/platform/types.ts
domains/cad2d/manifest.ts
```

**The cad2d manifest:**
```typescript
export const cad2dDomain: DomainManifest = {
  id: 'cad2d',
  name: '2D CAD',
  commands: [ /* all 54 current commands */ ],
  tools: [ /* all tool handlers */ ],
  workbench: {
    toolbars: [
      { id: 'draw', label: 'DRAW', items: ['line', 'circle', 'rect', 'arc', ...] },
      { id: 'modify', label: 'MODIFY', items: ['trim', 'offset', 'fillet', ...] },
    ],
    panels: [ /* properties, layers */ ],
    shortcuts: { L: 'line', C: 'circle', R: 'rectangle', ... },
  }
};
```

**Test:** App starts → loads cad2d domain → registers commands/tools → workbench activates → toolbar shows. Same as today, but through the registry.

**This is when adding BIM becomes:** Write `domains/bim/manifest.ts`, register BIM commands/tools, done. Zero core changes.

---

## Timeline

```
Phase 1: InteractionShell          — 2 days
Phase 2: Chain of Responsibility   — 1 day
Phase 3: ToolHandler + 5 tools     — 3 days
Phase 4: execute/invoke split      — 1 day
Phase 5: Observer wiring           — 1 day
Phase 6: Transparent commands      — 1 day
Phase 7: Selection gates + context — 1 day
Phase 8: Migrate remaining tools   — 2-3 days
                                     --------
                            Total:   12-13 days

Phase 9: Domain registration       — 2 days (post v0.1)
```

Phases 1-7 can be done by **2-3 agents in parallel** where there's no file overlap:
- **Agent A:** Phases 1+2 (shell + dispatch) — 3 days
- **Agent B:** Phase 3 (tool handlers) — 3 days, starts after Phase 1 delivers the interface
- **Agent C:** Phases 4+5 (command split + observer wiring) — 2 days, starts after Phase 2

Phases 6+7+8 are sequential, after 1-5 merge.

---

## How Each Bug Is Resolved

| Bug | Fixed in Phase | How |
|-----|---------------|-----|
| #1 (OPFS behind welcome) | Not in this plan — separate 5-min fix |
| #2 (Drag select broken) | Phase 3 — `SelectionSet` is authoritative |
| #3 (Layer visibility) | Phase 5 — observer wires layer state to renderer |
| #4 (Layer lock) | Phase 7 — selection gate prevents editing locked layers |
| #5 (C→Circle) | Phase 2 — chain checks tool sub-commands first |
| #6 (Toggles default OFF) | Phase 1 — shell initializes with correct defaults |
| #7 (Circle preview) | Phase 3 — CircleHandler provides proper preview |
| #8 (Arc preview) | Phase 3 — ArcHandler provides proper preview |
| #9 (Ctrl+A) | Phase 1 — IDLE handles Ctrl+A |
| #10 (Del after drag) | Phase 3 — Del reads from authoritative `SelectionSet` |
| #11 (Properties read-only) | Phase 5 — observer + editable bindings |
| #12 (Extend broken) | Phase 3 — ExtendHandler rewritten properly |
| #13 (Escape reset) | Phase 1 — shell resets all state on Escape |

---

## What This Doesn't Cover (deferred)

- **Responsiveness/mobile** — v1.0
- **Undo model redesign** (true event sourcing) — post v0.1
- **Multiple renderer composition** — v0.2 when 3D arrives
- **Agent panel UI** — v0.2
- **Full domain extraction** (Phase 9) — post v0.1, after user testing validates the interaction
