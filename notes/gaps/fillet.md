# FILLET — Three-Way Gap Report

**Generated:** 2026-04-17
**Sources:** `notes/specs/autocad-2d/commands/fillet.yaml` + `notes/specs/nexus-2d/commands/fillet.code.yaml` + `e2e/probe-fillet.spec.ts`

## Top-line

**11 gaps.** 1 partial-OK. 3 critical. 3 high. 5 medium.

NEXUS implements **~35%** of FILLET's user-facing behavior, but with an interesting twist: the most common power-user pattern (R=0 corner cleanup) works *accidentally* because radius defaults to 0 each invocation. The kernel can compute line-line fillets, and the implicit always-Multiple loop is actually friendlier than AutoCAD's default. But radius recall is broken, geometry support is lines-only, and key options (Polyline, Trim) are missing.

---

## Gap table

| # | Dimension | Spec (AutoCAD) | NEXUS | Class | Severity |
|---|---|---|---|---|---|
| 1 | Alias `F` | yes | yes | **OK** | — |
| 2 | R=0 corner cleanup | yes — `F R 0 pick pick` | works accidentally (radius=0 default) | **PARTIAL** | low |
| 3 | FILLETRAD persistence | drawing-level, persists across invocations | reset to 0 each activate() | **STATE** | critical |
| 4 | Radius sub-prompt | `"Specify fillet radius <FILLETRAD>:"` after typing `R` | bare number-input at first-object prompt; no sub-prompt | **GRAMMAR** | medium |
| 5 | Polyline option | fillets every internal corner of a polyline at once | NOT_IMPLEMENTED | **DESIGN** | critical |
| 6 | Trim / No-trim option | toggles TRIMMODE; no-trim creates arc without trimming | NOT_IMPLEMENTED | **DESIGN** | high |
| 7 | Multiple sub-mode | `M` → loop after each pair; explicit keyword | IMPLICIT_ALWAYS — no way to single-pair-then-exit | **GRAMMAR** | low |
| 8 | Shift-click R=0 override | Shift on second-pick forces R=0 for that pair, preserves FILLETRAD | NOT_IMPLEMENTED | **DESIGN** | medium |
| 9 | Within-command Undo | `U` undoes last fillet | NOT_IMPLEMENTED | **GRAMMAR** | medium |
| 10 | Esc exits command | one Esc exits FILLET | Esc resets to first-object prompt | **IMPL** | high |
| 11 | Geometry: line+arc, arc+arc, line+circle, etc. | all 2D entity-pair combinations | lines-only (`"Fillet requires lines"` error) | **KERNEL** | critical |
| 12 | First-object prompt wording | `"Current settings: Mode = TRIM, Radius = 0.00\nSelect first object or [Undo/Polyline/Radius/Trim/Multiple]:"` | `"FILLET R=0, select first entity [Radius]:"` | **GRAMMAR** | medium |
| 13 | Second-object prompt wording | `"Select second object or shift-select to apply corner or [Radius]:"` | `"FILLET Select second entity:"` | **GRAMMAR** | medium |
| 14 | Sysvars: FILLETRAD, TRIMMODE | both defined, persistent | NONE defined | **STATE** | high |
| 15 | MCP schema | (n/a) | no polyline option, no trim-mode; AI agent has same reduced surface | **AI-PARITY** | high |

---

## Fix path summary

**Quick wins:**
- #10 Esc-exits: same one-line fix as OFFSET/TRIM
- #12, #13 prompt wording: string changes, ~5 min each once options are wired

**Small features (1–4 hours):**
- #3 FILLETRAD recall: depends on sysvar subsystem, then one read+write per invocation
- #4 Radius sub-prompt: proper `R Enter → sub-prompt → number → return` flow
- #8 Shift-R=0: intercept Shift modifier in second-pick onCoordinateInput
- #9 within-command Undo

**New design surface (multi-day):**
- #5 Polyline option: kernel needs `fillet_polyline(id, radius)` that iterates all internal corners. New geometry code.
- #6 Trim/No-trim: kernel needs a `trim: bool` param on fillet; handler adds the T/N sub-prompt

**Kernel (geometry work):**
- #11 Fillet non-line entities: `geometry_ops::fillet` currently only handles `GeometryType::Line`. Needs: line+arc, arc+arc, line+circle, arc+circle, circle+circle intersection logic. This is real computational geometry (finding tangent arcs), not just plumbing.

**Platform-level:**
- #14 sysvar subsystem (same dependency as OFFSET, TRIM)
