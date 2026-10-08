/**
 * Whole-corpus round-trip + structural validation.
 *
 * 1. Discovers every .dxf under packages/file-io/test-fixtures/
 *    (top-level legacy + nexus-authored/ + jscad/).
 * 2. For each: parseDxfFull → exportDxf → parseDxfFull.
 * 3. Writes the round-tripped output to test-fixtures/.rt-output/<group>/<name>.dxf
 *    (gitignored) so the CI dxf-validate workflow can run `python -m ezdxf
 *    audit` over the outputs.
 * 4. Asserts (a) structural shape of the export, (b) baseline of how many
 *    entities re-parse — drift here is a regression signal even before ezdxf
 *    runs.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDxfFull } from '../dxf-import.js';
import { exportDxf } from '../dxf-export.js';

const TEST_FIXTURES = join(__dirname, '../../test-fixtures');
const OUTPUT_DIR = join(TEST_FIXTURES, '.rt-output');

interface FixtureRef {
  group: string;
  name: string;
  absPath: string;
}

function listFixtures(): FixtureRef[] {
  const out: FixtureRef[] = [];
  for (const entry of readdirSync(TEST_FIXTURES)) {
    if (entry === '.rt-output') continue;
    const p = join(TEST_FIXTURES, entry);
    const st = statSync(p);
    if (st.isFile() && entry.toLowerCase().endsWith('.dxf')) {
      out.push({ group: 'legacy', name: entry, absPath: p });
    } else if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (!name.toLowerCase().endsWith('.dxf')) continue;
        out.push({ group: entry, name, absPath: join(p, name) });
      }
    }
  }
  return out.sort((a, b) =>
    a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group),
  );
}

function roundTrip(absPath: string): {
  exported: string;
  parsedCount: number;
  reparsedCount: number;
} {
  const raw = readFileSync(absPath, 'utf-8');
  const first = parseDxfFull(raw);

  const entities = first.entities.map((e, i) => ({
    id: `rt-${i}`,
    layer_id: e.layer,
    geometry: e.geometry,
    color: e.color,
    linetype: e.linetype,
  }));
  const layers = first.layers.map((l) => ({
    id: l.name,
    name: l.name,
    color: l.color || '#ffffff',
    visible: !l.frozen,
    locked: l.locked || false,
    linetype: l.linetype,
  }));

  const exported = exportDxf(JSON.stringify(entities), JSON.stringify(layers));
  const second = parseDxfFull(exported);
  return { exported, parsedCount: first.entities.length, reparsedCount: second.entities.length };
}

const fixtures = listFixtures();

// Baseline: how many entities re-parse from the round-tripped output, today.
// This pins the current behavior so future regressions in parseDxfFull or
// exportDxf surface as failing assertions instead of silent fidelity loss.
//
// Drift is allowed but must be explicit: when a fix lands that improves
// fidelity (e.g. ELLIPSE is added to the parser), update the value here in
// the same commit and reference the baseline change in the commit message.
const REPARSE_BASELINE: Record<string, number> = {
  'legacy/assimp-linetest.dxf': 1,
  'legacy/assimp-wuson.dxf': 0,
  'legacy/blocks1.dxf': 0,
  'legacy/bridge.dxf': 261,
  'legacy/dimensions.dxf': 7,
  'legacy/entities.dxf': 87,
  'legacy/ezdxf-ascii-r12.dxf': 2,
  'legacy/ezdxf-groups.dxf': 13,
  'legacy/hatches.dxf': 4,
  'jscad/circle10.dxf': 1,
  'jscad/cube.dxf': 0,
  'jscad/pyramid.dxf': 0,
  'jscad/square10x10.dxf': 1,
  'nexus-authored/arc.dxf': 1,
  'nexus-authored/circle.dxf': 1,
  'nexus-authored/dimension.dxf': 1,
  'nexus-authored/ellipse.dxf': 1,
  'nexus-authored/spline.dxf': 1,
  // hatch.dxf: vitest baseline is 0 because parseDxfFull drops the HATCH on
  // re-import. ezdxf separately reports 1 hard error against the SOURCE
  // fixture (missing R2000 AcDbEntity / AcDbHatch subclass markers in the
  // hand-authored bytes) — that's intentional for PR #1 to demonstrate the
  // validator's failure-detection path. PR #2 re-authors the fixture with
  // proper subclass markers; baseline will then likely move to 1.
  'nexus-authored/hatch.dxf': 0,
  'nexus-authored/leader.dxf': 0, // LEADER not yet supported
  'nexus-authored/line.dxf': 1,
  'nexus-authored/polyline.dxf': 1,
  'nexus-authored/ray.dxf': 1,
  'nexus-authored/rectangle.dxf': 1,
  'nexus-authored/text.dxf': 1,
  'nexus-authored/wipeout.dxf': 1,
  'nexus-authored/xline.dxf': 1,
};

describe('DXF corpus round-trip + structural validation', () => {
  beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const groups = new Set(fixtures.map((f) => f.group));
    for (const g of groups) mkdirSync(join(OUTPUT_DIR, g), { recursive: true });
  });

  it('discovers fixtures from every group', () => {
    const groups = new Set(fixtures.map((f) => f.group));
    expect(groups.has('legacy'), 'legacy group missing').toBe(true);
    expect(groups.has('nexus-authored'), 'nexus-authored group missing').toBe(true);
    expect(groups.has('jscad'), 'jscad group missing').toBe(true);
  });

  it('discovers all 14 NEXUS-authored entity-family fixtures', () => {
    const names = fixtures
      .filter((f) => f.group === 'nexus-authored')
      .map((f) => f.name)
      .sort();
    expect(names).toEqual(
      [
        'arc.dxf',
        'circle.dxf',
        'dimension.dxf',
        'ellipse.dxf',
        'hatch.dxf',
        'leader.dxf',
        'line.dxf',
        'polyline.dxf',
        'ray.dxf',
        'rectangle.dxf',
        'spline.dxf',
        'text.dxf',
        'wipeout.dxf',
        'xline.dxf',
      ].sort(),
    );
  });

  it('every fixture in REPARSE_BASELINE is discovered (and vice versa)', () => {
    const discovered = new Set(fixtures.map((f) => `${f.group}/${f.name}`));
    const baselined = new Set(Object.keys(REPARSE_BASELINE));
    expect([...discovered].sort()).toEqual([...baselined].sort());
  });

  it.each(fixtures)('$group/$name — round-trip emits a structurally-valid DXF', (f) => {
    const { exported } = roundTrip(f.absPath);
    expect(exported, 'export returned empty string').toBeTruthy();
    expect(exported).toContain('SECTION');
    expect(exported).toContain('ENDSEC');
    expect(exported).toMatch(/EOF\s*$/);
    expect(exported).toContain('ENTITIES');

    // Persist for the CI ezdxf auditor.
    const outPath = join(OUTPUT_DIR, f.group, f.name);
    writeFileSync(outPath, exported, 'utf-8');
  });

  it.each(fixtures)('$group/$name — re-parsed entity count matches baseline', (f) => {
    const { reparsedCount } = roundTrip(f.absPath);
    const key = `${f.group}/${f.name}`;
    const expected = REPARSE_BASELINE[key];
    expect(
      reparsedCount,
      `re-parse drift for ${key}: expected ${expected}, got ${reparsedCount}`,
    ).toBe(expected);
  });
});
