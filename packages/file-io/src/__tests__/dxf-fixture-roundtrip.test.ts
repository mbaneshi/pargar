import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDxfFull } from '../dxf-import.js';
import { exportDxf } from '../dxf-export.js';
import type { ImportedEntity } from '../dxf-import.js';

const FIXTURES_DIR = join(__dirname, '../../test-fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

/**
 * Import a fixture, export it, re-import, and return both passes.
 * This is the core round-trip: fixture → import → export → re-import.
 */
function roundTripFixture(name: string) {
  const dxfString = loadFixture(name);
  const firstImport = parseDxfFull(dxfString);

  // Build export-compatible entities (map layer name → layer_id)
  const exportEntities = firstImport.entities.map((e, i) => ({
    id: `rt-${i}`,
    layer_id: e.layer,
    geometry: e.geometry,
    color: e.color,
    linetype: e.linetype,
  }));
  const exportLayers = firstImport.layers.map((l) => ({
    id: l.name,
    name: l.name,
    color: l.color || '#ffffff',
    visible: !l.frozen,
    locked: l.locked || false,
    linetype: l.linetype,
  }));

  const exported = exportDxf(JSON.stringify(exportEntities), JSON.stringify(exportLayers));
  expect(exported).toBeTruthy();

  const secondImport = parseDxfFull(exported);

  return { firstImport, secondImport, exported };
}

/** Count entities by type */
function countByType(entities: ImportedEntity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entities) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return counts;
}

/** Get unique layer names from entities */
function uniqueLayers(entities: ImportedEntity[]): string[] {
  return [...new Set(entities.map((e) => e.layer))].sort();
}

const TOL = 1e-3;

function near(a: number, b: number, msg?: string) {
  expect(Math.abs(a - b), msg).toBeLessThan(TOL);
}

// ─── Fixture round-trip tests ───────────────────────────────────────────────

