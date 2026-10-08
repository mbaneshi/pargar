# NEXUS -- Architecture Document Index

> **Status:** Binding Architectural Decisions
> **Last updated:** 2026-09-02 — this index must list every file in the directory (see `CLAUDE.md` Documentation Budget). Duplicate prefixes 00/15/31 and the 17–19 gap are known debt; do not renumber.

## 00-09: Foundations

| # | Document | Description |
|---|----------|-------------|
| 00 | [Executive Summary](00-executive-summary.md) | Vision, non-negotiable decisions, highest-risk bet |
| 00 | [Product Thesis](00-thesis.md) | 60-second briefing: what NEXUS is, why now, three non-negotiable bets |
| 01 | [System Architecture](01-system-architecture.md) | 7-layer architecture (L0-L6) with diagrams |
| 02 | [Tech Stack Matrix](02-tech-stack-matrix.md) | 12-category library evaluation with verdicts |
| 03 | [Data Interoperability](03-data-interoperability.md) | Coordinate systems, USES schema, streaming formats |
| 04 | [Design Patterns](04-design-patterns.md) | 8 patterns with Rust/TS interfaces: hexagonal, ECS, event sourcing, worker pool, constraint graph, flyweight, strategy parsers, command bus |
| 05 | [Agentic UI Design](05-agentic-ui-design.md) | NL->geometry pipeline, multi-agent, generative design |
| 06 | [MVP Roadmap](06-mvp-roadmap.md) | Sprint 0-5 + post-MVP roadmap |
| 07 | [Performance Benchmarks](07-benchmarks.md) | Rendering, WASM, memory, AI, latency benchmarks |
| 08 | [Security & Compliance](08-security-compliance.md) | Trust boundaries, GDPR, ITAR, ISO 19650, audit trail |
| 09 | [Architectural Risks](09-risks.md) | Top 5 risks, irreversible decisions, mitigations |

## 10-19: Infrastructure & Integration

| # | Document | Description |
|---|----------|-------------|
| 10 | [Server Infrastructure](10-server-infrastructure.md) | Cloud Run, CDN, networking, deployment |
| 11 | [AI Readiness Audit](11-ai-readiness-audit.md) | MCP tool schemas, agent architecture, AI integration gaps |
| 12 | [Application Shell](12-application-shell.md) | Svelte 5 app shell, layout, command palette, toolbar |
| 13 | [Agent Server Design](13-agent-server-design.md) | MCP server hosting, multi-provider LLM strategy |
| 14 | [Ports & Adapters](14-ports-adapters-design.md) | 7 hexagonal ports with concrete swap roadmap |
| 15 | [Rust Ecosystem & Upgrade Seams](15-rust-ecosystem-and-upgrade-seams.md) | Crate evaluation, upgrade paths, dependency strategy |
| 16 | [Strategic Reality Check](16-strategic-reality-check.md) | What's real vs aspirational, execution constraints |

## 20-29: Geometry & Kernel Deep-Dives

| # | Document | Description |
|---|----------|-------------|
| 20 | [Geometric Robustness](20-geometric-robustness.md) | Tolerance, epsilon, robust predicates, degenerate cases |
| 21 | [Boolean Operations](21-boolean-operations.md) | Dual kernel strategy, truck vs OCCT, fallback protocol |
| 22 | [ECS Component Design](22-ecs-component-design.md) | Component taxonomy, SoA layout, archetype queries |
| 23 | [Multi-Representation Geometry](23-multi-representation-geometry.md) | B-Rep + Mesh + Wireframe coexistence |
| 24 | [Parametric Feature Tree](24-parametric-feature-tree.md) | Feature history, regeneration, constraint propagation |
| 25 | [WASM Boundary Performance](25-wasm-boundary-performance.md) | Serialization cost, SharedArrayBuffer, zero-copy |
| 26 | [Constraint Solver Integration](26-constraint-solver-integration.md) | planegcs, ezpz, force-based solver, DOF diagnosis |
| 27 | [Fillet & Chamfer Gap](27-fillet-chamfer-gap.md) | What Rust crates can/cannot do, OCCT fallback |
| 28 | [File Format Integrity](28-file-format-integrity.md) | DXF round-trip, STEP fidelity, format test harness |
| 29 | [Project-Killer Risks](29-project-killer-risks.md) | Geometry math, solver, rendering, file I/O failure modes |

## 30+: Implementation

| # | Document | Description |
|---|----------|-------------|
| 30 | [Hard Problems Status](30-hard-problems-status.md) | Current state vs industry standard for geometry, constraints, rendering |
| 31 | [Codebase Audit 2026-04-22](31-codebase-audit-2026-04-22.md) | Baseline snapshot at `5f4fb1d`; all 10 items resolved by v0.2.0 (historical) |
| 31 | [Input State Machine](31-input-state-machine.md) | Tool input FSM, mouse/keyboard/touch event handling |
| 32 | [Implementation Plan](32-implementation-plan.md) | Phased execution plan with dependencies |
| 33 | [UI Interaction Architecture](33-ui-interaction-architecture.md) | 10-step dispatch chain, interaction bugs, grip modes |
| 34 | [Platform Architecture](34-platform-architecture.md) | Domain plugin system, DomainModule, expansion path |
| 35 | [UI System Design](35-ui-system-design.md) | **Proposal:** UIEventBus, InputRouter, DomainModule, property registry, command palette |
| 36 | [File I/O System Design](36-file-io-system-design.md) | **Proposal:** FileFormatRegistry, adapter pattern, pass-through, multi-format |

## Other

| Document | Description |
|----------|-------------|
| [Research Summary](NEXUS-research-summary.md) | Consolidated research findings (sections A-H) |
| [CAD Interaction Architecture](CAD-INTERACTION-ARCHITECTURE.md) | 2026-04-24 analysis of the interaction layer on `dev` |

## Standards Reference

Industry standards (file formats, compliance frameworks, engineering design codes) live in [docs/standards/README.md](../standards/README.md).

## How to Read This

1. **Executives / PMs:** 00 (Summary) -> 06 (Roadmap) -> 09 (Risks)
2. **Backend / Platform Engineers:** 01 (Architecture) -> 04 (Patterns) -> 14 (Ports & Adapters) -> 03 (Interop)
3. **AI / ML Engineers:** 05 (Agentic UI) -> 13 (Agent Server) -> 11 (AI Readiness)
4. **Frontend / Graphics Engineers:** 02 (Tech Stack) -> 12 (App Shell) -> 07 (Benchmarks) -> 31 (Input FSM)
5. **Kernel Engineers:** 20-29 (Geometry deep-dives) -> 04 (Patterns) -> 15 (Rust Ecosystem)
6. **Security / Compliance:** 08 (Security) -> 09 (Risks) -> [Standards](../standards/README.md)
