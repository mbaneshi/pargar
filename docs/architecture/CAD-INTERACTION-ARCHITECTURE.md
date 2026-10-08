# NEXUS CAD — Interaction Architecture Analysis

> Generated 2026-04-24. Reflects current state of `dev` branch.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER INPUT: Keyboard │ Toolbar │ Command Line │ Pointer │ MCP      │
└───────────┬─────────────┬──────────┬────────────┬──────────────────┘
            │             │          │            │
            ▼             ▼          ▼            ▼
     ┌──────────────────────────────────────────────────┐
     │  InteractionShell (handleInput)                  │
     │  packages/app/src/lib/shell/InteractionShell.svelte.ts  │
     ├──────────────────────────────────────────────────┤
     │  Step 0a: POINTER_MOVE → resolveSnap() (kernel) │
     │  Step 3:  InputRouter → active tool dispatch     │
     │  Step 5:  KeymapResolver → global shortcuts      │
     │  Step 6:  CommandRegistry.resolve(text)          │
     │  Step 7:  IDLE → selection / window-crossing     │
     └──────────┬───────────────────────────────────────┘
                │
     ┌──────────▼──────────┐     ┌─────────────────────────┐
     │  ToolHandler         │────▶│  AppState.executeCommand │
     │  (state machine)     │     │  → JSON.stringify(cmd)   │
     │  status: 0,1,2...    │     │  → kernel.execute_command()│
     └──────────────────────┘     └──────────┬──────────────┘
                                             │ (WASM boundary)
                                  ┌──────────▼──────────────┐
                                  │  Rust Kernel             │
                                  │  dispatch.rs: match cmd  │
                                  │  → ECS mutation          │
                                  │  → CommandResult (JSON)  │
                                  └──────────┬──────────────┘
                                             │
                                  ┌──────────▼──────────────┐
                                  │  EventBus.emit()        │
                                  │  → syncEntities()       │
                                  │  → renderer.markDirty()  │
                                  └─────────────────────────┘
