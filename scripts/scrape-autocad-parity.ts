import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllForKind, PoliteFetcher } from './parity/scraper';
import {
  crossWalkCommand,
  crossWalkSysvar,
  parseKernelCommandVariantsWithLines,
  parseKernelSysvarsWithLines,
} from './parity/cross-walk';
import { emitCsv, type MatrixRow } from './parity/csv';
import type { ParityEntry } from './parity/parser';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = resolve(REPO_ROOT, '.cache', 'autocad-parity', 'api');
const CSV_PATH = resolve(REPO_ROOT, 'docs', 'parity-matrix.csv');
const COMMANDS_RS = resolve(REPO_ROOT, 'packages', 'kernel', 'src', 'commands.rs');
const SYSVARS_RS = resolve(REPO_ROOT, 'packages', 'kernel', 'src', 'sysvars.rs');

// Floors below which the kernel-source parsers have almost certainly silently
// broken (e.g. a file moved or was reformatted). Better to fail the scrape loudly
// than to emit a matrix that wrongly reports everything as unimplemented (#68).
const MIN_COMMAND_VARIANTS = 50;
const MIN_SYSVARS = 5;

interface RunOptions {
  refresh: boolean;
}

function parseArgs(argv: string[]): RunOptions {
  return { refresh: argv.includes('--refresh') };
}

function docUrl(guid: string): string {
  return `https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/${guid}.htm`;
}

async function main() {
  const opts = parseArgs(process.argv);
  const start = Date.now();

  console.log(`📂 Cache: ${CACHE_DIR}${opts.refresh ? ' (REFRESH)' : ''}`);

  const fetcher = new PoliteFetcher({
    cacheDir: CACHE_DIR,
    refresh: opts.refresh,
  });

  console.log('⏳ Reading kernel sources for cross-walk...');
  const [commandsSrc, sysvarsSrc] = await Promise.all([
    readFile(COMMANDS_RS, 'utf-8'),
    readFile(SYSVARS_RS, 'utf-8'),
  ]);
  const variantsList = parseKernelCommandVariantsWithLines(commandsSrc);
  const variantLines = new Map(variantsList.map((v) => [v.name, v.line]));
  const sysvarsList = parseKernelSysvarsWithLines(sysvarsSrc);
  const sysvarLines = new Map(sysvarsList.map((v) => [v.name, v.line]));
  console.log(
    `   kernel: ${variantLines.size} command variants, ${sysvarLines.size} sysvars`,
  );

  if (variantLines.size < MIN_COMMAND_VARIANTS) {
    throw new Error(
      `Parsed only ${variantLines.size} command variants from ${COMMANDS_RS} ` +
        `(expected ≥ ${MIN_COMMAND_VARIANTS}). The kernel parser has likely broken ` +
        `against a moved or reformatted source — refusing to emit a bogus matrix.`,
    );
  }
  if (sysvarLines.size < MIN_SYSVARS) {
    throw new Error(
      `Parsed only ${sysvarLines.size} sysvars from ${SYSVARS_RS} ` +
        `(expected ≥ ${MIN_SYSVARS}). The sysvar parser has likely broken — ` +
        `refusing to emit a bogus matrix.`,
    );
  }

  console.log('🌐 Fetching AutoCAD 2026 commands from Autodesk help search API...');
  const commandsRaw = await fetchAllForKind(fetcher, 'command', (m) =>
    console.log(m),
  );
  console.log('🌐 Fetching AutoCAD 2026 system variables...');
  const sysvarsRaw = await fetchAllForKind(fetcher, 'sysvar', (m) =>
    console.log(m),
  );

  const rows: MatrixRow[] = [];
  for (const entry of commandsRaw) {
    const cw = crossWalkCommand(entry.name, variantLines);
    rows.push(toRow(entry, '', cw));
  }
  for (const entry of sysvarsRaw) {
    const cw = crossWalkSysvar(entry.name, sysvarLines);
    rows.push(toRow(entry, '', cw));
  }

  const csv = emitCsv(rows);
  await mkdir(dirname(CSV_PATH), { recursive: true });
  await writeFile(CSV_PATH, csv, 'utf-8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Wrote ${rows.length} rows to ${CSV_PATH} in ${elapsed}s`);
  console.log(`   cache hits: ${fetcher.hits}, misses: ${fetcher.misses}`);
  console.log(summarize(rows));
}

function toRow(
  entry: ParityEntry,
  category: string,
  cw: ReturnType<typeof crossWalkCommand>,
): MatrixRow {
  return {
    kind: entry.kind,
    name: entry.name,
    category,
    autocad_doc_url: docUrl(entry.guid),
    nexus_implemented: cw.nexus_implemented,
    nexus_source: cw.nexus_source,
    notes: cw.notes || entry.description,
  };
}

function summarize(rows: MatrixRow[]): string {
  const byKindAndStatus = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.kind}/${r.nexus_implemented}`;
    byKindAndStatus.set(key, (byKindAndStatus.get(key) ?? 0) + 1);
  }
  const lines = ['📊 Coverage summary:'];
  for (const [k, v] of [...byKindAndStatus.entries()].sort()) {
    lines.push(`   ${k.padEnd(20)} ${v}`);
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
