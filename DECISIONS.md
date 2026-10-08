# NEXUS — Decision Log

> **Purpose:** Single source of truth for every technical and strategic decision.
> Read this file first. It tells you what's decided, what's pending, and where to find the details.
>
> **Statuses:**
> - **APPROVED** — decided, binding, build on it
> - **RESEARCH** — explored but not committed, may change
> - **DEFERRED** — explicitly postponed with rationale
> - **SUPERSEDED** — replaced by a newer decision

---

## ⚠ CURRENT SCOPE LOCK — read this first (2026-04-29)

**Sole focus until launch: AutoCAD 2D parity, in the browser, working for real users.**

All other domains (3D, BIM, GIS, Civil, Multi-Agent AI) are **PARKED** — research preserved, execution deferred — until the 2D product is shipped, stable, and used by real engineers. See **SD-05** below.

This is a tactical narrowing, not a vision change. The expansion path in Rule 4 of `CLAUDE.md` is still the long-game story. We just earn it by shipping 2D first.

**What this means in practice:**
- New PRs that add 3D/BIM/GIS/Civil/multi-agent features → rejected
- Open backlog: `docs/2D-PARITY-BACKLOG.md` (P0/P1/P2 against AutoCAD 2D)
- Active sprint plans: `docs/audit/EXPERIENCE-AUDIT.md` + Sprint 2 follow-up
- Parked plans: `docs/agent-tasks/parked/` and ADR banners on `docs/architecture/2[0-9]-*.md`

---

## Architecture Decisions

| # | Decision | Status | Summary | Source |
|---|----------|--------|---------|--------|
| AD-01 | Every operation is a command | APPROVED | GUI, CLI, API, AI all dispatch same Command enum | `CLAUDE.md` Rule 1 |
| AD-02 | Event-sourced state | APPROVED | Immutable events, state = replay, never mutate directly | `CLAUDE.md` Rule 2 |
| AD-03 | ECS data model | APPROVED | Entity = ID, components = data bags, no class inheritance. hecs when migrating (not bevy_ecs) | `CLAUDE.md` Rule 3, `docs/architecture/22-ecs-component-design.md` |
| AD-04 | Additive expansion | APPROVED | New domains = new components + commands, never rewrite core | `CLAUDE.md` Rule 4 |
| AD-05 | Rust/WASM for computation, TS for interaction | APPROVED | Geometry → Rust. UI → TypeScript. Bridge = JSON via wasm-bindgen | `CLAUDE.md` Rule 5 |
| AD-06 | AI agents are first-class users | APPROVED | MCP tool schema defined alongside every operation | `CLAUDE.md` Rule 6 |
| AD-07 | Research before building | APPROVED | Check ecosystem first, only build what doesn't exist | `CLAUDE.md` Rule 7 |
| AD-08 | Geometric robustness model | APPROVED | Three-tier: robust predicates → named Tolerance struct → per-entity tolerance (v0.2+) | `docs/architecture/20-geometric-robustness.md` |
| AD-09 | Boolean operations strategy | PARKED (SD-05, 2026-09-02) | truck primary + Manifold WASM fallback. Explicit failure protocol. Neither crate is in any manifest — 3D domain, parked. | `docs/architecture/21-boolean-operations.md` |
| AD-10 | ECS component layout | APPROVED | Full layout day-one→v1.0. TopoRef for TNP. Feature tree as ordered Vec. | `docs/architecture/22-ecs-component-design.md` |
| AD-11 | Multi-representation | APPROVED | B-Rep = truth. Mesh = cached per-face with generation counter. Binary transfer. | `docs/architecture/23-multi-representation-geometry.md` |
| AD-12 | Parametric feature tree | APPROVED | One intent event, N derived effects. Kahn's topo sort. Snapshot every 10 events. | `docs/architecture/24-parametric-feature-tree.md` |
| AD-13 | WASM boundary strategy | APPROVED | Delta sync now → binary transfer v0.2 → Web Worker v0.2+ → SharedArrayBuffer v0.3+ | `docs/architecture/25-wasm-boundary-performance.md` |
| AD-14 | Constraint solver path | APPROVED | ezpz (v0.2) → planegcs fallback (v0.3) → custom only if needed (v1.0) | `docs/architecture/26-constraint-solver-integration.md` |
| AD-15 | Fillet/chamfer strategy | PARKED (SD-05, 2026-09-02) | Simplified Rust fillet (planar-planar) + opencascade.js fallback (lazy-loaded). 2D fillet/chamfer ship in the kernel today; the opencascade.js fallback is 3D-only and not a dependency. | `docs/architecture/27-fillet-chamfer-gap.md` |
| AD-16 | File format integrity | APPROVED | DXF pass-through unknowns. STEP healing. 6 mandatory round-trip tests. | `docs/architecture/28-file-format-integrity.md` |
| AD-17 | Project-killer risks | APPROVED | #1 Last 20%, #2 truck bus factor, #3 competition, #4 sustainability | `docs/architecture/29-project-killer-risks.md` |