```

### Key Files

| Component | File | Lines |
|-----------|------|-------|
| Command Registry | `packages/app/src/lib/commands/CommandRegistry.ts` | 21-95 |
| All Commands Registered | `packages/app/src/lib/commands/registerBuiltinCommands.ts` | 1-1279 |
| Interaction Shell | `packages/app/src/lib/shell/InteractionShell.svelte.ts` | 1-1000+ |
| Base Tool Handler | `packages/app/src/lib/shell/BaseToolHandler.ts` | 12-131 |
| Modify Tool Handler | `packages/app/src/lib/shell/ModifyToolHandler.ts` | 10-159 |
| Keyboard Map | `packages/app/src/lib/protocol/default-keymap.ts` | 3-35 |
| Toolbar Layout | `packages/app/src/lib/protocol/toolbar-layout.ts` | 1-83 |
| App State | `packages/app/src/lib/stores/AppState.svelte.ts` | 10-435 |
| Kernel Commands (Rust) | `packages/kernel/src/commands.rs` | 6-350+ |
| Kernel Dispatch (Rust) | `packages/kernel/src/dispatch.rs` | 1-250+ |
| Snap Queries (Rust) | `packages/kernel/src/snap_queries.rs` | 1-651 |
| Snap Geometry (Rust) | `packages/kernel/src/snaps.rs` | 1-514 |
| Coordinate Parser | `packages/app/src/lib/tools/coordinates.ts` | 1-35 |
| Selection Set | `packages/app/src/lib/shell/SelectionSet.svelte.ts` | 1-207 |
| Selection Manager | `packages/renderer/src/SelectionManager.ts` | 1-323 |
| Renderer | `packages/renderer/src/CadRenderer.ts` | 1-1862 |

---

## 2. Tool Registration

Tools are registered via `CommandRegistry.register()` in `registerBuiltinCommands.ts`. Each tool definition:

```typescript
interface CommandDef {
  id: string;                    // e.g. 'draw_line'
  label: string;                 // e.g. 'Line'
  aliases: string[];             // e.g. ['l', 'li', 'line']
  category: 'draw' | 'modify' | 'annotate' | 'view' | 'edit' | 'select';
  execute: (params) => CommandResult | void;   // direct execution
  invoke?: () => ToolHandler;                  // interactive tool session
  schema?: object;                             // MCP JSON Schema
}
```

---

## 3. Command Activation Paths

| Path | Mechanism | Example |
|------|-----------|---------|
| Keyboard shortcut | `KeymapResolver` matches key+modifiers → `commandId` | `Ctrl+Z` → `undo` |
| Single letter (idle) | `commandRegistry.resolve(key)` when no tool active | `L` → `draw_line` |
| Toolbar click | `shell.setTool(id)` → `CommandDef.invoke()` | Click "Line" button |
| Command line | Type alias + Enter → `resolveGlobalCommand(text)` | Type `line` + Enter |
| Programmatic/MCP | `shell.executeCommand(id, params)` | AI agent call |

---

## 4. Complete Command Inventory

### Draw Tools (10)

| Command ID | Aliases | Shortcut | CLI | Toolbar | Preview | Snap |
|-----------|---------|----------|-----|---------|---------|------|
| `draw_line` | l, li, line | L | Yes | Yes | Yes (rubber-band line) | Yes |
| `draw_circle` | c, circle | C | Yes | Yes | Yes (rubber-band circle) | Yes |
| `draw_rectangle` | r, rect, rectangle | R | Yes | Yes | Yes (rubber-band rect) | Yes |
| `draw_arc` | a, arc | A | Yes | Yes | Yes | Yes |
| `draw_polyline` | p, pl, pline, polyline | P | Yes | Yes | Yes | Yes |
| `draw_point` | po, point | -- | Yes | Yes | No (intentional) | Yes |
| `draw_ellipse` | el, ellipse | -- | Yes | Yes | Yes | Yes |
| `draw_spline` | spl, spline | -- | Yes | Yes | Yes | Yes |
| `draw_xline` | xl, xline | -- | Yes | Yes | Yes | Yes |
| `draw_revcloud` | rc, revcloud | -- | Yes | Yes | Yes | Yes |

### Modify Tools (17)

| Command ID | Aliases | Shortcut | CLI | Toolbar | Preview | Snap |
|-----------|---------|----------|-----|---------|---------|------|
| `modify_move` | m, move | M | Yes | Yes | Yes (setPreview 'move') | Yes |
| `modify_copy` | co, copy | -- | Yes | Yes | Yes | Yes |
| `modify_rotate` | ro, rotate | -- | Yes | Yes | Yes | Yes |
| `modify_scale` | sc, scale | -- | Yes | Yes | Yes | Yes |
| `modify_mirror` | mi, mirror | -- | Yes | Yes | Yes | Yes |
| `modify_offset` | o, offset | O | Yes | Yes | **No** (empty `onPointerMove`) | **No** |
| `modify_trim` | tr, trim | -- | Yes | Yes | **No** (empty `onPointerMove`) | **No** |
| `modify_extend` | ex, extend | -- | Yes | Yes | **No** | **No** |
| `modify_fillet` | f, fillet | F | Yes | Yes | Partial | Yes |
| `modify_chamfer` | cha, chamfer | -- | Yes | Yes | Partial | Yes |
| `modify_explode` | x, explode | -- | Yes | Yes | N/A | N/A |
| `modify_join` | j, join | -- | Yes | Yes | N/A | N/A |
| `modify_array` | ar, array | -- | Yes | Yes | Yes | Yes |
| `modify_matchprop` | matchprop, ma | -- | Yes | Yes | N/A | N/A |
| `modify_lengthen` | len, lengthen | -- | Yes | Yes | Partial | Yes |
| `modify_break` | break, br | -- | Yes | Yes | N/A | N/A |
| `modify_delete` | del, erase | Delete | Yes | Yes | N/A | N/A |

### Annotate Tools (5)

| Command ID | Aliases | Preview | Snap |
|-----------|---------|---------|------|
| `annotate_text` | dt, text, dtext | Yes | Yes |
| `annotate_dimension` | dim, dimension | Yes | Yes |
| `annotate_aligneddim` | dal, dimaligned | Yes | Yes |
| `annotate_measuredist` | dist, measuredist | Yes | Yes |
| `annotate_measurearea` | area, measurearea | Yes | Yes |

### Constraints (4)

`constraint_horizontal`, `constraint_vertical`, `constraint_parallel`, `constraint_perpendicular`

### View / Utility (8+)

| Command ID | Aliases | Shortcut |
|-----------|---------|----------|
| `undo` | u | Ctrl+Z |
| `redo` | -- | Ctrl+Shift+Z / Ctrl+Y |
| `zoom_extents` | ze | Home |
| `zoom_in` | zi | + / = |
| `zoom_out` | zo | - |
| `snap_toggle` | osnap | F3 |
| `grid_snap_toggle` | gridsnap | F9 |
| `ortho_toggle` | ortho | F8 |
| `layer_manager` | la, layers | Ctrl+L |
| `select_all` | selectall | Ctrl+A |
| `units` | un, ddunits | -- |

---

## 5. Multi-Step Command State Machine

All interactive tools inherit from `BaseToolHandler` and use a `_status` integer as state.

### Line Tool (`LineHandler.ts`)

```
Status 0: "Specify first point:"
  onCoordinateInput(point) → store first point, status=1

