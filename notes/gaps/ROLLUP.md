# Cross-Command Rollup — OFFSET + TRIM + FILLET

**Generated:** 2026-04-17
**Commands audited:** 3 of ~600

---

## Aggregate numbers

| Command | Spec surface | NEXUS coverage | Gaps | Critical | High | Medium |
|---|---|---|---|---|---|---|
| OFFSET | 18 dimensions | ~30% | 18 | 7 | 3 | 1 |
| TRIM | 12 dimensions | ~15% | 12 | 3 | 4 | 3 |
| FILLET | 15 dimensions | ~35% | 15 | 3 | 3 | 5 |
| **Total** | **45** | **~25%** | **45** | **13** | **10** | **9** |

---

## Patterns that repeat across all three commands

These aren't per-command bugs. They're **platform-level absences** that will recur across every command we audit.

### 1. Sysvar subsystem (CRITICAL — blocks ~12 gaps in 3 commands alone)

| Sysvar | Command | Purpose |
|---|---|---|
| OFFSETDIST | OFFSET | Distance recall; negative = Through mode |
| OFFSETERASE | OFFSET | Erase source after offset |
| OFFSETLAYER | OFFSET | Current vs Source layer placement |
| OFFSETGAPTYPE | OFFSET | Polyline corner gap fill |
| FILLETRAD | FILLET | Radius recall across invocations |
| TRIMMODE | FILLET | Trim vs No-trim mode |
| TRIMEXTENDMODE | TRIM | Quick vs Standard mode |
| EDGEMODE | TRIM | Extend vs No-extend implied edges |
| PROJMODE | TRIM | None / UCS-XY / View projection |

**Impact:** Without sysvars, no command can recall its last setting. This breaks the `O Enter`, `F Enter`, `TR Enter` muscle memory — the user expects the command to remember the last distance / radius / mode. Every command audited trips on this.

**Estimated scope:** ~50-100 sysvars total for 2D AutoCAD parity (OSMODE, ORTHOMODE, FILLETRAD, CHAMFERA/B, OFFSETDIST, PLINEWID, LTSCALE, DIMSCALE, TEXTSIZE, etc.). Suggest a persistent key-value store (per-drawing for drawing sysvars, per-session for registry sysvars) with typed get/set API.

### 2. Esc-cancels-command (HIGH — same bug in all 3 handlers)

Every handler converts Esc to `setStatus(0)` — resetting within the command instead of exiting. AutoCAD: one Esc always exits the active command.

**Fix:** One-line change per handler: `setStatus(0)` → `this.ctx.cancelCurrentTool()`. Alternatively, change `BaseToolHandler.onKeyDown` default behavior to cancel on Esc, and only override in handlers that need Esc-to-step-back.

**Decision:** Should BaseToolHandler's default Esc behavior be "exit tool" or "step back"? AutoCAD is "exit tool." This is an architectural decision that should be made once for all handlers.

### 3. Options parser / keyword dispatcher (HIGH — blocks ~15 gaps)

All three commands have AutoCAD-style option keywords in `[brackets]` that NEXUS doesn't parse:
- OFFSET: `[Through/Erase/Layer]`
- TRIM: `[Fence/Crossing/Project/Edge/eRase/Undo]`
- FILLET: `[Undo/Polyline/Radius/Trim/Multiple]`

NEXUS has no generic mechanism for "the user typed a keyword at the prompt." Each handler rolls its own `onCommandInput` that only parses numbers. We need a **keyword dispatch system** in the tool handler base layer:

```
prompt: "Select object or [Fence/Crossing/Undo]:"
→ user types "F" or "Fence"
→ handler.onKeyword("Fence") called
→ handler transitions to Fence sub-flow
```

This is plumbing — not per-command logic. Build it once, wire it into BaseToolHandler, and every command that adds options benefits.

### 4. Within-command Undo (MEDIUM — same pattern in all 3)

AutoCAD allows `U` within OFFSET, TRIM, FILLET (and most other modify commands) to undo the last sub-operation without exiting. NEXUS has no within-command undo.

**Pattern:** Each handler needs a `recentActions: string[]` stack. On `U`, pop the last one and call `app.undo()`. On command exit, clear the stack. The stack prevents undo from leaking past the command boundary.

### 5. Right-click context menu (MEDIUM — all 3)

`BaseToolHandler.onRightClick` backs up one status step instead of showing a context menu. AutoCAD shows a menu with Enter/Cancel/Recent Input/Pan/Zoom.