## Technology Choices

| # | Decision | Status | Summary | Source |
|---|----------|--------|---------|--------|
| TC-01 | Frontend framework | APPROVED | Svelte 5 (runes). Scores 8.0 weighted. No framework switch. | `docs/research/ui/04-framework-evaluation.md` |
| TC-02 | Design system | APPROVED | CSS custom properties (tokens) + shadcn-svelte | Planning session 2026-04-15 |
| TC-03 | Layout architecture | APPROVED | Fixed splitters with collapsible panels (svelte-splitpanes). No docking for v0.1. | Planning session 2026-04-15 |
| TC-04 | Mobile scope | APPROVED | v1.0 target, not v0.1. Add breakpoints so it doesn't break, but not touch-first. | Planning session 2026-04-15 |
| TC-05 | ECS library | APPROVED | hecs (minimal, library-first) — NOT bevy_ecs | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-06 | Constraint solver | APPROVED | ezpz for v0.1-v0.2, planegcs WASM as fallback | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-07 | Spatial indexing | APPROVED | rstar R-tree for O(log n) queries | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-08 | Polyline offset | PARKED (SD-05, 2026-09-02) | cavalier_contours (arc-aware, handles self-intersection). Not in `Cargo.toml`; kernel offset is in-house. | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-09 | 2D polygon booleans | PARKED (SD-05, 2026-09-02) | i_overlay (robust, integer arithmetic, 3M downloads). Not in `Cargo.toml`. | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-10 | 3D solid modeling | PARKED (SD-05, 2026-09-02) | truck for B-Rep + csgrs for mesh fallback + curvo for NURBS. None in any manifest — 3D domain. | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-11 | Bevy ECS migration | SUPERSEDED (2026-09-02) | ~~Current Vec/HashMap works at v0.1 scale. Migrate when 3D components need archetypal queries.~~ Storage has been `hecs::World` since v0.1.5 (`packages/kernel/src/world.rs`); see EX-05. bevy_ecs remains rejected (TC-05). | Planning session 2026-04-14; superseded by EX-05 |
| TC-12 | Three.js replacement | DEFERRED | Keep Three.js. No wgpu/three-d. Correct for browser. | `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` |
| TC-13 | Docking system | DEFERRED | Evaluate dockview/lumino when BIM/GIS add 5+ panel types | `docs/research/ui/05-open-questions.md` Q1 |
| TC-14 | Threlte vs direct Three.js | DEFERRED | Keep CadRenderer. Evaluate Threlte for v0.2 3D. | `docs/research/ui/05-open-questions.md` Q4 |
| TC-15 | WASM-to-UI state bridge | RESEARCH | Full sync now. Need to benchmark at 5k/10k/50k entities. | `docs/research/ui/05-open-questions.md` Q2 |
| TC-16 | AI agent panel UX | RESEARCH | 5 interaction modes mapped. v0.2: Mode 3 (human commands, AI executes). | `docs/research/ui/07-the-real-challenge-human-machine-ux.md` |