Status 1: "Specify next point or [Close/Undo]:"
  onCoordinateInput(point) → CreateLine(last→point), push point, stay status=1
  onPointerMove(point)     → setPreview('line', last, cursor)  ← RUBBER BAND
  "close" / "c"            → CreateLine(last→first), cancelTool
  "undo" / "u"             → pop last point
  Escape                   → clear all, status=0
  Right-click              → if chainCount>=1: finish; else: cancel
```

### Modify Tools (`ModifyToolHandler`)

```
Status -1: "Select objects:" (verb-noun, if no pre-selection)
  Click       → toggle entity in pendingIds
  Drag        → window/crossing select into pendingIds
  Enter/right → confirmSelection(), status=0

Status 0+: Tool-specific
  Move:   status 0 = base point, status 1 = displacement point
  Rotate: status 0 = base point, status 1 = ref angle, status 2 = new angle
```

### Offset Tool (`OffsetHandler.ts`) — 3-Phase

```
Status 0: "Specify offset distance:"
  Numeric input → store distance, status=1
  "t"           → throughMode=true, status=1

Status 1: "Select object to offset:"
  Click entity  → hitTest, store targetId, status=2

Status 2: "Specify point on side to offset:"
  Click side    → computeOffsetSign(), OffsetEntity command, back to status=1
```

### Trim Tool (`TrimHandler.ts`) — 2-Phase

```
Status 0: "Select cutting edge:"
  Click entity → hitTest, store boundaryId, status=1

Status 1: "Select entity to trim:"
  Click entity → TrimEntity command (stay status=1 for more trims)
  Escape       → status=0
