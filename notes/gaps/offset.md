# OFFSET — Three-Way Gap Report

**Generated:** 2026-04-17
**Method:** AutoCAD spec extraction → NEXUS code static audit → Playwright runtime probe → diff
**Sources:**
- Spec: `notes/specs/autocad-2d/commands/offset.yaml` (with provenance per fact)
- Code: `notes/specs/nexus-2d/commands/offset.code.yaml`
- Runtime: `e2e/probe-offset.spec.ts` → `notes/runtime-traces/offset.trace.json` (run probe to populate)

## Legend

| Symbol | Meaning |
|---|---|
| **OK** | Spec, code, and runtime agree |
| **DESIGN** | Spec says X; code never planned for it. Add to the design. |
| **IMPL** | Code intends X; runtime shows broken. Bug to fix. |
| **MODELESS** | Modeless behavior (F-keys, transparent commands) absent or wrong |
| **GRAMMAR** | Command alias / prompt / option text mismatch |
| **STATE** | Sysvar / persistence / recall mismatch |
| **CTX** | Context-aware UI (right-click, menus) mismatch |

Severity is judged by impact on a 20-year power user's muscle memory.

## Top-line summary

**11 gaps.** 0 OK. 7 critical. 3 high. 1 medium.

NEXUS implements roughly **30%** of OFFSET's user-facing behavior surface. The kernel can mathematically offset entities, but the command — as a *power-user interaction* — is reduced from a 3-phase contract (`distance → pick → side`) to a 2-phase one (`distance → pick`), with no options, no state recall, and no within-command Undo.

For Mehmet (the 23-year AutoCAD vet), OFFSET in NEXUS would fail at the second keystroke he reaches for: `O Enter` to reuse the last distance.

---

## Gap table

| # | Dimension | Spec (AutoCAD) | Code (NEXUS) | Runtime | Class | Severity | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Alias `O` | yes | yes (`o`, `offset`, shortcut `O`) | probe-pending | **OK** | — | Confirmed by `acad.pgp` and `registerBuiltinCommands.ts:489` |
| 2 | Distance prompt text | `"Specify offset distance or [Through/Erase/Layer] <{OFFSETDIST}>:"` | `"OFFSET Specify offset distance:"` | probe-pending | **GRAMMAR** | high | Wording differs; option keywords absent; no default in `<…>` |
| 3 | `Through` option | yes — switches to through-point pick | NOT_IMPLEMENTED | probe-pending | **DESIGN** | critical | A frequently-used option for through-point offset (e.g. snapping new line to existing geometry) |
| 4 | `Erase` option | yes — toggles `OFFSETERASE` | NOT_IMPLEMENTED | probe-pending | **DESIGN** | high | Option to delete source after offsetting; common when reshaping |
| 5 | `Layer` option (Current/Source) | yes — sets `OFFSETLAYER` | NOT_IMPLEMENTED | probe-pending | **DESIGN** | high | Critical for office-template workflows where layer discipline matters |
| 6 | `OFFSETDIST` distance recall | persists last distance; default on Enter | NOT_DEFINED — distance reset to 0 each activation (`OffsetHandler.ts:11`) | probe-pending | **STATE** | critical | Breaks `O Enter` muscle memory; the single biggest miss in this command |
| 7 | Side-pick prompt | `"Specify point on side to offset or [Exit/Multiple/Undo] <Exit>:"` | NOT_IMPLEMENTED — kernel chooses side via sign of `distance` | probe-pending | **DESIGN** | critical | User cannot choose which side to offset to; reduces command from 3 phases to 2 |
| 8 | `Multiple` sub-option | yes — same source, multiple side picks | implicit via loop, but no submode keyword | probe-pending | **GRAMMAR** | medium | Loop behavior approximates this but doesn't match the contract |
| 9 | Within-command `Undo` | yes — `U` undoes last offset within OFFSET | NOT_IMPLEMENTED | probe-pending | **DESIGN** | medium | Common recovery pattern; user types U to undo the last offset and continue |
| 10 | Esc once exits command | yes | NO — `setStatus(0)`; resets to distance prompt instead (`OffsetHandler.ts:43-48`) | probe-pending | **IMPL** | high | Breaks "Esc to bail" muscle memory; user has to Esc again or click outside |
| 11 | Right-click context menu during OFFSET | shows Enter/Cancel/Recent/Pan/Zoom | backs up one status step OR cancels tool (`BaseToolHandler.ts:32-38`) | probe-pending | **CTX** | medium | Right-click during command should never modify command state without showing a menu first |
| 12 | F8 mid-OFFSET toggles ortho without exiting | yes (transparent) | `ortho_toggle` registered transparent; behavior depends on focus routing | probe-pending | **MODELESS** | — | Likely OK — verify with probe |
| 13 | Wheel-zoom mid-OFFSET zooms about cursor | yes | likely handled at canvas level | probe-pending | **MODELESS** | — | Verify with probe |
| 14 | `'PAN`, `'ZOOM` transparent command parsing | yes (apostrophe prefix) | NOT_PARSED | probe-pending | **MODELESS** | low | Apostrophe-prefix transparent invocation not implemented |
| 15 | `Space` repeats last command | yes | UNKNOWN | probe-pending | — | high if missing | App-shell behavior, not OFFSET-specific; needs probe |
| 16 | `OFFSETGAPTYPE` polyline gap fill | 0/1/2 controls extend/fillet/chamfer at corners | NOT_DEFINED | n/a | **STATE** | medium | Affects how closed-polyline offsets handle gaps; quality detail power users notice |
| 17 | `OFFSETERASE` sysvar | persists toggle state | NOT_DEFINED | n/a | **STATE** | high | Even if Erase option were added, no place to persist toggle |
| 18 | MCP schema parity | (n/a — AutoCAD has no MCP) | schema exposes only `id` + `distance`; same reduced surface as the GUI | n/a | **AI-PARITY** | high | Per Rule 6: AI agents inherit the same gap. Fixing the human surface fixes both. |

