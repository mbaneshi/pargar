---
title: Architecture
description: The seven binding rules and how the packages fit together.
---

```text
Rust/WASM kernel ─── geometry, constraints, ECS world, event store, commands
       │
       │  JSON commands and events across the wasm-bindgen bridge
       │
TypeScript/Svelte ── Three.js renderer, UI, snapping, command line, file I/O
       │
MCP server ───────── typed tools that map onto the same kernel commands
```

## The seven rules

Every change is reviewed against these. They are what make the rest possible.

1. **Every operation is a command.** Drawing a line is a command object, whether it comes from a toolbar click, a shortcut, the command line, an API call or an agent. No logic hides in UI event handlers.
2. **Event-sourced state.** Every change appends an immutable event; current state is the replay of the log. Undo, redo, audit trail and replay all fall out of this.
3. **ECS data model.** An entity is an ID, components are plain data, systems query components. No class hierarchies, so new kinds of entity add components instead of rewriting the core.
4. **Additive expansion.** New capabilities arrive as new components, commands, renderers and parsers plugged into the existing world, event store and command system. The core is extended, not restructured.
5. **Rust/WASM for computation, TypeScript for interaction.** Geometry, spatial queries and constraint solving live in Rust; UI and rendering orchestration live in TypeScript and Svelte. The boundary is the wasm-bindgen bridge.
6. **AI agents are first-class users.** An operation's tool schema is defined together with the operation: a name, typed parameters, a typed result, callable without any GUI.
7. **Research before building.** Check for a proven open-source library first; build custom only where there is a real gap.

## Packages

| Package | Language | Role |
|---|---|---|
| `packages/kernel` | Rust → WASM | ECS world (hecs), geometry, constraints, hash-chained event store, 100+ commands |
| `packages/renderer` | TypeScript | Three.js 2D rendering with instancing |
| `packages/file-io` | TypeScript | DXF import/export, OPFS persistence |
| `packages/core` | TypeScript | Shared types across the boundary |
| `packages/mcp` | TypeScript | MCP server and `tool-definitions.ts` |
| `packages/logger` | TypeScript | Structured logging |
| `packages/app` | Svelte 5 / SvelteKit | The application shell, command line, panels |

## Where the detail lives

The full set of architecture notes, from geometric robustness to the WASM boundary, is in [`docs/architecture/`](https://github.com/mbaneshi/pargar/tree/dev/docs/architecture) in the repository. Product decisions are logged in [`DECISIONS.md`](https://github.com/mbaneshi/pargar/blob/dev/DECISIONS.md).
