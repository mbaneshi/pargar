# Contributing to Pargar

Thanks for helping build an open, browser-native 2D CAD. Code, bug reports, AutoCAD-parity
findings, translations and docs are all welcome.

> **Start here:** the [README](README.md), the [roadmap](ROADMAP.md), and the seven
> architectural rules in [CLAUDE.md](CLAUDE.md) — reviews hold every change to them.

## Ways to contribute

| You have… | Do this |
|---|---|
| A browser and 10 minutes | Try <https://cad.houshkar.ir> and report what breaks (steps, expected vs. actual, browser). |
| AutoCAD experience | Compare a command's behaviour against AutoCAD and file a parity gap. Specs live in `notes/specs/autocad-2d/`. |
| Rust | Kernel work in `packages/kernel` — geometry, commands, DXF. |
| TypeScript / Svelte | UI, renderer and file I/O in `packages/app`, `packages/renderer`, `packages/file-io`. |
| Persian or another language | Translate the site or the app UI. Write for a native reader, not word for word. |

New here? Filter issues by `good first issue` or `help wanted`.

## Development

```bash
# Prerequisites: Rust (see rust-toolchain.toml), wasm-pack, Node 22, pnpm 9
pnpm install
pnpm build
pnpm dev
```

Tests: `cd packages/kernel && cargo test` and `pnpm test`. End-to-end: `pnpm exec playwright test`.

## Pull requests

1. Open (or find) an issue first. For anything non-trivial, agree on the approach there.
2. Branch from **`dev`** (the default branch). `main` only moves on releases.
3. Keep PRs focused, link the issue (`Closes #N`), and make CI green.
4. Every operation is a command (Rule 1): if a human can do it in the UI, an agent must be able
   to do it through the same command.
5. **Never put a secret in the repo.** `VITE_*` values are public by design.
6. CI runs on GitHub-hosted runners only. PRs that add `runs-on: self-hosted` will be closed.

## Licensing

By contributing, you agree that your contributions are licensed under **Apache-2.0**
([`LICENSE`](LICENSE)) for code and **CC BY 4.0** ([`LICENSE-docs`](LICENSE-docs)) for
documentation and translations.