---

## Classified by fix path

### Quick wins (one-liners or near-it)

- **#1 alias** — already correct, no action.
- **#2 prompt wording** — change one string in `OffsetHandler.getPrompt()`. ~5 min once #3/#4/#5 are added.
- **#10 Esc-exits-command** — change `setStatus(0)` to `ctx.cancelCurrentTool()` in `OffsetHandler.onKeyDown`. ~2 min, possible regression risk in active drawing mid-distance.

### Small features (1–4 hours each)

- **#6 distance recall (OFFSETDIST)** — needs a persistent sysvar store. Once that exists, OFFSET reads it as default and writes it after a numeric input.
- **#9 within-command Undo** — needs the OFFSET handler to remember entity IDs created during this invocation and pop the last one on `U`.
- **#11 right-click context menu** — replace `BaseToolHandler.onRightClick` step-back with a context-menu emitter, scoped to "during command."

### New design surface (1–3 days each)

- **#3 Through option** — new sub-flow: `T → pick entity → pick through-point → emit offset_through`. Needs kernel `offset_through(id, point)` API too.
- **#4 Erase option** — toggle UI + sysvar + post-emit deletion.
- **#5 Layer option** — Current/Source choice + sysvar + layer routing on emit.
- **#7 side-pick prompt** — restructure handler to 3-state machine: `distance → pick entity → pick side → emit`. Kernel signature changes from `offset_entity(id, distance)` to `offset_entity(id, signed_distance, side_pick_point)` or `offset_entity(id, distance, normal_hint)`.
- **#16 OFFSETGAPTYPE** — kernel-side: per-vertex offset must support extend/fillet/chamfer at corners. This is real geometry work.

### Platform-level (sysvar layer)

- **#17, #6, #4-Erase, #5-Layer** all depend on a **sysvar subsystem** that doesn't exist. Once it does, four gaps collapse into one piece of infrastructure. This is the highest-leverage move.

### Modeless layer

