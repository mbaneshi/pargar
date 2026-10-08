# scripts/

Repo-level helper scripts. Each script must be runnable from the repo root.

| Script | Purpose | Entry point |
|--------|---------|-------------|
| `local-ci.sh` | Mirror the GitHub Actions CI pipeline locally (`pnpm ci:fast`). | `./scripts/local-ci.sh fast` |
| `build-test-fixtures.mjs` | Regenerate `packages/file-io/test-fixtures/nexus-authored/*.dxf`. Byte-deterministic. | `pnpm build:test-fixtures` |
| `validate-dxf.mjs` | Run `ezdxf audit` against every fixture + every round-tripped output. | `pnpm validate:dxf` |

## Reserved for PR #2 — ODA File Converter fetch contract

A follow-up PR (`feat/ci-dxf-oda-validator`) will add `oda-fetch.mjs` (or
`oda-fetch.sh`) to download the ODA File Converter binary at CI runtime.
Contract reserved here so two PRs don't drift:

- **Filename:** `scripts/oda-fetch.mjs`
- **Env vars (input):**
  - `ODA_VERSION` — semver tag (e.g. `25.1`); pinned in workflow YAML.
  - `ODA_PLATFORM` — `darwin-arm64` (default for the M4 runner) | `linux-amd64` | `darwin-x86_64`.
  - `ODA_CACHE_DIR` — defaults to `.oda-cache/` (already in `.gitignore`).
- **Output path:** `${ODA_CACHE_DIR}/ODAFileConverter` (executable).
- **Exit codes:** 0 = ready, 1 = download/extract failure, 2 = EULA URL drift (URL needs human update).
- **Caller:** `validate-dxf.mjs --oda-bin "$ODA_CACHE_DIR/ODAFileConverter"` (new flag).
