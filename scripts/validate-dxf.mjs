#!/usr/bin/env node
// Run ezdxf audit against every .dxf in the corpus + every round-tripped
// output produced by the dxf-corpus-validation vitest test.
//
// Exit code:
//   0  — no errors reported by ezdxf (warnings are tolerated unless --strict)
//   1  — at least one error reported, or required input is missing
//   2  — environment problem (ezdxf not installed, etc.)
//
// Usage:
//   node scripts/validate-dxf.mjs                    # default mode
//   node scripts/validate-dxf.mjs --strict           # also fail on warnings
//   node scripts/validate-dxf.mjs --advisory         # always exit 0 (CI advisory mode)
//   node scripts/validate-dxf.mjs --json output.json # write summary as JSON

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FIXTURES = join(REPO_ROOT, 'packages/file-io/test-fixtures');
const RT_OUTPUT = join(FIXTURES, '.rt-output');

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const ADVISORY = args.has('--advisory');
const JSON_FLAG_INDEX = process.argv.findIndex((a) => a === '--json');
const JSON_OUT = JSON_FLAG_INDEX > -1 ? process.argv[JSON_FLAG_INDEX + 1] : null;

// ─── ezdxf availability ─────────────────────────────────────────────────────

// Override via $EZDXF_BIN if needed; default expects `ezdxf` on PATH (e.g.
// from `uv tool install ezdxf`).
const EZDXF_BIN = process.env.EZDXF_BIN || 'ezdxf';

function checkEzdxf() {
  const r = spawnSync(EZDXF_BIN, ['--version'], { encoding: 'utf-8' });
  if (r.error || r.status !== 0) {
    console.error(`error: \`${EZDXF_BIN} --version\` failed.`);
    console.error('install with: `uv tool install ezdxf`');
    if (r.stderr) console.error(r.stderr.trim());
    process.exit(2);
  }
  return r.stdout.trim().split('\n')[0];
}

// ─── Walk the corpus ─────────────────────────────────────────────────────────

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      yield* walk(p);
    } else if (st.isFile() && entry.toLowerCase().endsWith('.dxf')) {
      yield p;
    }
  }
}

function listInputs() {
  const sources = [];
  for (const p of walk(FIXTURES)) {
    if (p.startsWith(RT_OUTPUT)) continue;
    sources.push({ kind: 'source', path: p });
  }
  for (const p of walk(RT_OUTPUT)) {
    sources.push({ kind: 'output', path: p });
  }
  return sources;
}

// ─── ezdxf audit per file ───────────────────────────────────────────────────

/**
 * Run `ezdxf audit FILE` and parse the result.
 *
 * Output shapes seen in ezdxf 1.4.x:
 *   • clean:       "No errors found in <file>"
 *   • fixes only:  "Found 0 errors, applied N fixes"
 *   • errors:      "Found N errors, applied M fixes"
 *   • crash:       Python traceback to stderr, non-zero exit
 *
 * "Fixes" are the recoverable corrections ezdxf made while loading; we count
 * them as warnings for reporting (advisory) but do not fail on them.
 */
function audit(file) {
  const r = spawnSync(EZDXF_BIN, ['audit', file], {
    encoding: 'utf-8',
    timeout: 60_000,
  });

  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const combined = stdout + '\n' + stderr;

  let errors = null;
  let warnings = 0;

  const found = combined.match(/Found\s+(\d+)\s+errors?/i);
  if (found) errors = parseInt(found[1], 10);

  const fixes = combined.match(/applied\s+(\d+)\s+fixes/i);
  if (fixes) warnings = parseInt(fixes[1], 10);

  const noErrors = /No errors found/i.test(combined);
  if (errors === null && noErrors) errors = 0;

  const crashed = /Traceback \(most recent call last\)/.test(combined);
  const notADxf = /is not a DXF file/i.test(combined);

  // ezdxf sometimes exits 0 even when it refuses to load a file — e.g. it
  // prints "is not a DXF file" and bails. Treat that as a hard error.
  if (notADxf) {
    errors = (errors ?? 0) + 1;
  }

  // If we couldn't determine errors and the run crashed or exited non-zero,
  // treat it as one hard error.
  if (errors === null) {
    errors = r.status === 0 && !crashed ? 0 : 1;
  }

  return {
    file: relative(REPO_ROOT, file),
    exit: r.status,
    crashed,
    errors,
    warnings,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ezdxfVersion = checkEzdxf();
console.log(`ezdxf: ${ezdxfVersion}`);

const inputs = listInputs();
if (inputs.length === 0) {
  console.error('error: no .dxf files found.');
  console.error(`  searched: ${relative(REPO_ROOT, FIXTURES)}/`);
  console.error(`  searched: ${relative(REPO_ROOT, RT_OUTPUT)}/`);
  console.error('  hint: run `pnpm --filter @nexus/file-io test` first to generate .rt-output');
  process.exit(1);
}

const sources = inputs.filter((i) => i.kind === 'source');
const outputs = inputs.filter((i) => i.kind === 'output');
console.log(`auditing ${sources.length} source fixtures + ${outputs.length} round-trip outputs`);

const t0 = Date.now();
const results = [];
let totalErrors = 0;
let totalWarnings = 0;

for (const { kind, path } of inputs) {
  const r = audit(path);
  r.kind = kind;
  results.push(r);
  totalErrors += r.errors;
  totalWarnings += r.warnings;
  const status = r.errors > 0 ? 'FAIL' : r.warnings > 0 ? 'WARN' : 'OK  ';
  process.stdout.write(
    `  [${status}] ${r.file.padEnd(70)} errors=${r.errors} warnings=${r.warnings}\n`,
  );
}

const elapsedMs = Date.now() - t0;

console.log('');
console.log(`Summary: ${totalErrors} errors, ${totalWarnings} warnings across ${results.length} files (${(elapsedMs / 1000).toFixed(1)}s)`);

if (JSON_OUT) {
  writeFileSync(
    JSON_OUT,
    JSON.stringify({ ezdxfVersion, totalErrors, totalWarnings, results }, null, 2),
  );
  console.log(`wrote summary: ${JSON_OUT}`);
}

// Exit policy.
if (ADVISORY) {
  if (totalErrors > 0 || (STRICT && totalWarnings > 0)) {
    console.log('(advisory mode: would have failed, exiting 0)');
  }
  process.exit(0);
}

if (totalErrors > 0) process.exit(1);
if (STRICT && totalWarnings > 0) process.exit(1);
process.exit(0);