```

---

## 6. Preview System

### Architecture

- Rendered via Three.js WebGL in the main scene
- Material: `THREE.LineDashedMaterial` — yellow (`0xffff00`), dashed
- Z-position: 0.3 (above entities at 0, below grips at 1.5)
- Updates on every `POINTER_MOVE` event (tied to `requestAnimationFrame`)
- Dirty-flag optimization prevents rendering unchanged frames

### Two Preview APIs in `CadRenderer.ts`

**Simple geometric preview — `setPreview(type, from, to)`:**
- Types: `'line'`, `'circle'`, `'rectangle'`, `'move'`
- Used by: LineHandler, CircleHandler, RectHandler, MoveHandler

**Complex geometry preview — `setPreviewGeometry(geometry)`:**
- Types: `{ Line: {...} }`, `{ Circle: {...} }`, `{ Arc: {...} }`, `{ Polyline: {...} }`
- Used by: GripEditHandler, RotateHandler, ScaleHandler, MirrorHandler

### Preview receives snapped coordinates

`InteractionShell` resolves snap before dispatching to tools. The `point` argument in `onPointerMove(status, point)` is the snapped cursor position.

---

## 7. Snap System

### 8 Snap Types (Rust kernel — `snap_queries.rs`)

| Type | Description | Symbol |
|------|-------------|--------|
| `endpoint` | Line start/end, polyline vertices | Yellow square |
| `midpoint` | Segment midpoints | Yellow triangle |
| `center` | Circle/arc/ellipse centers | Yellow circle |
| `intersection` | Line-line, line-circle crossings | Yellow X |
| `quadrant` | Cardinal points on circles/arcs | Yellow diamond |
| `nearest` | Closest point on curve | Green square |
| `perpendicular` | Perpendicular foot (requires "from" point) | -- |
| `grid` | Grid snap fallback | No symbol |

### Detection Flow

```
POINTER_MOVE
  → InteractionShell.resolveSnap(worldX, worldY)
    → kernel.find_all_snaps(cursor, from, threshold, gridSize, enabledTypes)
      → Rust: spatial index query → narrow candidates → check each type
    → result: {x, y, type} or null
    → renderer.setSnapIndicator(snap) — draws symbol + label
    → app.snapX/snapY/hasSnap updated
    → OTRACK (object snap tracking, UI-side)
    → POLAR tracking (UI-side)
```

### Snap Toggles

| Key | Toggle |
|-----|--------|
| F3 | All object snaps |
| F9 | Grid snap |
| F10 | Polar tracking |
| F11 | Object snap tracking (OTRACK) |

### Consistency

Snap resolution happens in `InteractionShell` at Step 0a, before tool dispatch. All tools receive already-snapped coordinates. Tools cannot opt out of snap.

---

## 8. Selection System

### Selection Methods

| Method | Gesture | Behavior |
|--------|---------|----------|
| Single click | Click on entity (idle) | Replace selection |
| Shift+click | Shift + click | Toggle (add/remove) |
| Window select | Drag left-to-right | Entities fully inside |
| Crossing select | Drag right-to-left | Entities touching or inside |
| Ctrl+A | Keyboard | Select all |
| Modify selection phase | Click/drag during status=-1 | Build pending set, Enter to confirm |

### State Storage

- `SelectionSet` (`SelectionSet.svelte.ts:18`): `Set<string>` — authoritative source
- `SelectionManager` (`SelectionManager.ts`): renderer mirror — highlight + grips
- Synced via `SelectionSet.syncToRenderer()`

### Visual Feedback

| State | Color | Z-position |
|-------|-------|------------|
| Selected | Cyan `0x00bfff` + grip handles | 0.1 (highlight), 0.2 (grips) |
| Hovered | Light blue `0x4488ff` | Same as entity |
| Window select box | Light blue fill `#3399ff` | Overlay |
| Crossing select box | Light green fill `#33ff66` | Overlay |

Hover is separate from selection. Hover only shows when entity is NOT selected.

### Missing vs AutoCAD

- Fence select (polyline crossing)
- Lasso select (freehand area)
- Previous selection recall (`P` subcommand)
- Select by properties/layer filter
- Remove from selection (`R` subcommand)

---

## 9. Input Handling

### Coordinate Parsing (`coordinates.ts`)

| Format | Example | Result |
|--------|---------|--------|
| Absolute | `10,20` | `{x: 10, y: 20}` |
| Relative | `@5,10` | `lastPoint + {x: 5, y: 10}` |
| Polar | `@10<45` | `lastPoint + 10 units at 45 degrees` |

### Keyboard Shortcuts (`default-keymap.ts`)