**Fix:** Replace the step-back with a context menu emitter. The menu content is the same across most commands (differs slightly for commands with specific context actions).

### 6. Batch-pick infrastructure: Fence + Crossing selection (HIGH — blocks TRIM + many others)

TRIM's Fence and Crossing options need a way to select multiple entities by geometry (polyline fence or rectangular crossing). This infrastructure is shared with: SELECT, ERASE, COPY, MOVE, ROTATE, SCALE, MIRROR, ARRAY, STRETCH, and probably 20+ other commands. It's a platform capability.

### 7. Shift-modifier as command modifier (MEDIUM — TRIM + FILLET)

Both TRIM and FILLET use Shift as an in-command modifier (Shift-extends in TRIM, Shift-forces-R=0 in FILLET). NEXUS has no mechanism for Shift-modified picks. This is a small change to the pick event: pass `{ shiftKey: boolean }` into `onCoordinateInput` so handlers can react.

---

## Platform-level infrastructure ranked by impact

| Infrastructure | Gaps unblocked | Commands affected | Effort |
|---|---|---|---|
| **Sysvar subsystem** | ~12 in 3 commands, ~50+ total | ALL | 3–5 days |
| **Keyword dispatch in BaseToolHandler** | ~15 in 3 commands | ALL option-rich commands | 2–3 days |
| **Esc-exits-command default** | 3 (one per command audited) | ALL handlers | 1 hour |
| **Batch-pick (Fence/Crossing)** | 2 in TRIM, ~20+ total | SELECT, ERASE, TRIM, COPY, MOVE, etc. | 3–5 days |
| **Within-command Undo pattern** | 3 in 3 commands | ALL modify commands | 1–2 days |
| **Right-click context menu emitter** | 3 in 3 commands | ALL commands | 1–2 days |
| **Shift-modifier on picks** | 2 (TRIM, FILLET) | TRIM, FILLET, CHAMFER, EXTEND | 2–4 hours |

**Total estimated infrastructure:** ~2–3 weeks of focused work.
**Gaps resolved:** ~40 across the audited 3 commands, and **hundreds** across the full command set — because the infrastructure is shared.

---

## What these three commands tell us about the full 600

The three commands we audited are diverse:
- OFFSET: distance-driven, state-recall-heavy, side-pick
- TRIM: selection-heavy, multi-mode, bidirectional with EXTEND
- FILLET: option-heavy, geometry-math-dependent, power-user-trick-heavy

Yet they share the **same 7 platform-level gaps.** This strongly suggests that auditing additional commands will produce diminishing-returns on new gap categories — but will produce increasing urgency to build the shared infrastructure. The right move is NOT to audit all 600 commands individually. It's:

1. **Build the 7 platform pieces** (sysvar, keyword dispatch, esc, batch-pick, cmd-undo, right-click, shift-modifier).
2. **Audit 7 more commands** from diverse categories to confirm no new platform gaps emerge:
   - Draw: LINE (prompt loop, polar/relative input, Close/Undo), CIRCLE (multiple methods: 3P, 2P, TTR)
   - Modify: COPY (multi-copy, base-point, repeat), MOVE (similar), ARRAY (rectangular/polar/path)
   - Annotate: DIMENSION (dimstyle recall, sub-types), HATCH (pattern selection, boundary detection)
3. **Then shift to building, not auditing.** The gap reports become acceptance criteria. Each platform piece ships when its gap-report rows turn green.

---

## Decision points for you

1. **Esc behavior:** Should BaseToolHandler default to exit-on-Esc (AutoCAD) or step-back-on-Esc (current)? This is a one-decision, all-handlers-affected change.

2. **Sysvar storage:** Per-drawing JSON in event store? Separate IndexedDB table? Global state in AppState.svelte? Architecture decision needed before implementation.

3. **TRIM + EXTEND merge:** AutoCAD's Shift-to-extend means TRIM and EXTEND share a handler. Should we merge `TrimHandler` and `ExtendHandler` into one bidirectional handler, or keep them separate with shared infrastructure?

4. **Quick mode default for TRIM:** AutoCAD 2021+ defaults to Quick. Should we match (break from Standard, which is what our current handler does) or start with Standard and add Quick later?

5. **Fillet non-line geometry:** Real computational geometry work (tangent-arc computation for arc+line, circle+line, etc.). Build in Rust kernel or defer to a library? Check if `parry2d` already has this.