## Git Workflow

| # | Decision | Status | Summary | Source |
|---|----------|--------|---------|--------|
| GW-01 | Branch model | SUPERSEDED (2026-09-02) | ~~main (prod) → stage (QA) → dev (daily). Feature branches from dev only.~~ Replaced by the branch-rules model (PR #194): `dev` = default/integration, `main` advances only by version tag via `scripts/promote vX.Y.Z`, no `stage` branch. One issue = one worktree branch off `dev`; land on `dev` only via merged PR (`pre-push` guard in `scripts/git-hooks/pre-push`). | Planning session 2026-04-14; superseded by PR #194 |
| GW-02 | Agent workflow | APPROVED | Agents use git worktrees at `.worktrees/<name>`, branch from dev. Never merge/push. | `docs/agent-tasks/00-AGENT-RULES.md` |
| GW-03 | Claude Code hooks | APPROVED | PreToolUse hooks block commit/push on main/stage, block `git checkout -b` | `.claude/settings.local.json` |
| GW-04 | Deploy pipeline | SUPERSEDED by SD-09 | ~~`deploy-prod.yml` on tag push `v*.*.*`; `deploy-preview.yml` on push to `dev`.~~ Both workflows still run build/test/e2e on the same triggers, but no longer deploy — Firebase Hosting deploy retired (#221), no CI-driven Cloudflare replacement (see SD-09). Production deploys are now manual (`wrangler pages deploy`). | `.github/workflows/deploy-prod.yml`, `.github/workflows/deploy-preview.yml` |

## Strategic Decisions

| # | Decision | Status | Summary | Source |
|---|----------|--------|---------|--------|
| SD-01 | Product strategy | SUPERSEDED by SD-10 | Historical; see SD-10. | — |
| SD-02 | Infrastructure | SUPERSEDED by SD-06 | Historical cloud-hosting plan, retired. | — |
| SD-03 | v0.1 scope | APPROVED | 2D CAD vertical slice. AutoCAD 2D parity. | `PRD.md` |
| SD-04 | Expansion path | DEFERRED-POST-2D | 2D CAD → 3D → BIM → GIS → Civil → Point Cloud → Digital Twin. Sequencing intact; execution paused until SD-05 launch. | `CLAUDE.md` |
| SD-05 | Scope lock to 2D parity | APPROVED (2026-04-29) | Sole focus until launch = AutoCAD 2D parity. All other domains parked. PRs adding 3D/BIM/GIS/Civil/multi-agent code rejected at review. | This file (top callout) |
| SD-06 | Auth/data/storage: Firebase → self-hosted Supabase | APPROVED (2026-09-04) | Firebase Auth + Firestore + Cloud Storage replaced by self-hosted Supabase on maintainer-controlled infra. `nexus` Postgres schema + RLS; `nexus` Storage bucket. | `packages/app/src/lib/cloud/`, `supabase/` |
| SD-07 | Production URL | SUPERSEDED by SD-10 | Historical. | — |
| SD-08 | License | LOCKED (2026-09-08) | Apache-2.0 (explicit patent grant for a platform others build on). `LICENSE` file added. Resolves the `PRD.md` (previously MIT) vs `README.md` (Apache-2.0) contradiction flagged in the same audit, §4 row 5 — `README.md` was already correct. | `LICENSE`, `PRD.md`, `README.md` |
| SD-09 | Production URL migration | SUPERSEDED by SD-10 | Historical. | — |
| SD-10 | Independent open-source project | LOCKED (2026-10-08) | The codebase became **Pargar**, a standalone open-source project under `mbaneshi`, published with a fresh history. No upstream, no sync with any other repository. Reference deployment: `cad.houshkar.ir`, pull-deployed from release tags. CI runs on GitHub-hosted runners only. | `README.md`, `CLAUDE.md` |

## Sprint / Execution Decisions

| # | Decision | Status | Summary | Source |
|---|----------|--------|---------|--------|
| EX-01 | Wave 1 hybrid plan | APPROVED | 8 kernel agents + 4 UI foundation agents in parallel. UI-heavy tasks (text styles, units, grip modes) wait for UI shell. | Planning session 2026-04-15 |
| EX-02 | Bevy ECS deferred | APPROVED | Ship features on current architecture. Migrate when entity count demands it. | Planning session 2026-04-14 |
| EX-03 | Phase 0 timing | APPROVED | HashMap + tsify migration AFTER Wave 1 merges, not before. Avoids 12 merge conflicts. | Planning session 2026-04-15 |
| EX-04 | v0.1 ship sequence | APPROVED | Wave 1 → merge → Phase 0 → Wave 1.5 → Sprint 8 (deploy) → Sprint 9 (user test) → tag v0.1.0 | `ROADMAP.md` |
| EX-05 | ECS cache unification | APPROVED | NexusWorld is sole write path. All mutations dual-write hecs + cache. No direct cache access in lib.rs. | v0.1.5 |
| EX-06 | Test infrastructure | APPROVED | 1076 tests, coverage thresholds, CI reporting, auto-format pre-commit, visual regression baselines. | v0.1.6 |
| EX-07 | Pre-commit auto-format | APPROVED | cargo fmt + prettier --write run first, re-stage, then check. Format never blocks commits. | v0.1.6 |

---

## Document Index

### Active (read these)

| File | Purpose | Status |
|------|---------|--------|
| `CLAUDE.md` | Non-negotiable rules for all agents | ACTIVE |
| `DECISIONS.md` | This file — decision log | ACTIVE |
| `ROADMAP.md` | Execution sequence (phases 0-6) | ACTIVE |
| `PRD.md` | v0.1 product requirements | ACTIVE |
| `docs/archive/KNOWN-BUGS-2026-04-17.md` | Bug tracker snapshot, archived 2026-09-02 — bugs now live in GitHub issues; see `docs/audit/2026-09-02-state-and-decisions.md` §5 | ARCHIVED |
| `docs/agent-tasks/00-AGENT-RULES.md` | Agent workflow rules | ACTIVE |
| `docs/agent-tasks/*.md` | Individual task files for agents | ACTIVE |

### Reference (read when working on that topic)

| File | Purpose |
|------|---------|
| `docs/architecture/20-29*.md` | 10 architecture decisions (v0.2+ relevant) |
| `docs/research/RUST-CAD-ECOSYSTEM-CONSULTANCY.md` | Crate evaluation + adoption plan |
| `docs/research/ui/*.md` | 7 UI research docs |
| `docs/reports/*.md` | Agent reports from completed work (deleted in `ab816cf`) |

### Superseded (context only, don't execute from these)

| File | Replaced by |
|------|------------|
| `SPRINTS.md` (deleted) | `ROADMAP.md` — sprint history is in git log |
| `docs/SPRINT-CYCLE-2-PROPOSAL.md` (deleted in `ab816cf`) | `ROADMAP.md` Phase 3-6 |
| `docs/agent-tasks/done/coordinator-C-ui-annotation.md` | `docs/agent-tasks/coordinator-C-ui-foundation.md` |
| `docs/reports/cycle2-research-plan.md` (deleted in `ab816cf`) | `ROADMAP.md` + `DECISIONS.md` (research synthesized) |

---

*Last updated: 2026-09-02 (GW-01 and TC-11 superseded; GW-04 corrected; TC-08/09/10, AD-09/15 parked under SD-05; broken paths fixed; KNOWN-BUGS archived — evidence in `docs/audit/2026-09-02-state-and-decisions.md`)*
