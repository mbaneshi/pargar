# 2D Parity Backlog — Active Source of Truth

> **Last updated:** 2026-04-29
> **Scope lock:** SD-05 (`DECISIONS.md`) — sole focus until launch = AutoCAD 2D parity.
> **Definition of done:** a civil engineer completes a real floor-plan loop in `cad.houshkar.ir` without saying "this is broken."

This is the **active backlog**. Everything else (3D, BIM, GIS, Civil, multi-agent AI) is parked. Three upstream documents feed this list — none is duplicated here:

- **`docs/audit/EXPERIENCE-AUDIT.md`** — seat-tested findings from real-browser driving (P0/P1 bugs, with screenshots). The *foundation must be solid* gate.
- **`docs/roadmap/PARITY_GAP.md`** — structured AutoCAD-2D feature-gap inventory (Groups A–H, ~108 sized items). The *coverage* gate.
- **`docs/research/*` (23 files)** — prior research baseline. Read first to avoid re-research. See "Prior art index" at bottom.

Sequence below is binding. Do not start a tier until the previous tier is at zero open items.

## Verified ground truth (2026-04-29)

These claims were verified directly against the codebase, replacing earlier conflicting numbers:

| Claim | Verified value | Source |
|-------|----------------|--------|
| Kernel `Command` enum variants | **148** (not 105, not 48) | `packages/kernel/src/commands.rs:23–160` |
| Renderer entity-type coverage | Includes **Ellipse** + **Leader** (earlier audit was wrong) | `packages/renderer/src/CadRenderer.ts:1222, 1268` |
| Unified snap engine modes | **8** (endpoint, midpoint, center, intersection, quadrant, nearest, perpendicular, grid) | `packages/kernel/src/snap_queries.rs:65–80` |
| Spacebar = Enter in CommandLine | **NOT implemented** — only `e.key === 'Enter'` is handled | `packages/app/src/lib/components/CommandLine.svelte:231` |
| Shift+RClick → OSNAP override menu | **NOT implemented** — `handleContextMenu` shows generic context menu, no shift-modifier branch | `packages/app/src/routes/+page.svelte:274–294` |
| Sysvar registry size | 8 (vs ~93 common AutoCAD sysvars) — pending detailed inventory | `packages/kernel/src/` (registry not yet found in single file) |

> Playwright CI was timing out at the runner's 60-min job cap on every PR for ~weeks because `Toolbar.svelte` was orphaned by `d7ac0f7` while 25 specs + the `dismissWelcome` helper still waited on `[data-testid="toolbar"]`; restored in **PR #71** (`fix/toolbar-orphan-e2e`) — the single-spec proof was a 6.9× wall-clock speedup (4 min 11 s → 36 s on `e2e/parity/line.spec.ts`).

---

## Tier 0 — Foundation (must be zero before anything else)

These are **seat-tested bugs** that block real users today. Source: `EXPERIENCE-AUDIT.md`.