| Key | Command |
|-----|---------|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Home | Zoom extents |
| F2 / F12 | Toggle dynamic input |
| F3 | Toggle snap |
| F7 | Toggle grid |
| F8 | Toggle ortho |
| F9 | Toggle grid snap |
| F10 | Toggle polar |
| F11 | Toggle OTRACK |
| Delete / Backspace | Delete selected |
| Escape | Cancel |
| + / = | Zoom in |
| - | Zoom out |

### Command Line (`CommandLine.svelte`)

- Type tool alias + Enter: starts tool
- During tool, type coordinate: routed to `onCoordinateInput`
- During tool, type keyword: routed to `onCommandInput`
- Tab: autocomplete commands
- Arrow up/down: history navigation

### Missing vs AutoCAD

- Direct distance entry (type number while pointing = set distance along cursor direction)
- Tracking point filters (`.x`, `.y`, `.xy`)
- Calculator expressions in coordinate input
- Object snap overrides (temporary snap type for one pick)

---

## 10. UI-Kernel Bridge

### Command Flow

```
TypeScript:  ctx.executeCommand({ type: 'CreateLine', x1, y1, x2, y2, layer_id })
    → AppState.executeCommand()
    → JSON.stringify(cmd)
    → kernel.execute_command(json_string)       // WASM call

Rust:        serde_json::from_str::<Command>(json)
    → dispatch::execute(kernel, command)
    → ECS mutation + spatial index rebuild
    → CommandResult { success, created_ids, error, warnings }
    → serde_json::to_string(&result)

TypeScript:  JSON.parse(resultJson)
    → EventBus.emit('command.executed')
    → syncEntities() → renderer.syncEntities(entitiesJson)
    → Canvas redraws
```

### Preview is UI-side, not kernel

Preview geometry (rubber-band lines, circles, rectangles) is computed entirely in TypeScript tool handlers and rendered by `CadRenderer.setPreview()`. The kernel is only called for final commit. This is correct — preview should not mutate state.

### Potential Desync: Offset Side Computation

`OffsetHandler.ts:174-197` — `computeOffsetSign()` duplicates geometry knowledge (line normal, circle inside/outside) in TypeScript. The kernel's offset formula must use the same normal convention or results diverge. Polylines fall back to `+1` (always one side).

---

## 11. Tool Comparison Matrix

| Aspect | Line | Rectangle | Offset | Move | Trim |
|--------|------|-----------|--------|------|------|
| Activation | L / toolbar / CLI | R / toolbar / CLI | O / toolbar / CLI | M / toolbar / CLI | toolbar / CLI |
| Steps | 1 then N (chain) | 2 (corners) | 3 (dist, entity, side) | 2-3 (select, base, disp) | 2 (boundary, entity) |
| Preview | Yellow dashed line | Yellow dashed rect | **None** | Yellow dashed entities | **None** |
| Snap in preview | Yes | Yes | **No** (empty onPointerMove) | Yes | **No** (empty onPointerMove) |
| ESC | Clears chain, stays in tool | Resets to corner 1 | Resets to distance prompt | Cancels | Resets to boundary |
| Right-click | Finish chain + exit | -- | -- | -- | -- |
| Undo in-tool | Yes ("u" removes segment) | No | Yes (undoes last offset) | No | No |
| Close | Yes (3+ segments) | N/A | N/A | N/A | N/A |

### Inconsistencies

1. **Preview gap**: Offset and Trim have empty `onPointerMove` — no visual feedback before click
2. **Snap gap**: Snap is resolved but never used for preview in Offset/Trim (though snap works for the click itself)
3. **Cancel behavior**: Line ESC stays in tool (status 0), Offset ESC goes to distance prompt, Move inherits from ModifyToolHandler — not consistent
4. **Right-click**: Line uses it to finish chain. Move ignores it. Offset resets target at status 2. No consistency
5. **Command chaining**: Only Line supports continuous chaining (stay in status 1). Offset loops (1-2-1). Rectangle exits after creation

---

## 12. UX Risk Assessment

