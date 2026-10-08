# ROADMAP.md — Single Source of Truth

> Last updated: 2026-10-08 (published as Pargar; see `DECISIONS.md` SD-10)
> **Current phase:** AutoCAD 2D Parity Sprint (scope lock SD-05)

---

## ⚠ Scope lock

**Sole focus until launch:** AutoCAD 2D parity, working in the browser for real users.

3D, BIM, GIS, Civil, Point Cloud, Digital Twin, and Multi-Agent AI are **PARKED** (see `## PARKED` below). PRs that introduce code for those domains are rejected at review. The expansion path stays the long-game vision (Rule 4 in `CLAUDE.md`); we earn it by shipping 2D first.

Decision: `DECISIONS.md` SD-05.

---

## Where we are (`v0.5.0` on `dev`)

**Architecture is sound.** The kernel, renderer, file-io, and MCP layers are all built and tested. The seat experience is what's holding us back.

- 105 kernel commands, 91 MCP tool definitions, hash-chained event sourcing, hecs ECS, NexusWorld sole authority
- 1131 unit tests + 19 E2E specs, 0 failures (last full run pre-Sprint 1)
- POLAR/OTRACK, unified snap engine, DOF visuals, renderer instancing
- DXF round-trip for Rectangle, DIMENSION, HATCH, DIMSTYLE, MLEADERSTYLE, TABLESTYLE, DWGPROPS, named views/UCS
- WASM 443KB gzipped

**What seat-testing exposed (Sprint 1, 2026-04-27):**
The architecture works on paper. The seat experience is uneven. Yesterday's audit  found 8 P0 bugs and 4 P1 issues by driving the live app for 25 minutes. **Sprint 1 closed P0-1…P0-8 + P1-1 + P1-4.** Sprint 2 surfaced P0-9 (misdiagnosed → closed), P0-10 (closed), P0-11 + P0-12 (fixed in `0cce172`, verified 2026-04-29).

---

## Now — AutoCAD 2D Parity Sprint

**Acceptance criteria for launch:**

1. Fresh checkout: `pnpm install && pnpm dev` → working canvas, no modal, no 500.
2. Every CLI alias listed in Quick Start activates the right tool.
3. Every Draw + Modify ribbon button activates its tool and produces correct geometry.
4. Rubber-band preview is visible during every drawing tool.
5. Window-select → Move → DXF save → reload → undo back to empty all work.
6. The 8-step audit protocol completes end-to-end with **zero P0 and zero P1** findings.
7. A civil engineer (real user, not a developer) draws a floor plan in < 5 minutes without confusion.

**Active backlog:** `docs/2D-PARITY-BACKLOG.md` (P0/P1/P2 list, ordered).

**Working surface:** GitHub Issues and the project board.

**What ships at launch:** v1.0 of the 2D product on `cad.houshkar.ir`, used by ≥3 real engineers without saying "this is broken."

---

## Then — AI on top (post-2D-launch)

After the 2D product is shipped, stable, and used:
- Wire the existing MCP server (91 tools already exist) to a chat-bar UX
- LangGraph.js orchestration for multi-step agent flows
- Agent action log + replay
- This is **additive** — sits on top of the 2D product, doesn't change it

This phase is small because the foundation is already there. The only blocker is shipping 2D.

---

## PARKED — Resume after 2D launch

> Research preserved, execution paused. Do not start work in these areas without lifting SD-05.

| Phase | Plan (when resumed) | Source |
|-------|---------------------|--------|
| 3D CAD | opencascade.js lazy-loaded, extrude/revolve, kernel Worker via Comlink | ADRs `docs/architecture/27-fillet-chamfer-gap.md`, `25-wasm-boundary-performance.md` |
| BIM | web-ifc parser, BIMProperties components, IFC validation, Yjs collab decision | ADR `docs/architecture/22-ecs-component-design.md` |
| GIS | CesiumJS, RTC rendering, proj4js, PMTiles, DuckDB-WASM | Research catalog |
| Civil | Custom Rust alignment/profile/corridor (no OSS exists) | AASHTO/Eurocode references |
| Multi-Agent + Plugins | LangGraph.js orchestration, `interrupt()` for human approval, iframe + Extism plugin runtime | — |
| Cloud collab + auth (full) | WorkOS SSO migration, Yjs/CRDT, multi-user editing, Cloud Run MCP SSE | — |


---

## What NOT to Do

1. No new domain code (3D, BIM, GIS, Civil, Multi-Agent) — gate hard.
2. No new architecture refactors (no AppState rewrite, no hexagonal-port completion) unless required by a P0 parity bug.
3. No new docs without retiring one (Documentation Budget Rules in `CLAUDE.md`).
4. No premature performance work — measure first.
5. No DWG codec — DXF round-trip is in-scope, DWG is not.

---

## Completed phases (kept brief; full history in git log)

- **Phase 5c — v0.2.0 Architecture audit + launch** (2026-04-23): NexusWorld sole authority, apply_event/unapply_event, incremental spatial index, scoped solver, typed TS boundaries, unified snap, POLAR/OTRACK, DOF visuals, renderer instancing, DXF round-trip fixes, CI green, Firebase deploy.
- **Phase 5b — v0.1.6 Test infra** (2026-04-22): 1157 unit + 24 E2E, coverage thresholds, auto-format pre-commit.
- **Phase 5 — UI + MCP** (2026-04-22): data-driven Toolbar, Agent Panel, MCP server with 91 tool definitions.
- **Phase 4 / 4b — Kernel hardening + ECS cache unification** (2026-04-22): hecs migration, lib.rs split, dual-write killed, cache made private.
- **Phase 3 — UI Protocol Foundation** (2026-04-22): EventBus, AppContext, CommandDef, KeymapResolver, design tokens.
- **v0.4.0 — Full AutoCAD 2D UI parity** (2026-04-25): ribbon, tool palettes, design center, paper space, layouts, multi-document, MTEXT editor, plugin foundation, action recorder, xref manager.
- **v0.5.0 — Style registries + DXF round-trip** (2026-04-27): TABLESTYLE, MLEADERSTYLE, DWGPROPS, named views/UCS.
- **Sprint 1 — Foundation fixes** (2026-04-27): closed 8 P0 + 2 P1 from `EXPERIENCE-AUDIT.md`.
- **Sprint 2 — closed 2026-04-30**: P0-10 fixed, P0-11/P0-12 fixed (`0cce172`, verified 2026-04-29); Sprint 3 closed P1-2/P1-3 and the F-series muscle-memory items (PR #70). Only P1-6 open (CI DXF validators).

---

## Reference

| Need | Location |
|------|----------|
| Strategic thesis (long-game vision) | `docs/architecture/00-thesis.md` |
| Architecture rules (binding) | `CLAUDE.md` |
| Decisions log | `DECISIONS.md` |
| Product spec | `PRD.md` |
| **2D parity backlog (active)** | `docs/2D-PARITY-BACKLOG.md` |
| Parked architecture ADRs | `docs/architecture/2[0-9]-*.md` (banners) |