describe('DXF fixture round-trip', () => {
  describe('assimp-linetest.dxf — minimal single LINE', () => {
    it('entity count survives round-trip', () => {
      const { firstImport, secondImport } = roundTripFixture('assimp-linetest.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'line');
      const second = secondImport.entities.filter((e) => e.type === 'line');
      expect(second.length).toBe(first.length);
    });

    it('line geometry values survive', () => {
      const { firstImport, secondImport } = roundTripFixture('assimp-linetest.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'line');
      const second = secondImport.entities.filter((e) => e.type === 'line');

      for (let i = 0; i < first.length; i++) {
        const g1 = first[i].geometry.Line;
        const g2 = second[i].geometry.Line;
        near(g1.start.x, g2.start.x, `line ${i} start.x`);
        near(g1.start.y, g2.start.y, `line ${i} start.y`);
        near(g1.end.x, g2.end.x, `line ${i} end.x`);
        near(g1.end.y, g2.end.y, `line ${i} end.y`);
      }
    });
  });

  describe('bridge.dxf — 261 LINEs', () => {
    it('all lines survive round-trip', () => {
      const { firstImport, secondImport } = roundTripFixture('bridge.dxf');
      const firstLines = firstImport.entities.filter((e) => e.type === 'line');
      const secondLines = secondImport.entities.filter((e) => e.type === 'line');
      expect(secondLines.length).toBe(firstLines.length);
    });

    it('line coordinates are preserved', () => {
      const { firstImport, secondImport } = roundTripFixture('bridge.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'line');
      const second = secondImport.entities.filter((e) => e.type === 'line');

      // Spot-check first, middle, and last lines
      const indices = [0, Math.floor(first.length / 2), first.length - 1];
      for (const i of indices) {
        const g1 = first[i].geometry.Line;
        const g2 = second[i].geometry.Line;
        near(g1.start.x, g2.start.x, `bridge line ${i} start.x`);
        near(g1.start.y, g2.start.y, `bridge line ${i} start.y`);
        near(g1.end.x, g2.end.x, `bridge line ${i} end.x`);
        near(g1.end.y, g2.end.y, `bridge line ${i} end.y`);
      }
    });

    it('layer assignments survive', () => {
      const { firstImport, secondImport } = roundTripFixture('bridge.dxf');
      const firstLayers = uniqueLayers(firstImport.entities);
      const secondLayers = uniqueLayers(secondImport.entities);
      expect(secondLayers).toEqual(firstLayers);
    });
  });

  describe('ezdxf-groups.dxf — 13 LINEs with layers', () => {
    it('entity count survives', () => {
      const { firstImport, secondImport } = roundTripFixture('ezdxf-groups.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);
      expect(c2.line).toBe(c1.line);
    });

    it('layer table survives', () => {
      const { firstImport, secondImport } = roundTripFixture('ezdxf-groups.dxf');
      const firstNames = firstImport.layers.map((l) => l.name).sort();
      const secondNames = secondImport.layers.map((l) => l.name).sort();
      // Second import should contain all layers from first
      for (const name of firstNames) {
        expect(secondNames, `missing layer: ${name}`).toContain(name);
      }
    });
  });

  describe('ezdxf-ascii-r12.dxf — R12 format with LINE + TEXT', () => {
    it('lines and text survive round-trip', () => {
      const { firstImport, secondImport } = roundTripFixture('ezdxf-ascii-r12.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);
      expect(c2.line).toBe(c1.line);
      expect(c2.text).toBe(c1.text);
    });

    it('text content is preserved', () => {
      const { firstImport, secondImport } = roundTripFixture('ezdxf-ascii-r12.dxf');
      const firstTexts = firstImport.entities.filter((e) => e.type === 'text');
      const secondTexts = secondImport.entities.filter((e) => e.type === 'text');

      for (let i = 0; i < firstTexts.length; i++) {
        expect(secondTexts[i].geometry.Text.content).toBe(firstTexts[i].geometry.Text.content);
        near(
          secondTexts[i].geometry.Text.height,
          firstTexts[i].geometry.Text.height,
          `text ${i} height`,
        );
      }
    });
  });

  describe('blocks1.dxf — LINEs + CIRCLE (INSERT entities are unsupported, skip them)', () => {
    it('supported entity counts survive', () => {
      const { firstImport, secondImport } = roundTripFixture('blocks1.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);

      // Lines and circles should survive; INSERT entities are dropped (unsupported)
      if (c1.line) expect(c2.line).toBe(c1.line);
      if (c1.circle) expect(c2.circle).toBe(c1.circle);
    });

    it('circle geometry is preserved', () => {
      const { firstImport, secondImport } = roundTripFixture('blocks1.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'circle');
      const second = secondImport.entities.filter((e) => e.type === 'circle');

      for (let i = 0; i < first.length; i++) {
        const g1 = first[i].geometry.Circle;
        const g2 = second[i].geometry.Circle;
        near(g1.center.x, g2.center.x, `circle ${i} center.x`);
        near(g1.center.y, g2.center.y, `circle ${i} center.y`);
        near(g1.radius, g2.radius, `circle ${i} radius`);
      }
    });
  });

  describe('entities.dxf — mixed: LINE, POINT, MTEXT, ARC, CIRCLE, LWPOLYLINE', () => {
    it('supported entity type counts survive round-trip', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);

      // These types are fully supported and must round-trip
      for (const type of ['line', 'point', 'circle', 'arc', 'polyline', 'text']) {
        if (c1[type]) {
          expect(c2[type], `${type} count`).toBe(c1[type]);
        }
      }
    });

    it('arc geometry survives', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'arc');
      const second = secondImport.entities.filter((e) => e.type === 'arc');
      expect(second.length).toBe(first.length);

      for (let i = 0; i < first.length; i++) {
        const g1 = first[i].geometry.Arc;
        const g2 = second[i].geometry.Arc;
        near(g1.center.x, g2.center.x, `arc ${i} center.x`);
        near(g1.center.y, g2.center.y, `arc ${i} center.y`);
        near(g1.radius, g2.radius, `arc ${i} radius`);
        near(g1.start_angle, g2.start_angle, `arc ${i} start_angle`);
        near(g1.end_angle, g2.end_angle, `arc ${i} end_angle`);
      }
    });

    it('polyline vertex counts survive', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'polyline');
      const second = secondImport.entities.filter((e) => e.type === 'polyline');
      expect(second.length).toBe(first.length);

      for (let i = 0; i < first.length; i++) {
        const v1 = first[i].geometry.Polyline.vertices;
        const v2 = second[i].geometry.Polyline.vertices;
        expect(v2.length, `polyline ${i} vertex count`).toBe(v1.length);
        expect(second[i].geometry.Polyline.closed).toBe(first[i].geometry.Polyline.closed);
      }
    });

    it('polyline vertex coordinates survive', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'polyline');
      const second = secondImport.entities.filter((e) => e.type === 'polyline');

      for (let i = 0; i < first.length; i++) {
        const v1 = first[i].geometry.Polyline.vertices;
        const v2 = second[i].geometry.Polyline.vertices;
        for (let j = 0; j < v1.length; j++) {
          near(v1[j].x, v2[j].x, `polyline ${i} vertex ${j} x`);
          near(v1[j].y, v2[j].y, `polyline ${i} vertex ${j} y`);
        }
      }
    });

    it('point positions survive', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      const first = firstImport.entities.filter((e) => e.type === 'point');
      const second = secondImport.entities.filter((e) => e.type === 'point');
      expect(second.length).toBe(first.length);

      // Spot-check first 10 points
      const check = Math.min(10, first.length);
      for (let i = 0; i < check; i++) {
        const g1 = first[i].geometry.Point;
        const g2 = second[i].geometry.Point;
        near(g1.position.x, g2.position.x, `point ${i} x`);
        near(g1.position.y, g2.position.y, `point ${i} y`);
      }
    });

    it('layer assignments survive', () => {
      const { firstImport, secondImport } = roundTripFixture('entities.dxf');
      // Every entity's layer should survive
      for (let i = 0; i < firstImport.entities.length; i++) {
        const e1 = firstImport.entities[i];
        const e2 = secondImport.entities[i];
        if (e2) {
          expect(e2.layer, `entity ${i} layer`).toBe(e1.layer);
        }
      }
    });
  });

  describe('dimensions.dxf — LINEs + CIRCLE + MTEXT (DIMENSION entities are lossy)', () => {
    it('supported entities survive', () => {
      const { firstImport, secondImport } = roundTripFixture('dimensions.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);
      if (c1.line) expect(c2.line).toBe(c1.line);
      if (c1.circle) expect(c2.circle).toBe(c1.circle);
    });
  });

  describe('hatches.dxf — LINEs (HATCH entities are unsupported, skip them)', () => {
    it('line entities survive round-trip', () => {
      const { firstImport, secondImport } = roundTripFixture('hatches.dxf');
      const c1 = countByType(firstImport.entities);
      const c2 = countByType(secondImport.entities);
      if (c1.line) expect(c2.line).toBe(c1.line);
    });
  });

  describe('nexus-authored/ellipse.dxf — full ELLIPSE', () => {
    it('parses to a single ellipse entity', () => {
      const { firstImport } = roundTripFixture('nexus-authored/ellipse.dxf');
      const ellipses = firstImport.entities.filter((e) => e.type === 'ellipse');
      expect(ellipses.length).toBe(1);
    });

    it('round-trip preserves center, semi-axes, and rotation within GEOMETRIC_EPSILON', () => {
      const { firstImport, secondImport } = roundTripFixture('nexus-authored/ellipse.dxf');
      const e1 = firstImport.entities.find((e) => e.type === 'ellipse')!;
      const e2 = secondImport.entities.find((e) => e.type === 'ellipse')!;
      expect(e2).toBeDefined();
      const g1 = e1.geometry.Ellipse;
      const g2 = e2.geometry.Ellipse;
      const TIGHT = 1e-8;
      expect(Math.abs(g1.center.x - g2.center.x), 'center.x').toBeLessThan(TIGHT);
      expect(Math.abs(g1.center.y - g2.center.y), 'center.y').toBeLessThan(TIGHT);
      expect(Math.abs(g1.semi_major - g2.semi_major), 'semi_major').toBeLessThan(TIGHT);
      expect(Math.abs(g1.semi_minor - g2.semi_minor), 'semi_minor').toBeLessThan(TIGHT);
      expect(Math.abs(g1.rotation - g2.rotation), 'rotation').toBeLessThan(TIGHT);
    });

    it('exported DXF contains an ELLIPSE entity', () => {
      const { exported } = roundTripFixture('nexus-authored/ellipse.dxf');
      expect(exported).toMatch(/^ELLIPSE$/m);
    });
  });

  describe('nexus-authored/spline.dxf — degree-3 open SPLINE with 4 control points', () => {
    it('parses to a single spline entity', () => {
      const { firstImport } = roundTripFixture('nexus-authored/spline.dxf');
      const splines = firstImport.entities.filter((e) => e.type === 'spline');
      expect(splines.length).toBe(1);
    });

    it('round-trip preserves control points, degree, and closed-ness', () => {
      const { firstImport, secondImport } = roundTripFixture('nexus-authored/spline.dxf');
      const s1 = firstImport.entities.find((e) => e.type === 'spline')!;
      const s2 = secondImport.entities.find((e) => e.type === 'spline')!;
      expect(s2).toBeDefined();
      const g1 = s1.geometry.Spline;
      const g2 = s2.geometry.Spline;
      expect(g2.degree).toBe(g1.degree);
      expect(g2.closed).toBe(g1.closed);
      expect(g2.control_points.length).toBe(g1.control_points.length);
      const TIGHT = 1e-8;
      for (let i = 0; i < g1.control_points.length; i++) {
        expect(Math.abs(g1.control_points[i].x - g2.control_points[i].x), `cp ${i} x`).toBeLessThan(
          TIGHT,
        );
        expect(Math.abs(g1.control_points[i].y - g2.control_points[i].y), `cp ${i} y`).toBeLessThan(
          TIGHT,
        );
      }
    });

    it('exported DXF contains a SPLINE entity', () => {
      const { exported } = roundTripFixture('nexus-authored/spline.dxf');
      expect(exported).toMatch(/^SPLINE$/m);
    });
  });

  describe('nexus-authored/ray.dxf — RAY (semi-infinite from origin)', () => {
    it('parses to a single ray entity', () => {
      const { firstImport } = roundTripFixture('nexus-authored/ray.dxf');
      const rays = firstImport.entities.filter((e) => e.type === 'ray');
      expect(rays.length).toBe(1);
    });

    it('round-trip preserves origin and direction within 1e-8', () => {
      const { firstImport, secondImport } = roundTripFixture('nexus-authored/ray.dxf');
      const r1 = firstImport.entities.find((e) => e.type === 'ray')!;
      const r2 = secondImport.entities.find((e) => e.type === 'ray')!;
      expect(r2).toBeDefined();
      const TIGHT = 1e-8;
      expect(Math.abs(r1.geometry.Ray.origin.x - r2.geometry.Ray.origin.x)).toBeLessThan(TIGHT);
      expect(Math.abs(r1.geometry.Ray.origin.y - r2.geometry.Ray.origin.y)).toBeLessThan(TIGHT);
      expect(Math.abs(r1.geometry.Ray.direction.x - r2.geometry.Ray.direction.x)).toBeLessThan(
        TIGHT,
      );
      expect(Math.abs(r1.geometry.Ray.direction.y - r2.geometry.Ray.direction.y)).toBeLessThan(
        TIGHT,
      );
    });

    it('exported DXF contains a RAY entity', () => {
      const { exported } = roundTripFixture('nexus-authored/ray.dxf');
      expect(exported).toMatch(/^RAY$/m);
    });
  });

  describe('nexus-authored/xline.dxf — XLINE (infinite construction line)', () => {
    it('parses to a single construction_line entity', () => {
      const { firstImport } = roundTripFixture('nexus-authored/xline.dxf');
      const xlines = firstImport.entities.filter((e) => e.type === 'construction_line');
      expect(xlines.length).toBe(1);
    });

    it('round-trip preserves origin and direction within 1e-8', () => {
      const { firstImport, secondImport } = roundTripFixture('nexus-authored/xline.dxf');
      const x1 = firstImport.entities.find((e) => e.type === 'construction_line')!;
      const x2 = secondImport.entities.find((e) => e.type === 'construction_line')!;
      expect(x2).toBeDefined();
      const TIGHT = 1e-8;
      const g1 = x1.geometry.ConstructionLine;
      const g2 = x2.geometry.ConstructionLine;
      expect(Math.abs(g1.origin.x - g2.origin.x)).toBeLessThan(TIGHT);
      expect(Math.abs(g1.origin.y - g2.origin.y)).toBeLessThan(TIGHT);
      expect(Math.abs(g1.direction.x - g2.direction.x)).toBeLessThan(TIGHT);
      expect(Math.abs(g1.direction.y - g2.direction.y)).toBeLessThan(TIGHT);
    });

    it('exported DXF contains an XLINE entity', () => {
      const { exported } = roundTripFixture('nexus-authored/xline.dxf');
      expect(exported).toMatch(/^XLINE$/m);
    });
  });

  describe('nexus-authored/wipeout.dxf — WIPEOUT (closed quad clip boundary)', () => {
    it('parses to a single wipeout entity', () => {
      const { firstImport } = roundTripFixture('nexus-authored/wipeout.dxf');
      const wipeouts = firstImport.entities.filter((e) => e.type === 'wipeout');
      expect(wipeouts.length).toBe(1);
    });

    it('round-trip preserves boundary vertices within 1e-8', () => {
      const { firstImport, secondImport } = roundTripFixture('nexus-authored/wipeout.dxf');
      const w1 = firstImport.entities.find((e) => e.type === 'wipeout')!;
      const w2 = secondImport.entities.find((e) => e.type === 'wipeout')!;
      expect(w2).toBeDefined();
      const v1 = w1.geometry.Wipeout.vertices;
      const v2 = w2.geometry.Wipeout.vertices;
      expect(v2.length).toBe(v1.length);
      const TIGHT = 1e-8;
      for (let i = 0; i < v1.length; i++) {
        expect(Math.abs(v1[i].x - v2[i].x), `vertex ${i} x`).toBeLessThan(TIGHT);
        expect(Math.abs(v1[i].y - v2[i].y), `vertex ${i} y`).toBeLessThan(TIGHT);
      }
    });

    it('exported DXF contains a WIPEOUT entity', () => {
      const { exported } = roundTripFixture('nexus-authored/wipeout.dxf');
      expect(exported).toMatch(/^WIPEOUT$/m);
    });
  });
});