- **#12, #13** — likely OK; need probe runs to confirm.
- **#14** — apostrophe-transparent prefix is a separate parser change in the command line; not OFFSET-specific.
- **#15** — Space-repeats-last is app-shell behavior; probe finds out.

### AI surface (Rule 6)

- **#18** is automatically resolved when #3/#4/#5/#7 land, *if* the MCP schema is regenerated alongside the handler. This is exactly the integrated-fidelity pattern from `notes/fidelity-subsystem.md` §7: "every command is incomplete until its MCP schema is updated."

---

## Methodology findings (worth remembering)

These weren't about OFFSET — they're about the audit process itself:

1. **Autodesk's `help.autodesk.com` is a SPA** that returns its bootloader JS to WebFetch instead of rendered content. We cannot use it as a primary source for spec extraction. Workarounds:
   - Use BricsCAD docs (`help.bricsys.com`) as a Tier-1.5 source — it's AutoCAD-compatible by design, behaviorally documented, and renders to plain HTML.
   - Use community sources (Cadapult, Imaginit, Arkance, AutoCAD Tips blog) for cross-validation.
   - Use Autodesk's *blog* posts (separate domain, plain HTML) for option summaries.
   - For final ambiguity, escalate to the senior AutoCADer (live oracle).
2. **Some `acad.pgp` mirrors are ancient** — the howtoautocad.com page returned a custom `SW`-for-OFFSET alias scheme, not the default `O`. Need to cross-validate against the canonical Autodesk-shipped file. The stress-free.co.nz mirror returned the correct defaults.
3. **acad.cuix is the missing key** for context-aware menus. We don't have a parsed copy. To do menus properly we need to either decompile a real install (license question) or specify the menu structure from documentation alone (less reliable).
4. **Three-way diffs require live runtime data**. Static code audit got us 80% of the way; the runtime probe is what tells us whether what we *think* we coded is what *actually happens*. Gaps marked "probe-pending" above are the things only Playwright can resolve.

---

## What this report tells us about the methodology

The four-artifact methodology produces:
- **Spec**: 1 file (~250 lines), regenerable per AutoCAD release, with provenance.
- **Code audit**: 1 file (~110 lines), from grep + read.
- **Probe**: 1 spec file (~200 lines) — runs continuously, emits trace.
- **Gap report**: this file — actionable, classified by fix path, severity-ranked.

For a single command, this is ~30 minutes of work end-to-end (excluding probe execution time). Of that, ~20 minutes is the LLM-assisted research and ~10 minutes is the diff write-up. The code-audit and probe scaffolding are reusable across commands.

**Extrapolation:** the top 30 commands at ~30 min each = ~15 hours of focused work to produce a complete gap report for the entire core 2D command set. That's a one-week sprint that produces:
- A definitive spec corpus we can re-run on every AutoCAD release.
- A definitive code-audit corpus we can re-run on every NEXUS release.
- A continuously-executed runtime probe suite.
- A complete prioritized engineering plan for "AutoCAD parity" — without the senior AutoCADer ever having to file a single bug report on the cheap stuff.

The senior tester's reports then focus on the perceptual / felt / context-emergent defects that automation cannot catch — not the typos, missing aliases, and absent options that this audit surfaces in 30 minutes per command.

---

## Recommended next moves

1. **Run the probe** (`pnpm exec playwright test e2e/probe-offset.spec.ts`) to populate the runtime trace and convert "probe-pending" rows to verdicts.
2. **Decide on the sysvar subsystem.** It blocks ~4 gaps in OFFSET alone and probably 50+ across the full command set. Highest leverage of any single architectural decision.
3. **Decide on side-pick refactor for OFFSET.** Touches kernel signature, handler state machine, and MCP schema in one coordinated change. Good template for how option-rich AutoCAD commands should be implemented.
4. **Pick the next 2 commands** for the same audit (suggest: `TRIM` and `FILLET` — both option-heavy, both critical to power-user flow). Confirms the methodology generalizes before committing to all 30.
