# Pargar · پرگار

> An open-source, browser-native 2D CAD — AutoCAD-style drafting in one browser tab,
> with a Rust/WASM kernel and AI agents as first-class users.

**Pargar** (Persian for *drawing compass*) is a 2D CAD you run in the browser: no install,
your drawings stay local (OPFS) unless you sign in to cloud save, and every operation is a
command that a human, a script or an AI agent can call the same way.

- **Live:** <https://cad.houshkar.ir>
- **Site & docs:** <https://mbaneshi.github.io/pargar/> (English and Persian)
- **License:** Apache-2.0 (code), CC BY 4.0 (docs)

> Pargar started from a private codebase (codename **NEXUS**, which still appears in package
> and crate names) and was published on 2026-10-08 with a fresh history. It is an independent
> project with no upstream.

## What works today (v0.5 — 2D CAD vertical slice)

- **2D drafting:** Lines, circles, arcs, rectangles, polylines, text, dimensions
- **Edit tools:** Move, copy, rotate, scale, offset, trim, extend, fillet, chamfer, break, lengthen, mirror, explode, array
- **Geometric constraints:** Horizontal, vertical, coincident, distance, parallel, perpendicular, fixed, equal-length
- **Layer management:** Create, rename, color, visibility, lock
- **DXF import/export** -- round-trip tested
- **Local-first persistence** -- OPFS, your data never leaves your browser
- **Undo/redo** -- full event replay
- **AutoCAD-style commands** -- L, C, A, PL, REC, M, CO, RO, O, TR, MI, SC, E
- **AI-ready architecture** -- every operation callable via JSON command API

## Architecture

```
Rust/WASM kernel ---- geometry, constraints, event store, commands
     |
     | JSON serialization
     |
TypeScript/Svelte --- Three.js renderer, UI, snapping, file I/O
```

**7 architectural rules** (see CLAUDE.md):
1. Every operation is a command
2. Event-sourced state
3. ECS data model
4. Additive expansion
5. Rust/WASM for computation
6. AI agents are first-class users
7. Research before building

## Run locally

```bash
# Prerequisites: Rust, wasm-pack, Node 22 (see .nvmrc / workflows), pnpm
pnpm install
pnpm build        # builds WASM + all packages
pnpm dev           # starts dev server
```

## Run tests

```bash
cd packages/kernel && cargo test    # ≈711 Rust kernel tests (#[test] count, 2026-09-02)
pnpm test                           # ≈58 vitest files across packages/*/src/**/__tests__ (2026-09-02)
pnpm build                          # full build verification
```

## Keyboard shortcuts

| Key | Command | Key | Command |
|-----|---------|-----|---------|
| L | Line | M | Move |
| C | Circle | CO | Copy |
| A | Arc | RO | Rotate |
| PL | Polyline | SC | Scale |
| REC | Rectangle | O | Offset |
| E | Erase | TR | Trim |
| DT | Text | MI | Mirror |
| DIM | Dimension | F8 | Ortho |
| Ctrl+Z | Undo | F3 | Snap |
| Ctrl+Shift+Z | Redo | / | Command line |

## Project structure

```text
packages/
  kernel/     # Rust/WASM geometry kernel (≈711 #[test], 2026-09-02)
  renderer/   # Three.js 2D rendering
  file-io/    # DXF import/export, OPFS persistence
  core/       # Shared TypeScript types
  mcp/        # MCP server + tool-definitions.ts (canonical AI tool list)
  logger/     # Structured logger + transports
  app/        # SvelteKit application
e2e/
  parity/     # AutoCAD parity test framework
notes/
  specs/      # AutoCAD 2D command specs (YAML), read by e2e/parity
  gaps/       # Feature gap analyses
site/         # Project website (Astro + Starlight), deployed to GitHub Pages
scripts/
  git-hooks/  # pre-commit (format + clippy) and pre-push (branch rules + local CI)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues: see [SECURITY.md](SECURITY.md) — please do not open a public issue.

## License

Code: [Apache-2.0](LICENSE). Documentation: [CC BY 4.0](LICENSE-docs).
