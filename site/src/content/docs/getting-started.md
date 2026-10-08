---
title: Getting started
description: Run Pargar locally, build the WASM kernel and run the tests.
---

The quickest way to try Pargar is the reference deployment at **[cad.houshkar.ir](https://cad.houshkar.ir)**. Nothing to install; drawings are stored in your browser.

To hack on it, run it locally.

## Prerequisites

| Tool | Version |
|---|---|
| Rust | pinned in `rust-toolchain.toml` |
| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | latest |
| Node.js | 22 |
| pnpm | 9 |

## Build and run

```bash
git clone https://github.com/mbaneshi/pargar.git
cd pargar
pnpm install
pnpm build        # builds the WASM kernel and every package
pnpm dev          # starts the SvelteKit dev server
```

`pnpm install` also wires the repo's git hooks (`core.hooksPath scripts/git-hooks`): formatting and clippy before commit, branch rules and a local CI pass before push.

Rebuild just the kernel with `pnpm build:kernel`.

## Tests

```bash
cd packages/kernel && cargo test    # Rust kernel tests
pnpm test                           # vitest across packages
pnpm exec playwright test           # end-to-end, including AutoCAD parity specs
pnpm build                          # full build verification
```

## First drawing

Press `/` to focus the command line, then try:

| Key | Command | Key | Command |
|---|---|---|---|
| `L` | Line | `M` | Move |
| `C` | Circle | `CO` | Copy |
| `A` | Arc | `RO` | Rotate |
| `PL` | Polyline | `SC` | Scale |
| `REC` | Rectangle | `O` | Offset |
| `DT` | Text | `TR` | Trim |
| `DIM` | Dimension | `MI` | Mirror |
| `E` | Erase | `F3` / `F8` | Snap / Ortho |

`Ctrl+Z` undoes and `Ctrl+Shift+Z` redoes, all the way back to an empty drawing.

## Repository layout

```text
packages/
  kernel/     Rust/WASM geometry kernel
  renderer/   Three.js 2D rendering
  file-io/    DXF import/export, OPFS persistence
  core/       shared TypeScript types
  mcp/        MCP server + tool-definitions.ts (the canonical AI tool list)
  logger/     structured logger
  app/        SvelteKit application
e2e/parity/   AutoCAD parity test framework
notes/specs/  AutoCAD 2D command specs (YAML)
site/         this website (Astro + Starlight)
```

Package and crate names still use the codename `nexus`, from before the project was published.