### High Impact

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 1 | Offset has no preview | `OffsetHandler.ts:147` | `onPointerMove(): void {}`. User cannot see offset result before clicking side. AutoCAD previews offset curve dynamically. |
| 2 | Trim/Extend have no preview | `TrimHandler.ts:45` | Empty `onPointerMove`. User clicks blindly. AutoCAD highlights segment that will be removed before click. |
| 3 | No entity highlight during modify tool selection | `ModifyToolHandler.ts` | When "Select object to offset", hovering doesn't highlight which entity will be picked. AutoCAD uses thick highlight. |
| 4 | Offset side computation duplicated in TS | `OffsetHandler.ts:174-197` | `computeOffsetSign()` reimplements line normal / circle inside-outside. Polylines fall back to `+1` (always same side). Will produce wrong offset direction for polylines. |

### Medium Impact

| # | Issue | Detail |
|---|-------|--------|
| 5 | No direct distance entry | Can't start direction with mouse then type distance (e.g., move mouse right, type `10`, Enter = 10 units right) |
| 6 | Trim requires explicit boundary | AutoCAD default uses all entities as boundaries (`TRIMMODE=1`). NEXUS requires picking cutting edge first. More clicks. |
| 7 | No fence/lasso selection | Only point-click and window/crossing rectangle. Fence select is heavily used for trim/extend. |
| 8 | Inconsistent right-click behavior | Line: finish+exit. Move: nothing. Offset: reset target. Breaks muscle memory. |

### Low Impact

| # | Issue | Detail |
|---|-------|--------|
| 9 | ESC during Line requires two presses to exit | ESC resets to status 0 (tool stays active), second ESC cancels. Matches AutoCAD behavior. |
| 10 | Grip-stretch preview for polyline segments | May not show mid-drag preview for all control points. |

---

## 13. AutoCAD User Mismatches (Top 10)

1. **Offset** — no dynamic preview of offset curve while moving cursor to pick side
2. **Trim** — no highlight of segment to remove before click; requires explicit boundary instead of "all boundaries" default
3. **Extend** — same issues as Trim: no preview, explicit boundary required
4. **Right-click = Enter** — in AutoCAD, right-click universally means "confirm/Enter"; here it's inconsistent per tool
5. **No direct distance entry** — can't type a number while pointing to set distance along cursor direction
6. **No fence select** — missing polyline-crossing selection mode, critical for trim/extend workflows
7. **No previous selection (`P`)** — can't recall last selection set when modify tool asks "Select objects:"
8. **No tracking point override** — can't type `.x` or `.y` to filter coordinates from a tracking point
9. **Implied windowing differs** — in AutoCAD, clicking empty space during "Select objects:" starts window/crossing; modify tool selection phase supports it but gesture differs
10. **Offset polyline fallback** — always offsets to one side for polylines; `computeOffsetSign()` returns `+1` for all non-line/non-circle geometry

---

## 14. Missing Capabilities Summary

### Preview

- Offset: no preview of offset curve
- Trim/Extend: no highlight of segment to remove/extend
- Fillet/Chamfer: partial preview (no arc/chamfer line shown before commit)

### Snapping

- Tangent snap: not implemented
- Apparent intersection: not implemented (3D projected intersections)
- Extension snap: not implemented (snap to hypothetical extension of line/arc)
- Parallel snap: not implemented

### Selection

- Fence select (polyline crossing)
- Lasso select (freehand area)
- Previous selection recall (`P`)
- Select by properties/layer filter
- Remove from selection without Shift (`R` subcommand)

### Command System

- Direct distance entry (type number while pointing)
- Transparent commands mid-operation (partially supported via `transparent: true` flag)
- Command macros / scripting
- LISP/script execution

### Input

- Dynamic input display near cursor (partially implemented — toggle exists, rendering needs verification)
- Tracking point filters (`.x`, `.y`, `.xy`)
- Calculator expressions in coordinate input
- Object snap overrides (temporary snap type for one pick only)
