# AutoCAD 2D Parity Gap — 2026-04-26

Sized backlog of every gap between current `dev` and full AutoCAD 2D parity.

Sources: [docs/archive/CURRENT_STATE-2026-04-26.md](../archive/CURRENT_STATE-2026-04-26.md) and the six
detailed audits beside it. Read those first if you want context for any line below.

## How to read this

- **Layer**: which package owns the change. K=kernel, M=mediator (protocol/commands/MCP),
  U=app/UI (Svelte), R=renderer, F=file-io.
- **Size**: rough work estimate, calibrated for AI-assisted execution after the spec
  is locked. S=≤1 day, M=2–5 days, L=1–2 weeks, XL=>2 weeks.
- **Depends on**: prerequisite gap IDs.
- **Why it matters**: the parity-blocking consequence today.

Gap IDs are stable references. Use them in commits, sprints, and PR titles.

## Group A — Kernel resource/style tables

These are kernel data structures that need to exist before their UI dialogs and
file-I/O round-trips can be built. Most of Group A blocks downstream UI work.

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| A1 | `DimStyle` named-style table + per-dimension style ref | K, M, R | L | — | DIMSTYLE manager and DIM appearance customization both blocked |
| A2 | Annotative-scale system (CANNOSCALE, per-object scale list) | K, M, R | L | A1 | Every annotation type needs multi-representation support |
| A3 | `MLeaderStyle` table + per-leader ref | K, M, R | M | A1 | MLEADER appearance |
| A4 | `TableStyle` table + per-table ref | K, M, R | M | A1 | Table cell formatting and borders |
| A5 | Plot style table types (CTB color-based + STB named) | K, M | L | — | Plot/print correctness; pen mapping |
| A6 | `LayerState` named-state table | K, M | M | — | LAYERSTATE save/restore |
| A7 | Layer filter (group + property + nested) | K, M | M | — | Drawings with hundreds of layers |
| A8 | `Group` entity (named + anonymous + selectable toggle) | K, M | S | — | GROUP/UNGROUP commands |
| A9 | Named UCS table | K, M | S | — | UCS save/restore by name |
| A10 | Named view table (kernel resource, not UI cache) | K, M | S | — | VIEW save/restore with UCS + layers |
| A11 | Drawing properties (DWGPROPS) — title/author/keywords/comments | K, M, F | S | — | Sheet title-block fields, eTransmit metadata |
| A12 | Field evaluator (dwgprop / object-prop / sheetset-cell / sysvar bindings) | K, M | M | A11 | Linked text values throughout drawing |
| A13 | Dynamic block parameters (linear/angular/polar/XY/rotation/alignment/flip/visibility/lookup) | K, M | XL | — | Real symbol library round-trip |
| A14 | Dynamic block actions (move/scale/stretch/rotate/array/lookup) | K, M | XL | A13 | — |
| A15 | Dynamic block visibility states + parameter sets | K, M | L | A13, A14 | — |
| A16 | `Mline` GeometryType variant (CreateMline command exists, variant doesn't) | K, M, R | M | — | **Architecture decision required — see note after Group A.** Same composite-vs-atomic question affects Donut, Region, Solid 2D, Polygon. |
| A17 | MTEXT rich-text storage (bold/italic/underline/color/stack/columns/tabs/bullets) | K, M | M | — | MTEXT round-trip parity |
| A18 | Centerline + Centermark commands and entities | K, M | M | — | Mechanical drafting |
| A19 | Hyperlink storage on entities | K, M | S | — | HYPERLINK command |
| A20 | Sysvar registry expansion (8 → ~93 common AutoCAD sysvars) | K, M | L | — | Behavioral parity across snap/grid/dim/linetype/view/file |

**Group A subtotal**: ~7 L + 5 M + 5 S + 3 XL.

### Architecture decision required — A16 and four siblings

**Surfaced by:** Sprint 4 (2026-05-03) — Worker B's S4-D pivot (renderer side) and Worker A's S4-C/2 audit (file-io side) independently hit the same blocker.

**The question:** Should NEXUS represent these five entity types as composites (decomposed at create-time, current behavior) or as atomic entities with their own `GeometryType` variants?

| Entity | Current state | Decomposes to |
|--------|---------------|---------------|
| MLine | No variant; `create_mline` decomposes at create-time | N parallel polylines (one per offset) |
| Donut | No variant; `create_donut` decomposes at create-time | 2 circles |
| Region | No variant; `create_region` decomposes at create-time | Closed polyline |
| Solid 2D | No variant, no `create_solid` function | n/a (entirely absent) |
| Polygon | No variant; `create_polygon` decomposes at create-time | Closed polyline |

**Why this isn't a sprint-task quick fix:**

1. Reversing decomposition affects selection (one click = one entity vs N), modify (scale as a unit vs independently), DXF round-trip (write atomic entity vs N primitives), hit-test, and renderer dispatch.
2. Adding 5 variants to `GeometryType` grows the existing 19-variant enum to 24 just as the codebase should be moving toward ECS (CLAUDE.md Rule 3).
3. Ripples to ~50+ `match geom { ... }` sites across kernel (translate/rotate/scale/mirror/copy/serialize), file-io (DXF export), and renderer.

**What's blocked until decided:** A16 (MLine), C3 (render MLine), C5 (render Region), C6 (render Solid 2D), C7 (render Donut as actual donut), C8 (render Polygon as actual polygon), F11 (DXF round-trip for MLINE).

**What was shipped instead:** Sprint 4 PR #82 added warn-once telemetry to the renderer for unknown `GeometryType` variants — turns silent unreachable code into a loud diagnostic for whatever lands first.

**Decision owner:** TBD next sprint. Cross-functional — affects file-io, kernel, renderer, app interaction.

## Group B — UI dialogs and managers

Each of these is a Svelte dialog + ribbon entry + keyboard binding + properties
panel integration. Most depend on kernel pieces in Group A.

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| B1 | DIMSTYLE Manager dialog | U | M | A1, A2 | Per-style customization; multi-style drawings |
| B2 | MLEADERSTYLE Manager dialog | U | S | A3 | — |
| B3 | TABLESTYLE Manager dialog | U | S | A4 | — |
| B4 | Block Editor (BEDIT) full UI | U, R | XL | A13, A14, A15 | Authoring/editing dynamic blocks |
| B5 | Xref Manager full lifecycle (detach/reload/bind/clip/refedit) | U | L | F2, F3 | Multi-drawing workflows |
| B6 | Reference Edit (REFEDIT) in-place with locking | U, K | M | B5 | Edit referenced content without breaking refs |
| B7 | Page Setup Manager dialog (full AutoCAD field set) | U | M | A5 | Plot configuration per layout |
| B8 | Layout Wizard | U | S | B7 | Quick layout creation |
| B9 | Layer States Manager dialog | U | S | A6 | — |
| B10 | Layer Filter Properties dialog | U | M | A7 | — |
| B11 | Linetype Manager dialog | U | S | — | Load/save linetype definitions |
| B12 | Plot Styles editor (CTB and STB) | U | M | A5 | — |
| B13 | Tool Palettes drag-drop (real, including .xtp import/export) | U | M | — | Library content workflows |
| B14 | DesignCenter full drag-drop between drawings (blocks/layers/styles) | U | M | — | — |
| B15 | CUI (Customize User Interface) editor | U, M | XL | — | Workspaces, ribbon, keyboard, menu, mouse |
| B16 | Sheet Set Manager (SSM) panel + .dst file | U, K, F | XL | A11 | Multi-sheet project workflows |
| B17 | Drawing Compare (COMPARE) overlay with diff slider | U, K | L | — | Revision review |
| B18 | Standards Manager + violation report (DWS) | U, K | L | — | Enterprise standards enforcement |
| B19 | Hatch dialog full (pattern picker library, gradient, origin, gap tol, retention) | U | M | — | — |
| B20 | Find/Replace (FIND) dialog | U | S | — | Annotation editing |
| B21 | Spell check (SPELL) | U | M | — | — |
| B22 | Quick Properties (QP) panel + activator | U | M | — | Inline editing |
| B23 | Filter dialog (saved selection filters) | U | M | — | Power-user selection |
| B24 | AppLoad dialog (load `.lsp` and JS plugins) | U, M | M | I3 | Plug-in lifecycle |
| B25 | LISP/JS plug-in IDE pane (VLIDE-equivalent) | U | L | I3 | Customization workflow |
| B26 | Express Tools — full ribbon tab | U, K | XL | — | Power-user productivity |
| B27 | Multileader collected/styled output | U, K, R | M | A3 | — |
| B28 | Annotation visibility toolbar (annotative scale + visibility) | U, R | S | A2 | — |
| B29 | Hyperlink dialog | U | S | A19 | — |

**Group B subtotal**: ~5 L + 12 M + 8 S + 4 XL.

## Group C — Renderer

Most renderer gaps unblock visible parity. Group C is independently parallelizable
once entity types in Group A land.

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| C1 | Render Image entities (raster + mask + clip + transform) | R, F | M | F4 | — |
| C2 | Render Wipeout entities | R | S | — | Mask drawings under blocks |
| C3 | Render MLine entities | R | S | A16 | — |
| C4 | Render Leader entities | R | S | — | Annotation visibility |
| C5 | Render Region entities (filled or outlined) | R | S | — | — |
| C6 | Render Solid 2D entities | R | S | — | — |
| C7 | Render Donut entities | R | S | — | — |
| C8 | Render Polygon entities (currently only as polyline) | R | S | — | — |
| C9 | Render Xref content (open external file, render as nested) | R, F | L | B5, F2 | Multi-drawing parity |
| C10 | AutoCAD-style snap markers (square/triangle/circle/X glyphs per OSNAP type) | R | S | — | Pro-user familiarity |
| C11 | Hot grip (red) state + grip context menu | R, U | M | — | Standard grip-edit workflow |
| C12 | Apply LTSCALE + CELTSCALE + PSLTSCALE to dashed/dotted linetypes | R | S | — | Lines render identically to AutoCAD |
| C13 | Paper-space layout rendering (frame, viewport clipping, viewport scale) | R | L | A2 | Layout parity |
| C14 | Frustum culling for >100K entities | R | M | — | Large-drawing performance |
| C15 | LOD for large drawings (skip detail at zoom-out) | R | L | C14 | — |
| C16 | Lineweight rendering robust across GPUs (custom shader path) | R | M | — | Plot preview accuracy |
| C17 | Hatch pattern library (full ANSI + ISO set, ~80 patterns) | R | M | — | — |
| C18 | Annotative scale rendering (one entity, multiple visible reps per scale) | R | M | A2 | — |

**Group C subtotal**: ~3 L + 5 M + 10 S.

## Group D — File-format parity

Largest single gap for "drop-in DWG replacement." Group D items are mostly
independent of A and B but together gate the "open any AutoCAD file" promise.

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| F1 | DWG binary codec read+write (R12 → 2018+) | F | XL | — | The big one. AutoCAD users send DWG, not DXF. License decision needed |
| F2 | BLOCK + INSERT round-trip in DXF | F | M | — | Block libraries |
| F3 | XREF resolution (DXF + DWG references) | F | M | F1, F2 | Multi-drawing |
| F4 | Image attach + IMAGEDEF + IMAGEDEF_REACTOR | F | M | A1 (entity) | Raster underlay |
| F5 | PDF underlay + PDFDEF | F | M | — | Reference scanned drawings |
| F6 | DGN attach | F | M | — | MicroStation files |
| F7 | ELLIPSE round-trip in DXF | F | S | — | Common entity loss |
| F8 | SPLINE round-trip in DXF | F | M | — | — |
| F9 | LEADER + MLEADER round-trip in DXF | F | M | A3 | — |
| F10 | TABLE round-trip in DXF | F | M | A4 | — |
| F11 | WIPEOUT, MLINE, RAY, XLINE round-trip in DXF | F | S | A16 | — |
| F12 | TOLERANCE (GD&T) round-trip in DXF | F | S | — | — |
| F13 | MTEXT rich-text round-trip in DXF (codes for bold/italic/stack/etc.) | F | M | A17 | — |
| F14 | DXF version negotiation (R12 / R14 / 2004 / 2007 / 2010 / 2013 / 2018) | F | M | — | Import older files reliably |
| F15 | DWGPROPS preservation in DXF HEADER | F | S | A11 | — |
| F16 | DWT template format (read + save-as-template) | F, U | S | — | Template-based new drawing |
| F17 | eTransmit (package drawing + xrefs + fonts + plot styles into ZIP) | F, U | M | F1, F3 | — |
| F18 | Multi-sheet PDF export (paper-space iteration) | F | M | C13 | — |
| F19 | Plot stamps on PDF (date/file/scale metadata) | F | S | A11 | — |
| F20 | Sheet sets (.dst) read+write | F | L | B16 | — |
| F21 | OPFS/cloud sync (Firebase + GCS) | F | L | — | Browser-native AEC needs cloud persistence; per memory: GCP infra |
| F22 | Drawing recovery (auto-save + .bak files) | F, U | M | — | Crash-safety baseline |
| F23 | Audit + Recover commands UI (kernel commands exist) | U | S | — | — |

**Group D subtotal**: ~3 L + 10 M + 6 S + 1 XL (the DWG codec).

## Group E — Selection and snap

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| E1 | Fence selection (line crossing) | M, U | S | — | — |
| E2 | Lasso selection (modern AutoCAD) | M, U | S | — | — |
| E3 | Last (LSELECT) and Previous (PRESELECT) modes | M, U | S | — | — |
| E4 | Implied-selection toggle (PICKAUTO sysvar) | M, U | S | A20 | — |
| E5 | Group selection toggle (PICKSTYLE sysvar) | M, U | S | A8, A20 | — |
| E6 | Add-to-Working-Set (add to current selection) | M, U | S | — | — |
| E7 | Select Similar by N properties (current is single-property) | M, U | M | — | Power-user workflow |
| E8 | Snap-to-extension + snap-to-parallel modes | K, M, R | M | A20 | OSNAP completeness |
| E9 | Snap-to-apparent-intersection | K, M, R | M | — | OSNAP completeness |
| E10 | Snap-to-geometric-center | K, M, R | S | — | — |
| E11 | Object Snap Tracking (track from acquired snap points) | K, M, R, U | L | A20 | Standard AutoCAD workflow |
| E12 | Polar Tracking (incremental angles) | K, M, R, U | M | A20 | — |

**Group E subtotal**: ~1 L + 4 M + 7 S.

## Group F — Sysvars

The sysvar registry holds 8; most parity-blocking sysvars are missing. The
specific list is given in `docs/archive/CURRENT_STATE-2026-04-26.md` Section D. Bundled here as a single
project (A20 from Group A drives this), but the wiring per category is broken
out for sequencing:

| ID | Sysvar cluster | Layer | Size | Depends | Why it matters |
|----|----------------|-------|------|---------|----------------|
| F1 | Snap/grid sysvars (OSMODE, GRIDUNIT, SNAPUNIT, SNAPMODE, GRIDMODE, SNAPANG, SNAPBASE, POLARMODE, AUTOSNAP) — wire UI ↔ kernel | K, M, U | M | A20 | UI/AI/kernel agree on snap state |
| F2 | Limits/units sysvars (LIMMIN, LIMMAX, LIMCHECK, LUNITS, LUPREC, AUNITS, AUPREC, INSUNITS, MEASUREMENT) | K, M | S | A20 | DXF unit fidelity |
| F3 | Linetype sysvars (CELTSCALE, PSLTSCALE, CELTYPE, CELWEIGHT, CECOLOR, CLAYER) | K, M, R | M | A20, C12 | — |
| F4 | Dimension sysvars (DIMSCALE, DIMTXT, DIMTSZ, DIMASZ, DIMEXE, DIMEXO, DIMGAP, DIMTAD, DIMTOH, DIMTIH, DIMSTYLE) | K, M, R | M | A1 | — |
| F5 | Display sysvars (DISPSILH, FILLMODE, QTEXTMODE, BLIPMODE, HIGHLIGHT) | K, M, R | S | — | — |
| F6 | View sysvars (TARGET, VIEWCTR, VIEWDIR, VIEWMODE, VIEWSIZE, VIEWTWIST) | K, M, R | M | — | — |
| F7 | Dynamic input sysvars (DYNMODE, DYNPROMPT, DYNDIVIS, DYNPIVIS, DYNTOOLTIPS) | K, M, U | S | — | — |
| F8 | File sysvars (SAVEFILE, SAVENAME, SAVETIME, ISAVEPERCENT, ISAVEBAK) | K, M, F | S | F22 | Auto-save plumbing |

**Group F subtotal**: ~5 M + 3 S.

## Group G — Workflow / customization / collab

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| G1 | Action Recorder full lifecycle (record/edit/play/parameterize/save .actm) | M, U, K | L | — | Macro recording per Rule 1 |
| G2 | Plug-in execution path (registry exists; sandboxed JS exec missing) | M, U | L | — | — |
| G3 | AutoLISP runtime (subset matching Visual LISP API) + REPL | K, M | XL | G2 | LISP customization |
| G4 | Diesel string evaluator | K, M | M | — | Status bar / menu macros |
| G5 | Real-time collaboration: Yjs adapter on event log | K, M | XL | — | Multi-user editing |
| G6 | Presence / cursors / named selections per user | M, U | M | G5 | — |
| G7 | Edit locks for refedit/bedit during collab | M | M | G5 | — |
| G8 | Markup / Trace overlay (free-form ink + callouts merged back) | K, M, U, R | L | — | Mobile-style review |
| G9 | Shared views (publish a snapshot URL) | K, M, U, F | M | F21 | — |

**Group G subtotal**: ~3 L + 4 M + 2 XL.

## Group H — Strategic refactors (non-blocking, risk-reducing)

These don't deliver parity directly but reduce future rework cost.

| ID | Gap | Layer | Size | Depends | Why it matters |
|----|-----|-------|------|---------|----------------|
| H1 | Decompose ~850-line `AppState` mega-store into composed stores | U | M | — | Sustainability past v0.5 |
| H2 | True multi-document architecture (1:1 document → kernel-world) | K, M, U | L | — | Multi-DWG parity |
| H3 | Wire snap/grid UI to kernel sysvars (AppState ↔ kernel.osmode) | M, U | S | F1 | Bug class: UI/AI disagree on snap |
| H4 | Visual-regression test harness for renderer (snapshot per entity type) | R | M | — | Catch renderer regressions in CI |
| H5 | Real DXF round-trip parity test gate (every entity must round-trip) | F | M | F1–F13 | CI guarantees |
| H6 | Performance benchmark suite (entity counts: 10K, 100K, 1M) | R, K | M | C14, C15 | Track scale work |

**Group H subtotal**: ~1 L + 4 M + 1 S.

---

## Totals (rough effort)

| Size | Items | Notes |
|------|-------|-------|
| S    | 40    | Many of these compose into "small dialog + ribbon entry" weeks |
| M    | 47    | Bulk of the parity work |
| L    | 14    | Each is a 1–2 week focused milestone |
| XL   | 7     | DWG codec, dynamic blocks (3 items), CUI editor, LISP runtime, real-time collab |

These are **AI-assisted execution estimates** after specs are locked. Specs aren't
all locked yet — the next step is to convert at least the v0.5-targeted items
into per-feature acceptance criteria.

## Suggested milestone clustering

Calibrated against dependency order and value-per-week. Subject to revision once
sized items are validated by shipping a couple of them.

### v0.5 — "Style + Annotation Parity"
Goal: every existing annotation type can be styled, plotted, and round-tripped
through DXF correctly. Drafting becomes documentation.

- A1, A2, A3, A4, A5, A6, A7, A11, A12, A17, A18, A19
- B1, B2, B3, B7, B8, B9, B10, B11, B12, B19, B20, B22, B27, B28, B29
- C2, C3, C4, C5, C6, C7, C8, C10, C11, C12, C13, C16, C17, C18
- F2, F7, F8, F9, F10, F11, F12, F13, F15, F16, F18, F19, F22, F23
- E1, E2, E3, E4, E5, E6, E10, E12
- F1 sysvars, F3 sysvars, F4 sysvars, F5 sysvars, F6 sysvars, F7 sysvars, F8 sysvars
- A20, H3, H4, H5

### v0.6 — "Authoring Parity"
Goal: blocks, xrefs, constraints, customization workflows. Real symbol libraries
and parameterized geometry.

- A8, A9, A10, A13, A14, A15, A16
- B4, B5, B6, B13, B14, B15, B23, B24, B25
- C1, C9, C14, C15
- F3, F4, F5, F6, F14, F17, F20
- E7, E8, E9, E11
- G1, G2

### v0.7 — "Drop-in Replacement"
Goal: open any DWG, customize the workspace, run LISP, collaborate live.

- B16, B17, B18, B26
- F1 (DWG binary codec)
- F21
- G3, G4, G5, G6, G7, G8, G9
- H1, H2, H6

## What's NOT in this plan

These are explicitly out of scope for v0.5–0.7 (deferred to v0.8+):

- 3D primitives (extrude, revolve, sweep, loft) — kernel is 2D-only currently.
- BIM domain (web-ifc, IfcWall, IfcSpace).
- GIS domain (CesiumJS terrain, CRS transforms).
- Surveying / point cloud.
- Civil engineering alignments / corridor / grading.

Each of these is a separate platform expansion per the additive-expansion rule
(CLAUDE.md Rule 4) and gets its own roadmap.

## Decision points the user must own

1. **DWG codec strategy** — clean-room Rust port (12+ months), Open Design Alliance
   license (commercial), or wrap a JS DWG library if available. Decision needed
   before v0.7 starts.
2. **`feat/ribbon-customize` branch** — keep and rebase, or drop?
3. **Collab transport** — WebSocket via Cloud Run (per existing GCP infra) or
   pure peer-to-peer Yjs? Decision before G5.
4. **LISP runtime scope** — Visual LISP compatibility level (subset vs full).
   Decision before G3.
5. **Sysvar persistence** — store in DXF HEADER (parity) or in NEXUS project file
   only? F2/F8 wiring depends on this.

## Definition of Done (binding for every gap above)

A gap is "done" when ALL apply:

- Kernel: Rust struct + tests + event variant if state-changing.
- Mediator: command in registry + MCP tool definition + event broadcast.
- UI: dialog or inline editor + ribbon entry + keyboard alias + properties panel
  integration where applicable.
- Renderer: visible result matches AutoCAD output for the same input.
- File-I/O: round-trip preserved through DXF (and later DWG).
- Tests: unit (kernel) + integration (mediator) + e2e parity (Playwright) +
  round-trip (file-io).
- Sysvars: any new state has a sysvar entry; UI ↔ kernel wired bidirectionally.
- AI parity: every command callable through MCP with typed schema (CLAUDE.md
  Rule 6).
- Docs: command reference entry + sysvar reference entry where applicable.
