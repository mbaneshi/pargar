# `pnpm gate` — production deploy gate

## Contract

> Before any `firebase deploy --only hosting`, `pnpm gate` must return exit code 0. If it doesn't, deploy is blocked.

That's the only invariant. If the gate fails, fix the failing spec or fix the bug it surfaces — never bypass.

## What it does

1. Force-rebuilds the prod bundle (`pnpm exec turbo build --force`) so the gate runs against fresh local artifacts. (`turbo build` alone can mark the build cached without restoring `packages/app/build/` into the current worktree — the `--force` is load-bearing.)
2. Verifies `packages/app/build/index.html` exists.
3. Starts `sirv-cli` on `:4173` (matches `playwright.config.ts` webServer).
4. Polls `:4173` until it responds (max 30s).
5. Runs each gate spec in **its own Playwright invocation** with `BASE_URL=http://localhost:4173`. Isolation is the whole point — see `docs/audit/213-triage.md` for why.
6. Tears down the preview cleanly on success, failure, or signal.
7. Exits 0 if all 10 specs pass; 1 with a clear per-spec message otherwise.

Total runtime ~2 min on a quiet machine (~60s build + ~50s test execution + ~10s startup/teardown).

## The 10 gate specs

Curated from the `213-triage.md` sample — every spec verified passing in both prod and dev when run in isolation. Span the five most user-impactful clusters.

| # | Spec | Cluster | Why this one |
|---|------|---------|--------------|
| 1 | `e2e/snap-system.spec.ts:42` | snap | `snap-intersection-crossing-lines` — protects #87/#83 fix |
| 2 | `e2e/snap-system.spec.ts:65` | snap | `snap-center-on-circle` — exercises non-line snap targets |
| 3 | `e2e/selection-grips.spec.ts:35` | grips | First-grip activation happy path |
| 4 | `e2e/selection-grips.spec.ts:102` | grips | `crossing-selection-right-to-left` — protects #96 fix |
| 5 | `e2e/shortcuts.spec.ts:42` | shortcuts | `F2-zoom-extents` — function key + viewport command |
| 6 | `e2e/shortcuts.spec.ts:50` | shortcuts | `F3-toggles-osnap` — sysvar toggle via keyboard |
| 7 | `e2e/modify-tools.spec.ts:13` | modify | First modify-tool happy path |
| 8 | `e2e/modify-tools.spec.ts:54` | modify | Second modify-tool happy path (different command) |
| 9 | `e2e/autocad-parity.spec.ts:20` | parity | Top-level parity surface — ribbon present |
| 10 | `e2e/parity/all-commands.spec.ts -g 'alias "REC" starts RECTANG'` | parity | Command + alias resolution end-to-end |

## How to run

```bash
pnpm gate
```

Expected output on success:

```
gate: building prod bundle (--force, ~60s)...
gate: starting sirv on :4173...
gate: preview ready, running 10 specs in isolation

  e2e/snap-system.spec.ts:42 ... PASS
  ... (10 lines)

gate PASS — 10/10 specs green, deploy is unblocked.
```

Exit code: `0` on success, `1` on any failure (build error, preview start error, or any spec failure).

## When the gate fails

Each failing spec is named with the exact command to reproduce:

```
✗ e2e/<spec>:<line>  <name>
  For full output, run:
    pnpm exec playwright test e2e/<spec>:<line>
```

Triage path:

1. Re-run the failing spec in isolation with the command above. Did it fail again?
2. If **yes**: there's a real regression. Fix the bug, re-run `pnpm gate`, ship.
3. If **no** (passes second time): you've found a flake the gate isn't isolating well — escalate to lead. Likely fix is to run that spec twice in the gate and require both to pass, or swap it for a same-cluster substitute that's more stable.

Don't bypass the gate. If you genuinely need to ship despite a gate failure (e.g., hotfix unrelated to the failing area), document the override in the deploy commit message and file a follow-up issue.

## Maintenance

### Adding a spec to the gate

The gate is intentionally small (10 specs). Adding more increases runtime and dilutes the signal. Only add when:

- A previously-untested user-impactful flow needs coverage, AND
- The candidate spec passes isolated against both prod and dev (verify via `BASE_URL=http://localhost:5173 pnpm exec playwright test <spec>`), AND
- Lead has approved the addition.

Edit the `GATE_SPECS` array in `scripts/deploy-gate.mjs`. Update the table above to match.

### Removing a spec from the gate

If a gate spec becomes flaky (fails on re-run isolated), remove it and replace with a same-cluster spec that's stable. Don't shrink the gate below 10. The minimum coverage of the five clusters (snap / grips / shortcuts / modify / parity) is non-negotiable.

### Re-seeding from scratch

If multiple gate specs fail simultaneously (suggests a major regression), don't reseed reactively. The signal is doing its job — fix the regression. Reseeding is only justified when the underlying user flows have changed (e.g., a UI rewrite renames widgets), not when the app has bugs.

For a methodical reseed, repeat the methodology in `docs/audit/213-triage.md`: sample, verify isolated-pass in both environments, pick the most user-impactful from the stable set.
