#!/usr/bin/env node
/**
 * `pnpm gate` — deploy gate.
 *
 * Contract: before any production deploy, this script must exit 0. The full
 * Playwright suite has ~250 ambient flake-when-bundled failures (see
 * docs/audit/213-triage.md); this gate runs only 10 critical specs, each in
 * its own Playwright invocation so suite-state contamination cannot creep in.
 *
 * Steps:
 *   1. Build the prod bundle.
 *   2. Start sirv on :4173 (matches playwright.config.ts webServer).
 *   3. Poll until :4173 responds (max 30s).
 *   4. Run each gate spec in a fresh `pnpm exec playwright test` invocation.
 *   5. Tear down the preview cleanly on success OR failure OR signal.
 *   6. Exit 0 if all pass, 1 otherwise.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4173;
const BUILD_DIR = 'packages/app/build';

/** [specPath, friendlyName, optional --grep filter] */
const GATE_SPECS = [
  ['e2e/snap-system.spec.ts:42', 'snap-intersection-crossing-lines (protects #87/#83)'],
  ['e2e/snap-system.spec.ts:65', 'snap-center-on-circle'],
  ['e2e/selection-grips.spec.ts:35', 'selection-grips first-grip activation'],
  ['e2e/selection-grips.spec.ts:102', 'crossing-selection-right-to-left (protects #96)'],
  ['e2e/shortcuts.spec.ts:42', 'F2-zoom-extents'],
  ['e2e/shortcuts.spec.ts:50', 'F3-toggles-osnap'],
  ['e2e/modify-tools.spec.ts:13', 'modify-tools first happy path'],
  ['e2e/modify-tools.spec.ts:54', 'modify-tools second happy path'],
  ['e2e/autocad-parity.spec.ts:20', 'autocad-parity top-level surface'],
  [
    'e2e/parity/all-commands.spec.ts',
    'RECTANG parity > alias "REC" starts RECTANG',
    'alias "REC" starts RECTANG',
  ],
];

let preview = null;

function teardown() {
  if (preview && !preview.killed) {
    try {
      preview.kill('SIGTERM');
    } catch {
      // ignore — process may already be gone
    }
  }
}

process.on('SIGINT', () => {
  teardown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  teardown();
  process.exit(143);
});

async function waitReady(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      // not yet — keep polling
    }
    await sleep(500);
  }
  throw new Error(`preview did not become ready on :${PORT} within ${maxMs}ms`);
}

function runSpec([specPath, name, grepFilter]) {
  const args = ['exec', 'playwright', 'test', specPath, '--reporter=list'];
  if (grepFilter) {
    args.push('-g', grepFilter);
  }
  const r = spawnSync('pnpm', args, {
    stdio: 'pipe',
    encoding: 'utf-8',
    env: { ...process.env, BASE_URL: `http://localhost:${PORT}` },
  });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}

async function main() {
  // 1. Build — force-rebuild because turbo's shared-worktree cache can mark
  // the build "cached" without restoring `packages/app/build/` into this
  // worktree. The gate must verify against actual local artifacts.
  console.log('gate: building prod bundle (--force, ~60s)...');
  const build = spawnSync('pnpm', ['exec', 'turbo', 'build', '--force'], { stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('\ngate FAIL: build failed (exit ' + build.status + ')');
    process.exit(1);
  }
  if (!existsSync(`${BUILD_DIR}/index.html`)) {
    console.error(`\ngate FAIL: build succeeded but ${BUILD_DIR}/index.html is missing`);
    process.exit(1);
  }

  // 2. Start preview
  console.log(`gate: starting sirv on :${PORT}...`);
  preview = spawn(
    'npx',
    ['sirv-cli', BUILD_DIR, '--port', String(PORT), '--single', '--quiet'],
    { stdio: 'pipe' },
  );
  preview.on('error', (err) => {
    console.error('gate: preview process error:', err.message);
  });

  // 3. Poll readiness
  try {
    await waitReady();
  } catch (e) {
    teardown();
    console.error(`\ngate FAIL: ${e.message}`);
    process.exit(1);
  }
  console.log('gate: preview ready, running 10 specs in isolation\n');

  // 4. Run each spec in its own Playwright invocation
  const failures = [];
  for (const entry of GATE_SPECS) {
    const [specPath, name] = entry;
    process.stdout.write(`  ${specPath.padEnd(48)}  ${name.slice(0, 42).padEnd(42)} `);
    const r = runSpec(entry);
    if (r.ok) {
      console.log('PASS');
    } else {
      console.log('FAIL');
      failures.push({ specPath, name, stdout: r.stdout, stderr: r.stderr });
    }
  }

  // 5. Teardown
  teardown();
  await sleep(300); // let it shut down

  // 6. Result
  if (failures.length === 0) {
    console.log('\ngate PASS — 10/10 specs green, deploy is unblocked.');
    process.exit(0);
  }
  console.error(`\ngate FAIL — ${failures.length}/${GATE_SPECS.length} specs failed:`);
  for (const f of failures) {
    console.error(`\n  ✗ ${f.specPath}  ${f.name}`);
    console.error(`    For full output, run:`);
    console.error(`      pnpm exec playwright test ${f.specPath}`);
  }
  console.error('\nDeploy is BLOCKED until all gate specs pass.');
  process.exit(1);
}

main().catch((err) => {
  teardown();
  console.error('gate FAIL: unexpected error:', err);
  process.exit(1);
});
