# TRIM — Three-Way Gap Report

**Generated:** 2026-04-17
**Sources:** `notes/specs/autocad-2d/commands/trim.yaml` + `notes/specs/nexus-2d/commands/trim.code.yaml` + `e2e/probe-trim.spec.ts`

## Top-line

**10 gaps.** 0 OK (except alias). 3 critical. 4 high. 3 medium.

NEXUS implements **~15%** of TRIM's user-facing behavior. TRIM is arguably in worse shape than OFFSET because modern AutoCAD (2021+) defaults to Quick mode — no cutting-edge selection step — while NEXUS forces the user through the old Standard mode AND limits them to a single cutting edge. A 20-year user will feel like they went back to AutoCAD R14.

---

## Gap table

| # | Dimension | Spec (AutoCAD) | NEXUS | Class | Severity |
|---|---|---|---|---|---|
| 1 | Alias `TR` | yes | yes | **OK** | — |
| 2 | Quick mode (default since 2021) | all objects are implicit cutting edges; just click to trim | NOT_IMPLEMENTED — always Standard mode | **DESIGN** | critical |
| 3 | Multi-cutting-edge selection | pick N edges + Enter to finish, or Enter for "select all" | ONE cutting edge only (`boundaryId: string`) | **DESIGN** | critical |
| 4 | Options: Fence | batch-trim by drawing a fence polyline | NOT_IMPLEMENTED | **DESIGN** | high |
| 5 | Options: Crossing | batch-trim by dragging a rectangle | NOT_IMPLEMENTED | **DESIGN** | high |
| 6 | Options: Project / Edge | PROJMODE + EDGEMODE sysvars for implied-edge extension | NOT_IMPLEMENTED | **DESIGN** | medium |
| 7 | Options: eRase | delete entity without leaving TRIM | NOT_IMPLEMENTED | **GRAMMAR** | medium |
| 8 | Options: Undo (within-command) | U reverses last trim | NOT_IMPLEMENTED | **GRAMMAR** | medium |
| 9 | Shift-to-extend | Shift-click inverts TRIM → EXTEND on the picked entity | NOT_IMPLEMENTED | **DESIGN** | critical |
| 10 | Esc exits command | one Esc exits TRIM | Esc resets to cutting-edge prompt | **IMPL** | high |
| 11 | Sysvars: TRIMEXTENDMODE, EDGEMODE, PROJMODE | all defined, all persistent | NONE defined | **STATE** | high |
| 12 | MCP schema | (n/a) | single-cutter single-target; no batch API | **AI-PARITY** | high |

---

## Fix path summary

**Quick wins:**
- #10 Esc-exits: change `setStatus(0)` → `ctx.cancelCurrentTool()` in TrimHandler.onKeyDown

**Small features (1–4 hours):**
- #8 within-command Undo: handler tracks trimmed entities, U reverses last
- #7 eRase: mid-command delete

**New design surface (multi-day):**
- #2 Quick mode: restructure handler — skip cutting-edge phase, compute trim against all visible edges per pick. Kernel needs `trim_entity_against_all(id, pick_x, pick_y)` signature.
- #3 Multi-cutting-edge: `boundaryId: string` → `boundaryIds: string[]` + Enter-to-finish + Enter-selects-all.
- #4 + #5 Fence/Crossing: batch-pick infrastructure (also needed by SELECT, ERASE, COPY, MOVE, etc. — this is a platform capability, not TRIM-specific).
- #9 Shift-to-extend: TRIM handler intercepts Shift modifier on pick and calls ExtendEntity instead. Actually the simplest way: merge TRIM and EXTEND into one bidirectional handler, per AutoCAD's actual architecture.

**Platform-level:**
- #11 sysvar subsystem (same dependency as OFFSET)
- #4+#5 batch-pick / fence / crossing selection (shared infrastructure across many commands)
