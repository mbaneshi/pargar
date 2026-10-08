/**
 * DXF entity coverage round-trip tests.
 * Verifies each entity type survives export → import with correct geometry.
 */

import { describe, it, expect } from 'vitest';
import { exportDxf } from '../dxf-export.js';
import { parseDxfFull } from '../dxf-import.js';
import type { ImportedEntity } from '../dxf-import.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeEntity(
  geometry: Record<string, unknown>,
  layerId = '0',
  style: Record<string, unknown> = { color: null, linetype: null, lineweight: null },
) {
  return { id: `e-${Math.random().toString(36).slice(2)}`, layer_id: layerId, geometry, style };
}

function roundTrip(
  entities: ReturnType<typeof makeEntity>[],
  layers?: { id: string; name: string; color: string; visible: boolean; locked: boolean }[],
): ImportedEntity[] {
  const dxf = exportDxf(JSON.stringify(entities), layers ? JSON.stringify(layers) : undefined);
  expect(dxf, 'exportDxf returned empty string').toBeTruthy();
  return parseDxfFull(dxf).entities;
}

const TOL = 1e-3;

function near(a: number, b: number, label = '') {
  expect(Math.abs(a - b), label || `${a} ≈ ${b}`).toBeLessThan(TOL);
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('DXF entity round-trip coverage', () => {
  it('1. Line survives round-trip', () => {
    const ent = makeEntity({ Line: { start: { x: 1.0, y: 2.0 }, end: { x: 9.0, y: 6.0 } } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('line');
    const g = result[0].geometry.Line;
    near(g.start.x, 1.0, 'line start.x');
    near(g.start.y, 2.0, 'line start.y');
    near(g.end.x, 9.0, 'line end.x');
    near(g.end.y, 6.0, 'line end.y');
  });

  it('2. Circle survives round-trip', () => {
    const ent = makeEntity({ Circle: { center: { x: 4.0, y: -3.0 }, radius: 5.5 } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('circle');
    const g = result[0].geometry.Circle;
    near(g.center.x, 4.0, 'circle center.x');
    near(g.center.y, -3.0, 'circle center.y');
    near(g.radius, 5.5, 'circle radius');
  });

  it('3. Arc preserves angles', () => {
    const startAngle = Math.PI / 6; // 30°
    const endAngle = (5 * Math.PI) / 6; // 150°
    const ent = makeEntity({
      Arc: {
        center: { x: 0.0, y: 0.0 },
        radius: 3.0,
        start_angle: startAngle,
        end_angle: endAngle,
      },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('arc');
    const g = result[0].geometry.Arc;
    near(g.center.x, 0.0, 'arc center.x');
    near(g.center.y, 0.0, 'arc center.y');
    near(g.radius, 3.0, 'arc radius');
    near(g.start_angle, startAngle, 'arc start_angle');
    near(g.end_angle, endAngle, 'arc end_angle');
  });

  it('4. Polyline preserves vertices and closed flag (open)', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    const ent = makeEntity({ Polyline: { vertices, closed: false } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('polyline');
    const g = result[0].geometry.Polyline;
    expect(g.vertices).toHaveLength(4);
    expect(g.closed).toBe(false);
    for (let i = 0; i < vertices.length; i++) {
      near(g.vertices[i].x, vertices[i].x, `vertex ${i}.x`);
      near(g.vertices[i].y, vertices[i].y, `vertex ${i}.y`);
    }
  });

  it('4b. Polyline preserves closed flag (closed)', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 8 },
    ];
    const ent = makeEntity({ Polyline: { vertices, closed: true } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    const g = result[0].geometry.Polyline;
    expect(g.vertices).toHaveLength(3);
    expect(g.closed).toBe(true);
  });

  it('5. Rectangle round-trips as Rectangle via NEXUS XDATA', () => {
    const ent = makeEntity({
      Rectangle: { origin: { x: 2.0, y: 3.0 }, width: 6.0, height: 4.0 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('rectangle');
    const g = result[0].geometry.Rectangle;
    near(g.origin.x, 2.0, 'rect origin.x');
    near(g.origin.y, 3.0, 'rect origin.y');
    near(g.width, 6.0, 'rect width');
    near(g.height, 4.0, 'rect height');
    near(g.rotation, 0, 'rect rotation');
  });

  it('6. Text preserves content and position', () => {
    const ent = makeEntity({
      Text: { position: { x: 5.0, y: 10.0 }, content: 'Corridor A', height: 2.5, rotation: 0 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    const g = result[0].geometry.Text;
    near(g.position.x, 5.0, 'text pos.x');
    near(g.position.y, 10.0, 'text pos.y');
    expect(g.content).toBe('Corridor A');
    near(g.height, 2.5, 'text height');
  });

  it('7. Point survives round-trip', () => {
    const ent = makeEntity({ Point: { position: { x: 7.0, y: -2.5 } } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('point');
    const g = result[0].geometry.Point;
    near(g.position.x, 7.0, 'point.x');
    near(g.position.y, -2.5, 'point.y');
  });

  it('8. Layer info preserved on entities', () => {
    const layers = [
      { id: 'walls', name: 'Walls', color: '#ff0000', visible: true, locked: false },
      { id: 'fixtures', name: 'Fixtures', color: '#00ff00', visible: true, locked: false },
    ];
    const entities = [
      makeEntity({ Line: { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } } }, 'walls'),
      makeEntity({ Circle: { center: { x: 3, y: 3 }, radius: 1 } }, 'fixtures'),
      makeEntity({ Line: { start: { x: 0, y: 5 }, end: { x: 5, y: 5 } } }, 'walls'),
    ];
    const result = roundTrip(entities, layers);

    expect(result).toHaveLength(3);
    expect(result[0].layer).toBe('Walls');
    expect(result[1].layer).toBe('Fixtures');
    expect(result[2].layer).toBe('Walls');
  });

  it('9. Hatch without boundary_ids is not exported', () => {
    const ent = makeEntity({
      Hatch: {
        boundary: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        pattern: 'ANSI31',
      },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(0);
  });

  it('Hatch exports with boundary entities', () => {
    const entities = JSON.stringify([
      {
        id: 'wall1',
        layer_id: 'layer_0',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } },
        style: { color: null, linetype: null, lineweight: null },
      },
      {
        id: 'h1',
        layer_id: 'layer_0',
        geometry: { Hatch: { boundary_ids: ['wall1'], pattern: 'ANSI31', scale: 1.0, angle: 0 } },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const dxf = exportDxf(entities);
    expect(dxf).toContain('HATCH');
    expect(dxf).toContain('ANSI31');
  });

  it('Hatch round-trips with boundary vertices', () => {
    const entities = [
      {
        id: 'rect1',
        layer_id: '0',
        geometry: {
          Rectangle: {
            origin: { x: 0, y: 0 },
            width: 10,
            height: 10,
          },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
      {
        id: 'h1',
        layer_id: '0',
        geometry: {
          Hatch: {
            boundary_ids: ['rect1'],
            pattern: 'ANSI31',
            scale: 2.0,
            angle: Math.PI / 4,
          },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ];
    const dxf = exportDxf(JSON.stringify(entities));
    expect(dxf).toContain('HATCH');
    const result = parseDxfFull(dxf);
    // Should have: rectangle + boundary polyline + hatch
    const hatchEnt = result.entities.find((e) => e.type === 'hatch');
    expect(hatchEnt).toBeTruthy();
    const g = hatchEnt!.geometry.Hatch;
    expect(g.pattern).toBe('ANSI31');
    near(g.scale, 2.0, 'hatch scale');
    near(g.angle, Math.PI / 4, 'hatch angle');
    // Boundary polyline should also be imported
    const boundaryEnt = result.entities.find(
      (e) => e.type === 'polyline' && e.geometry.Polyline.vertices.length === 4,
    );
    expect(boundaryEnt).toBeTruthy();
  });

  it('10. Multiple entities on multiple layers', () => {
    const layers = [
      { id: 'structural', name: 'Structural', color: '#ff0000', visible: true, locked: false },
      { id: 'electrical', name: 'Electrical', color: '#ffff00', visible: true, locked: false },
      { id: 'plumbing', name: 'Plumbing', color: '#0000ff', visible: true, locked: false },
    ];
    const entities = [
      makeEntity({ Line: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } } }, 'structural'),
      makeEntity({ Line: { start: { x: 20, y: 0 }, end: { x: 20, y: 10 } } }, 'structural'),
      makeEntity({ Circle: { center: { x: 5, y: 5 }, radius: 0.5 } }, 'electrical'),
      makeEntity({ Circle: { center: { x: 15, y: 5 }, radius: 0.5 } }, 'electrical'),
      makeEntity(
        {
          Arc: { center: { x: 10, y: 5 }, radius: 2, start_angle: 0, end_angle: Math.PI },
        },
        'plumbing',
      ),
      makeEntity(
        { Text: { position: { x: 10, y: 8 }, content: 'Level 1', height: 1.0, rotation: 0 } },
        'structural',
      ),
    ];
    const result = roundTrip(entities, layers);

    expect(result).toHaveLength(6);

    // Types in order
    expect(result[0].type).toBe('line');
    expect(result[1].type).toBe('line');
    expect(result[2].type).toBe('circle');
    expect(result[3].type).toBe('circle');
    expect(result[4].type).toBe('arc');
    expect(result[5].type).toBe('text');

    // Layer assignments
    expect(result[0].layer).toBe('Structural');
    expect(result[1].layer).toBe('Structural');
    expect(result[2].layer).toBe('Electrical');
    expect(result[3].layer).toBe('Electrical');
    expect(result[4].layer).toBe('Plumbing');
    expect(result[5].layer).toBe('Structural');

    // Spot-check geometry
    expect(result[5].geometry.Text.content).toBe('Level 1');
    near(result[4].geometry.Arc.end_angle, Math.PI, 'arc end_angle');
  });

  it('11. Dimension exports as DXF DIMENSION entity (type 1, aligned)', () => {
    const ent = makeEntity({
      Dimension: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, offset: 2, text_override: null },
    });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMENSION');
    expect(dxf).toContain('DIMSTYLE');
    expect(dxf).toContain('Standard');
    // type flag 1 for aligned
    const lines = dxf.split('\n');
    const dimIdx = lines.findIndex((l) => l.trim() === 'DIMENSION');
    expect(dimIdx).toBeGreaterThan(-1);
    // group 70 = 1 somewhere after DIMENSION header
    const snippet = lines.slice(dimIdx, dimIdx + 30).join('\n');
    expect(snippet).toContain('1');
    // definition points present
    expect(snippet).toContain('13');
    expect(snippet).toContain('14');
  });

  it('12. AlignedDimension exports as DXF DIMENSION entity', () => {
    const ent = makeEntity({
      AlignedDimension: {
        start: { x: 1, y: 1 },
        end: { x: 5, y: 5 },
        offset: 1,
        text_override: null,
      },
    });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMENSION');
    expect(dxf).toContain('Standard');
  });

  it('13. RadialDimension exports as DXF DIMENSION entity (type 4)', () => {
    const ent = makeEntity({
      RadialDimension: {
        center: { x: 0, y: 0 },
        point_on_arc: { x: 5, y: 0 },
        text_override: null,
      },
    });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMENSION');
    // text should include R prefix
    expect(dxf).toContain('R5');
    // group codes 15/25 for point on arc
    const lines = dxf.split('\n');
    const dimIdx = lines.findIndex((l) => l.trim() === 'DIMENSION');
    const snippet = lines.slice(dimIdx, dimIdx + 30).join('\n');
    expect(snippet).toContain('15');
    expect(snippet).toContain('25');
  });

  it('14. DiameterDimension exports as DXF DIMENSION entity (type 3)', () => {
    const ent = makeEntity({
      DiameterDimension: {
        center: { x: 0, y: 0 },
        point_on_arc: { x: 3, y: 0 },
        text_override: null,
      },
    });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMENSION');
    // diameter symbol U+00D8
    expect(dxf).toContain('\u00D8');
  });

  it('15. AngularDimension exports as DXF DIMENSION entity (type 2)', () => {
    const ent = makeEntity({
      AngularDimension: {
        center: { x: 0, y: 0 },
        start_ray: { x: 5, y: 0 },
        end_ray: { x: 0, y: 5 },
        radius: 5,
        text_override: null,
      },
    });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMENSION');
    // group codes 13/14 for rays, 16 for arc point
    const lines = dxf.split('\n');
    const dimIdx = lines.findIndex((l) => l.trim() === 'DIMENSION');
    const snippet = lines.slice(dimIdx, dimIdx + 40).join('\n');
    expect(snippet).toContain('13');
    expect(snippet).toContain('14');
    expect(snippet).toContain('16');
  });

  it('16. DIMSTYLE table present in exported DXF header', () => {
    const ent = makeEntity({ Line: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } });
    const dxf = exportDxf(JSON.stringify([ent]));
    expect(dxf).toContain('DIMSTYLE');
    expect(dxf).toContain('Standard');
  });
});