| ID | Status | What | Where |
|----|--------|------|-------|
| P0-1 | ✅ closed | Fresh `pnpm install && pnpm dev` returns 500 (MCP not built + Firebase crashes module load) | turbo.json, firebase.ts |
| P0-2 | ✅ closed | Sign-in modal blocks canvas every launch | +page.svelte |
| P0-3 | ✅ closed | Two stacked modals on first run | +page.svelte |
| P0-4 | ✅ closed | Command line dead — typing `L`/`LINE` does nothing | CommandLine.svelte |
| P0-5 | ✅ closed | Most ribbon Draw buttons dead (SplitButton prop name) | Ribbon.svelte |
| P0-6 | ✅ closed | No rubber-band preview during LINE | CadRenderer.ts, snap_queries.rs |
| P0-7 | ✅ closed | `find_all_snaps` not exported to JS — pointer-move threw on every frame | snap_queries.rs |
| P0-8 | ✅ closed | `REC` alias missing for RECTANGLE | registerBuiltinCommands.ts |
| P0-9 | ✅ closed (misdiagnosed) | "MOVE ignores typed coords" — actually a window-drag artifact | n/a |
| P0-10 | ✅ closed | Ctrl+Z swallowed by focused CLI input | +page.svelte |
| P0-11 | ✅ **CLOSED** (verified 2026-04-29) | Ctrl+A returns 0 selected — fixed by `0cce172` kernel-lifecycle centralization. Live test: Properties panel reads "20 objects selected"; all entities highlighted. Evidence `docs/audit/sprint-2/screenshots/sprint2-02`. | App init / kernel wiring |
| P0-12 | ✅ **CLOSED** (verified 2026-04-29) | Properties panel sync — fixed by `0cce172`. Single-click on Line entity surfaces full Geometry block (Start/End XY + Length). Evidence `sprint2-04`. | Selection broadcast / Properties panel |
| P1-1 | ✅ closed (still holding) | MCP bridge spam — exactly 1 console error per session, no retry storm. Verified 2026-04-29. | BridgeClient.ts |
| P1-2 | ✅ **CLOSED** (2026-04-30, sprint-3) | Scoped `--color-ribbon-label: #aaa` token + 11px on `.panel-label`. Live measurement clears WCAG AA. Playwright contrast assertion in `e2e/parity/contrast.spec.ts`. | Design tokens / Ribbon CSS |
| P1-3 | ✅ **CLOSED** (2026-04-30, sprint-3) | `CadRenderer.setCrosshairVisible` + `setCursorSize` add 2 THREE.Line stubs + 12px PICKBOX, wired from `+page.svelte` `$effect` on `shell.activeToolId`. Spec asserts scene-graph presence. | CadRenderer.ts |
| P1-4 | ✅ closed | `1 entities` plural typo | Ribbon.svelte |
| P1-5 | ✅ **CLOSED** (verified 2026-04-29) | Steps 5+6 verified by Sprint-2 investigation. Step 7 export verified — DXF (1985 B) contains 9 LINE + 4 ARC + 4 TEXT + 2 DIM + 1 DIMSTYLE for 20-entity sample. Step 8 undo verified — count 20→18 in 2 clicks. | E2E test |
| P1-6 | 🟡 **REASSIGNED to CI** | DXF import-and-reload validation moved to Worker A's `feat/ci-dxf-validators` task (ezdxf audit + ODA File Converter twin oracles). Will close on PR merge. | E2E + file-io |
| **F-1** | ✅ **CLOSED** (2026-04-30, sprint-3) | Space-as-Enter in CommandLine, gated on alphabetic-only buffer / empty-input-repeat / navigated-suggestion. Coord-shape inputs (digits, `,`, `@`, `<`) keep Space literal. 4 Playwright cases in `e2e/parity/spacebar-as-enter.spec.ts`. | `CommandLine.svelte` |
| **F-2** | ✅ **CLOSED** (2026-04-30, sprint-3) | New `OsnapOverrideMenu.svelte` mounted via shift-rclick branch in `handleContextMenu`. Implemented modes clickable; rest disabled with "not yet implemented" tooltip. Sets `SnapEngine.oneShotOverride`. | `+page.svelte`, `OsnapOverrideMenu.svelte` |
| **F-3** | ✅ **CLOSED** (verified 2026-04-29) | All 7 F-keys toggle correctly: F3/F7/F8/F9/F10/F11/F12 → OSNAP/GRID/ORTHO/SNAP/POLAR/OTRACK/DYN. ORTHO↔POLAR mutual exclusion AutoCAD-spec correct. | `+page.svelte` keymap |
| **F-1a** | ✅ **CLOSED** (2026-04-30, sprint-3) | Subsumed by F-1: when autocomplete is open AND user has navigated, Space accepts the suggestion. | `CommandLine.svelte` |
| **F-2a** | ✅ **CLOSED** (2026-04-30, sprint-3) | Plain right-click branch left untouched; only `e.shiftKey` case routes to OsnapOverrideMenu. Test asserts both menus exist and are mutually exclusive. | `+page.svelte` |
| **F-4** | ✅ **CLOSED** (2026-04-30, sprint-3) | Root cause: ContextMenu had no Esc handler (the brief's "autocomplete leak" was misdiagnosed — the autocomplete owns no backdrop). Added `<svelte:window onkeydown>` that calls `onClose()` on Escape. Spec `backdrop-leak.spec.ts` asserts DOM teardown. | `ContextMenu.svelte` |

**Tier 0 exit criteria:** all rows ✅ closed. Estimated effort: <1 week.

Sprint 2 closed 2026-04-30; see table.

---

## Tier 1 — Coverage parity (the gap inventory)

Source: `docs/roadmap/PARITY_GAP.md`. Stable IDs (A1–A20, B1–B29, C1–C18, F2–F23, etc.) are referenced in commits, branches, and PRs. **Do not duplicate that document here** — read it for sized items, dependencies, and rationale.

**In-scope under SD-05** (the v0.5 + v0.6 clusters from PARITY_GAP.md, *minus* anything 3D/BIM/GIS):
- **Group A** (kernel resource/style tables): A1–A12, A16, A17, A18, A19, A20. *Skip A13–A15 dynamic blocks — defer to post-launch.*
- **Group B** (UI dialogs): B1–B3, B7–B12, B19–B23, B27–B29. *Skip B15 CUI editor, B16 Sheet Set Manager, B24–B26 LISP/Express Tools — defer.*
- **Group C** (renderer): C1–C8, C10–C13, C16–C18. *Skip C9 Xref content, C14–C15 LOD/culling — defer unless a parity bug demands them.*
- **Group D** (file-format): F2, F3, F4, F5 (PDF underlay), F7–F19, F22, F23. *Explicitly excluded: F1 DWG binary codec (post-launch), F20 Sheet sets (post-launch), F21 cloud sync (post-launch).*
- **Group E** (selection + snap): E1–E12, all in scope.
- **Group F** (sysvars): F1–F8 sysvar clusters, all in scope (this is `A20` from Group A).
- **Group H** (strategic refactors): H3, H4, H5. *Skip H1 AppState decomposition unless a parity bug demands it; skip H2 multi-document architecture; skip H6 unless perf becomes a parity blocker.*

**Out of scope under SD-05** (parked, do not start without lifting SD-05):
- F1 DWG binary codec (Group D) — license/strategy decision, 12+ months
- A13–A15 Dynamic blocks (Group A) — large parametric system
- B4 BEDIT, B5 Xref Manager, B16 SSM, B25 LISP IDE, B26 Express Tools (Group B) — heavy authoring features
- C9 Xref content rendering (Group C)
- All of Group G (Action Recorder, plug-in execution, AutoLISP, Diesel, real-time collab)
- H1 AppState decomposition, H2 multi-document, H6 perf benchmarks

**Tier 1 exit criteria:** all "in-scope" items above closed. Sized at ~70 items, mostly S/M, with a handful of L. Realistic timeframe: 6–10 weeks of focused work.

---

## Tier 1.5 — Parity Matrix (machine-checkable coverage)

Source: `docs/parity-matrix.csv` (1927 rows). Generated by `pnpm parity:scrape` against
Autodesk's beehive search API for AutoCAD 2026 (`subType=command` and `subType=sysvar`)
and cross-walked against `packages/kernel/src/commands.rs` (150 `Command` variants) and
`packages/kernel/src/lib.rs` (8 sysvars in `default_sysvars`). Re-run is idempotent: cache
hits use `If-Modified-Since` / `If-None-Match` where the upstream supplies them, byte-identical CSV across runs verified.

**AutoCAD 2026 Core surface area:** 900 commands (filtered to `(Command)` titles; the 83
`(Express Tool)` entries the API returns are tracked separately) and 1027 system
variables.

**NEXUS coverage today:**

| kind | yes | parked (SD-05) | no (in-scope gap) |
|------|----:|---------------:|------------------:|
| commands | 121 | 131 | 648 |
| sysvars  | 7   | 47  | 973 |

**Reading the matrix:**

- `nexus_implemented = yes` — at least one mapped kernel variant exists. The `notes`
  column flags missing construction modes (CIRCLE → 4 NEXUS variants matched, ELLIPSE
  → `CreateEllipse` + `CreateEllipseArc` covered, etc.).
- `nexus_implemented = parked` — the command/sysvar is 3D, mesh, surface, render, or
  point-cloud and out of scope under SD-05. Park rules: see
  `scripts/parity/cross-walk.ts` (`PARKED_PREFIXES` + `PARKED_NAMES`). Conservative —
  default is in-scope when uncertain.
- `nexus_implemented = no` — in scope under SD-05 but no kernel variant maps. This is
  the active Tier 1 gap surface: **648 commands + 973 sysvars** to triage and
  prioritise.
- `nexus_source` — `file:line` in `packages/kernel/src/` for the matched variants
  (semicolon-separated when multiple).
- `category` — empty in v1; Phase 2 enrichment will populate from per-page
  `meta[name="product-feature"]` (parser already implemented; pipeline pending).

**Known limitations of v1:**

1. `category` is not populated. Per-page fetch costs ~30 min wall time; deferred until
   the matrix is in active use.
2. The kernel sysvar `OFFSETERASE` is implemented but the AutoCAD search API did not
   return a `(System Variable)` entry for it; it is therefore absent from the matrix.
   Filed as a follow-up.
3. The NEXUS variant count is 150 (verified by regex), not 148 as recorded earlier in
   the audit. No correctness impact on the matrix — every variant is enumerated by
   name from the kernel source.
4. Express Tools (84 entries) and obsolete commands are not in the matrix; both sit
   outside SD-05 anyway.

**Cross-reference to `docs/roadmap/PARITY_GAP.md`:** the matrix is the *enumerated*
truth. PARITY_GAP is the *sized* backlog (Groups A–H). Use the matrix when asking
"does this AutoCAD command exist?" and PARITY_GAP when planning sprints.

**Refresh:** `pnpm parity:scrape --refresh` to invalidate the cache.

---

## Tier 2 — Launch gate (the seat test)

Cannot ship until ALL of these pass on a clean checkout against `cad.houshkar.ir`:

1. `pnpm install && pnpm dev` → working canvas in <10 seconds, no modal, no console errors.
2. Every CLI alias listed in Quick Start activates the right tool. Tested aliases: `L LINE PL POLYLINE C CIRCLE A ARC R REC RECTANGLE M MOVE CO COPY RO ROTATE SC SCALE MI MIRROR E ERASE TR TRIM EX EXTEND O OFFSET F FILLET CHA CHAMFER`.
3. Every Draw + Modify + Annotate ribbon button activates its tool and produces correct geometry.
4. Rubber-band preview is visible during every drawing tool.
5. Every snap mode (END / MID / CEN / NOD / QUA / INT / EXT / INS / PER / TAN / NEA / APP / PAR / GEO) has a visible marker matching AutoCAD glyphs.
6. Layer manager: create / rename / freeze / lock / color / linetype / lineweight / plot toggle — all functional.
7. DIMSTYLE, MLEADERSTYLE, TABLESTYLE, TEXTSTYLE managers all functional.
8. DXF round-trip: save → close → open in AutoCAD → save → reopen in NEXUS → geometry, layers, styles, annotations, hatch, dimensions all preserved.
9. Window-select → Move → DXF save → reload → undo back to empty all work without artifacts.
10. AutoCAD power-user keyboard workflow (`L ⏎ 100,100 ⏎ @50<45 ⏎ ⏎ Esc`) draws the expected geometry.
11. Cursor crosshair, dynamic input, command echo, status-bar prompts match AutoCAD behavior.
12. Auto-save every 30s, recoverable on reload.
13. **A real civil engineer (not a developer) draws a floor plan in <5 minutes without confusion.**

**Launch:** tag `v1.0.0`, push to production, recruit 3 real engineers, observe.

---

## Tier 3 — AI on top (post-launch)

After launch + stability:

- Wire existing 91 MCP tool definitions to a chat-bar UX in the app
- LangGraph.js orchestration for multi-step agent flows
- Agent action log + replay (event log already supports this)
- This is **additive** — sits on top of the 2D product

This tier is small because the foundation is already built. Do not start until Tier 2 launch is shipped.

---

## What this backlog explicitly does not contain

- 3D anything
- BIM (IFC, web-ifc, BIMProperties)
- GIS (CesiumJS, proj4js, PMTiles, DuckDB-WASM)
- Civil (alignment, profile, corridor, grading)
- Point cloud (Potree)
- Digital twin / IoT
- Multi-user collab beyond auto-save (Yjs, presence, locks, shared views)
- Cloud Run / Cloud SSE MCP (local stdio only)
- LISP / Diesel / Express Tools
- DWG binary codec

These are not abandoned. They are parked. See `docs/agent-tasks/parked/` and the PARKED banners on `docs/architecture/2[0-9]-*.md`.

---

## Prior art index — research already done in repo

Before opening any task, check whether the topic is already covered. The 23 files under `docs/research/` are a deliberate research moat — don't pay the cost of re-researching them.

| Topic | Read first |
|-------|-----------|
| Open-source library landscape (the "what exists" answer) | `docs/research/00-landscape-analysis.md`, `02-open-source-tools-catalog.md`, `05-open-source-ecosystem-directory.md` (210+ projects), `08-repos-worth-studying.md` |
| Rust CAD ecosystem trade-offs (binding reference) | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| File-format / DXF / DWG ecosystem | `docs/research/09-file-io-ecosystem.md` |
| Industry-verified standards URLs (DXF spec, OGC, IFC, AASHTO) | `docs/research/ui/nexus-standards-urls-reference.md` |
| Desktop CAD UI patterns (LibreCAD, FreeCAD, Blender, BricsCAD) | `docs/research/ui/01-desktop-cad-ui-patterns.md` |
| Web CAD UI patterns (Chili3D, MLightCAD, ReplicAD, CADmium) | `docs/research/ui/02-web-cad-ui-patterns.md` |
| Industry UI architecture (Figma, Blender, AutoCAD, VS Code, Linear) | `docs/research/ui/08-industry-ui-architecture-patterns.md` |
| Framework choice rationale (Svelte 5 vs alternatives) | `docs/research/ui/04-framework-evaluation.md` |
| Open UI questions (docking, state bridge, AI panel UX) | `docs/research/ui/05-open-questions.md` |
| Human-AI shared-workspace UX (the hard problem) | `docs/research/ui/07-the-real-challenge-human-machine-ux.md` |
| **Pre-written prompts for external LLMs** (Gemini, Claude, GPT, Perplexity) | `docs/research/ui/06-ai-research-prompts.md` |
| Adjacent technology patterns (game engines, ECS, undo/redo) | `docs/research/04-adjacent-technology.md` |
| Tiered study plan (which repos to clone & study) | `docs/research/03-tiered-study-plan.md` |
| OSS exploration priority matrix (210+ scored against vision) | `docs/research/07-oss-exploration-priority-matrix.md` |
| Ecosystem integration analysis (how each library plugs in) | `docs/research/06-ecosystem-integration-analysis.md` |
