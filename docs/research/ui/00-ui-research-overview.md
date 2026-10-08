# UI Architecture Research — Overview

> **Status:** Active research. Original survey (2026-04-10 to 2026-04-15), extended with industry patterns (2026-04-19). Decisions captured in `docs/architecture/`. Doc 08 feeds into architecture proposal `docs/architecture/35-ui-system-design.md`.

## Purpose
Before designing NEXUS's UI architecture, we study what exists — same methodology we used for the Rust/WASM geometry kernel. No premature commitment to any framework or pattern. Extract, understand, then decide.

## Sources Studied

### Desktop CAD Reference Repos (`refrence-repos/cad/`)
| Project | Stack | UI Toolkit | Key UI Innovation |
|---------|-------|-----------|-------------------|
| **LibreCAD** | C++ | Qt5 | Command line + action factory + tool state machine |
| **FreeCAD** | C++/Python | Qt5 | Workbench system + task panels + command framework |
| **Blender** | C | Custom (OpenGL) | Area/editor system + operator pattern + RNA auto-UI |
| **OpenSCAD** | C++ | Qt5 | Code editor + customizer panel + console |
| **BRL-CAD** | C | Tk/Qt | MGED command interface + multi-display architecture |

### Web CAD Vendor Studies (`vendor-study/`)
| Project | Framework | Renderer | Key UI Pattern |
|---------|-----------|----------|----------------|
| **Chili3D** | Vanilla Web Components | Three.js | PubSub + CommandStore + CSS Modules |
| **That Open Components** | Framework-agnostic | Three.js | UUID singleton registry + extension system |
| **CAD Viewer (MLightCAD)** | Vue 3 + Element Plus | Three.js | AutoCAD-faithful command prompt + state machine |
| **ReplicAD** | React + MobX-State-Tree | React-Three-Fiber | Worker + Comlink WASM bridge + Monaco editor |

### Prior Research Findings (`docs/research/findings/`)
| Finding | UI-Relevant Insight |
|---------|-------------------|
| **CADmium** | Svelte + Threlte + staleness flags + CRC32 change keys |
| **Zoo Design Studio** | XState + codemods + command palette + AI conversation |
| **Chili3D** | Typed PubSub + command decorators + observable properties |
| **ReplicAD** | Headless core + Comlink workers + optional renderer |
| **Speckle** | WorldTree + extension system + draw-call batching |

## Research Documents

1. [01-desktop-cad-ui-patterns.md](01-desktop-cad-ui-patterns.md) — Patterns from LibreCAD, FreeCAD, Blender, OpenSCAD
2. [02-web-cad-ui-patterns.md](02-web-cad-ui-patterns.md) — Patterns from Chili3D, MLightCAD, ReplicAD, That Open
3. [03-js-ecosystem-mapping.md](03-js-ecosystem-mapping.md) — Desktop patterns mapped to JS/browser equivalents
4. [04-framework-evaluation.md](04-framework-evaluation.md) — Svelte vs React vs Vue vs Solid vs Web Components for CAD
5. [05-open-questions.md](05-open-questions.md) — Unresolved decisions needing deeper research
6. [06-ai-research-prompts.md](06-ai-research-prompts.md) — 9 prompts for Gemini, Claude, GPT, Grok, Perplexity
7. [07-the-real-challenge-human-machine-ux.md](07-the-real-challenge-human-machine-ux.md) — The hard problem: human-AI shared workspace UX
8. [08-industry-ui-architecture-patterns.md](08-industry-ui-architecture-patterns.md) — Figma, Blender, AutoCAD, FreeCAD, VS Code patterns for browser CAD (2026-04-19)

## Architecture Proposals (fed by this research)

- [docs/architecture/35-ui-system-design.md](../../architecture/35-ui-system-design.md) — Domain-agnostic shell: UIEventBus, InputRouter, DomainModule, property registry, command palette