// ─── Cross-fixture structural tests ────────────────────────────────────────

describe('DXF fixture structural invariants', () => {
  const FIXTURES = [
    'assimp-linetest.dxf',
    'bridge.dxf',
    'blocks1.dxf',
    'ezdxf-ascii-r12.dxf',
    'ezdxf-groups.dxf',
    'entities.dxf',
    'dimensions.dxf',
    'hatches.dxf',
  ];

  it.each(FIXTURES)('%s — exported DXF is valid (has SECTION/ENDSEC/EOF)', (fixture) => {
    const { exported } = roundTripFixture(fixture);
    expect(exported).toContain('SECTION');
    expect(exported).toContain('ENDSEC');
    expect(exported).toMatch(/EOF\s*$/);
  });

  it.each(FIXTURES)('%s — no entity count increases after round-trip', (fixture) => {
    const { firstImport, secondImport } = roundTripFixture(fixture);
    // Total supported entities should not increase (some unsupported types are dropped)
    expect(secondImport.entities.length).toBeLessThanOrEqual(firstImport.entities.length);
  });

  it.each(FIXTURES)('%s — re-import produces non-empty result', (fixture) => {
    const { firstImport, secondImport } = roundTripFixture(fixture);
    // If we imported anything supported the first time, we should get it back
    const supportedFirst = firstImport.entities.filter((e) =>
      ['line', 'circle', 'arc', 'polyline', 'text', 'point'].includes(e.type),
    );
    if (supportedFirst.length > 0) {
      expect(secondImport.entities.length).toBeGreaterThan(0);
    }
  });

  it.each(FIXTURES)('%s — exported DXF has ENTITIES section', (fixture) => {
    const { exported } = roundTripFixture(fixture);
    const lines = exported.split('\n');
    const entitiesIdx = lines.indexOf('ENTITIES');
    expect(entitiesIdx).toBeGreaterThan(-1);
  });

  it.each(FIXTURES)('%s — double round-trip is stable (idempotent)', (fixture) => {
    const dxfString = loadFixture(fixture);
    const first = parseDxfFull(dxfString);

    // Round-trip 1
    const exp1 = exportDxf(
      JSON.stringify(
        first.entities.map((e, i) => ({
          id: `a-${i}`,
          layer_id: e.layer,
          geometry: e.geometry,
          color: e.color,
          linetype: e.linetype,
        })),
      ),
      JSON.stringify(
        first.layers.map((l) => ({
          id: l.name,
          name: l.name,
          color: l.color || '#ffffff',
          visible: !l.frozen,
          locked: l.locked || false,
          linetype: l.linetype,
        })),
      ),
    );
    const second = parseDxfFull(exp1);

    // Round-trip 2
    const exp2 = exportDxf(
      JSON.stringify(
        second.entities.map((e, i) => ({
          id: `b-${i}`,
          layer_id: e.layer,
          geometry: e.geometry,
          color: e.color,
          linetype: e.linetype,
        })),
      ),
      JSON.stringify(
        second.layers.map((l) => ({
          id: l.name,
          name: l.name,
          color: l.color || '#ffffff',
          visible: !l.frozen,
          locked: l.locked || false,
          linetype: l.linetype,
        })),
      ),
    );
    const third = parseDxfFull(exp2);

    // After the first lossy pass (unsupported entities dropped), counts must stabilize
    const c2 = countByType(second.entities);
    const c3 = countByType(third.entities);
    expect(c3).toEqual(c2);
  });
});

// ─── Layer color round-trip tests ──────────────────────────────────────────

describe('DXF fixture layer colors', () => {
  it('entities.dxf — layer colors survive round-trip', () => {
    const { firstImport, secondImport } = roundTripFixture('entities.dxf');

    const firstLayerColors = new Map(firstImport.layers.map((l) => [l.name, l.color]));
    const secondLayerColors = new Map(secondImport.layers.map((l) => [l.name, l.color]));

    for (const [name, color] of firstLayerColors) {
      if (color && secondLayerColors.has(name)) {
        expect(secondLayerColors.get(name), `layer ${name} color`).toBe(color);
      }
    }
  });

  it('ezdxf-groups.dxf — layer colors survive round-trip', () => {
    const { firstImport, secondImport } = roundTripFixture('ezdxf-groups.dxf');

    const firstLayerColors = new Map(firstImport.layers.map((l) => [l.name, l.color]));
    const secondLayerColors = new Map(secondImport.layers.map((l) => [l.name, l.color]));

    for (const [name, color] of firstLayerColors) {
      if (color && secondLayerColors.has(name)) {
        expect(secondLayerColors.get(name), `layer ${name} color`).toBe(color);
      }
    }
  });
});
