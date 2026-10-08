---
title: Roadmap
description: 2D parity first, AI on top, everything else parked.
---

The full, current roadmap is [`ROADMAP.md`](https://github.com/mbaneshi/pargar/blob/dev/ROADMAP.md) in the repository. In short:

## Now: AutoCAD 2D parity

**Scope is locked to 2D until launch.** The architecture (kernel, renderer, file I/O, MCP) is built and tested; the work now is making the seat experience solid for real users.

Launch means:

1. A fresh checkout runs with `pnpm install && pnpm dev`: a working canvas, no errors.
2. Every command-line alias and every Draw and Modify button activates the right tool and produces correct geometry.
3. Rubber-band preview is visible during every drawing tool.
4. Select, move, save to DXF, reload, and undo back to empty all work.
5. A full audit run finds no P0 or P1 issues.
6. An engineer who is not a developer draws a floor plan in under five minutes without confusion.

The ordered backlog lives in [`docs/2D-PARITY-BACKLOG.md`](https://github.com/mbaneshi/pargar/blob/dev/docs/2D-PARITY-BACKLOG.md) and in GitHub Issues.

## Then: AI on top

After 2D ships and is in use:

- Connect the existing MCP tools to a chat-bar UX.
- Multi-step agent flows.
- An agent action log with replay.

This phase is additive and small, because the foundation already exists.

## Parked

Research is kept, execution is paused until after the 2D launch. PRs that add code for these areas are declined.

| Area | When resumed |
|---|---|
| 3D CAD | B-rep kernel in WASM, extrude and revolve |
| BIM | IFC parsing, BIM components, validation |
| GIS | Globe rendering, coordinate systems, tiles |
| Civil | Alignments, profiles, corridors |
| Multi-agent and plugins | Orchestrated agents, sandboxed plugin runtime |
| Real-time collaboration | Multi-user editing |

## Not on the list

No DWG codec (DXF round-trip is in scope, DWG is not), no architecture rewrites unless a P0 bug needs one, and no performance work without a measurement first.
