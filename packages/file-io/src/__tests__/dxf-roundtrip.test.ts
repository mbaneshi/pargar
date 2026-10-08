import { describe, it, expect } from 'vitest';
import { exportDxf } from '../dxf-export.js';
import { parseDxf } from '../dxf-import.js';

function makeEntity(geometry: Record<string, unknown>, layerId = 'default') {
  return { id: 'test-1', layer_id: layerId, geometry };
}

function roundTrip(entities: ReturnType<typeof makeEntity>[], layers?: Record<string, unknown>[]) {
  const entJson = JSON.stringify(entities);
  const layJson = layers ? JSON.stringify(layers) : undefined;
  const dxf = exportDxf(entJson, layJson);
  expect(dxf).toBeTruthy();
  return parseDxf(dxf);
}

const TOL = 1e-3;

function near(a: number, b: number) {
  expect(Math.abs(a - b)).toBeLessThan(TOL);
}

describe('DXF round-trip', () => {
  it('1. single line — start/end coordinates survive', () => {
    const ent = makeEntity({
      Line: { start: { x: 1.5, y: 2.3 }, end: { x: 10.7, y: -4.2 } },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('line');
    const g = result[0].geometry.Line;
    near(g.start.x, 1.5);
    near(g.start.y, 2.3);
    near(g.end.x, 10.7);
    near(g.end.y, -4.2);
  });

  it('2. single circle — center + radius survive', () => {
    const ent = makeEntity({
      Circle: { center: { x: 5.0, y: -3.0 }, radius: 7.25 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('circle');
    const g = result[0].geometry.Circle;
    near(g.center.x, 5.0);
    near(g.center.y, -3.0);
    near(g.radius, 7.25);
  });

  it('3. single arc — center, radius, start_angle, end_angle survive', () => {
    const startAngle = Math.PI / 4; // 45 degrees
    const endAngle = (3 * Math.PI) / 4; // 135 degrees
    const ent = makeEntity({
      Arc: {
        center: { x: 2.0, y: 3.0 },
        radius: 4.0,
        start_angle: startAngle,
        end_angle: endAngle,
      },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('arc');
    const g = result[0].geometry.Arc;
    near(g.center.x, 2.0);
    near(g.center.y, 3.0);
    near(g.radius, 4.0);
    near(g.start_angle, startAngle);
    near(g.end_angle, endAngle);
  });

  it('4. rectangle — round-trips as Rectangle via XDATA', () => {
    const ent = makeEntity({
      Rectangle: { origin: { x: 1.0, y: 2.0 }, width: 8.0, height: 5.0 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('rectangle');
    const g = result[0].geometry.Rectangle;
    near(g.origin.x, 1.0);
    near(g.origin.y, 2.0);
    near(g.width, 8.0);
    near(g.height, 5.0);
    near(g.rotation, 0);
  });

  it('4b. rectangle with rotation — round-trips via XDATA', () => {
    const ent = makeEntity({
      Rectangle: { origin: { x: 3.0, y: 4.0 }, width: 10.0, height: 6.0, rotation: Math.PI / 4 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('rectangle');
    const g = result[0].geometry.Rectangle;
    near(g.origin.x, 3.0);
    near(g.origin.y, 4.0);
    near(g.width, 10.0);
    near(g.height, 6.0);
    near(g.rotation, Math.PI / 4);
  });

  it('5. polyline (open) — all vertices survive', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
      { x: 10, y: 3 },
    ];
    const ent = makeEntity({ Polyline: { vertices, closed: false } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('polyline');
    const g = result[0].geometry.Polyline;
    expect(g.vertices).toHaveLength(4);
    expect(g.closed).toBe(false);
    for (let i = 0; i < vertices.length; i++) {
      near(g.vertices[i].x, vertices[i].x);
      near(g.vertices[i].y, vertices[i].y);
    }
  });

  it('6. polyline (closed) — vertices + closed flag survive', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const ent = makeEntity({ Polyline: { vertices, closed: true } });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    const g = result[0].geometry.Polyline;
    expect(g.vertices).toHaveLength(3);
    expect(g.closed).toBe(true);
  });

  it('7. text entity — position, content, height survive', () => {
    const ent = makeEntity({
      Text: { position: { x: 3.0, y: 7.0 }, content: 'Room 101', height: 2.5, rotation: 0 },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    const g = result[0].geometry.Text;
    near(g.position.x, 3.0);
    near(g.position.y, 7.0);
    expect(g.content).toBe('Room 101');
    near(g.height, 2.5);
  });

  it('8. multiple entities on different layers — layer assignment survives', () => {
    const layers = [
      { id: 'walls', name: 'Walls', color: '#ff0000', visible: true, locked: false },
      { id: 'doors', name: 'Doors', color: '#00ff00', visible: true, locked: false },
    ];
    const entities = [
      {
        id: 'e1',
        layer_id: 'walls',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } },
      },
      { id: 'e2', layer_id: 'doors', geometry: { Circle: { center: { x: 5, y: 5 }, radius: 1 } } },
      {
        id: 'e3',
        layer_id: 'walls',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } } },
      },
    ];
    const result = roundTrip(entities, layers);

    expect(result).toHaveLength(3);
    expect(result[0].layer).toBe('Walls');
    expect(result[1].layer).toBe('Doors');
    expect(result[2].layer).toBe('Walls');
  });

  it('9. mixed drawing — lines + circles + arcs + polylines + text full round-trip', () => {
    const entities = [
      makeEntity({ Line: { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } } }),
      makeEntity({ Line: { start: { x: 20, y: 0 }, end: { x: 20, y: 15 } } }),
      makeEntity({ Circle: { center: { x: 10, y: 7.5 }, radius: 3 } }),
      makeEntity({
        Arc: { center: { x: 5, y: 5 }, radius: 2, start_angle: 0, end_angle: Math.PI },
      }),
      makeEntity({
        Polyline: {
          vertices: [
            { x: 0, y: 15 },
            { x: 10, y: 15 },
            { x: 10, y: 10 },
          ],
          closed: false,
        },
      }),
      makeEntity({
        Text: { position: { x: 8, y: 12 }, content: 'Living Room', height: 1.5, rotation: 0 },
      }),
    ];
    const result = roundTrip(entities);

    expect(result).toHaveLength(6);
    expect(result[0].type).toBe('line');
    expect(result[1].type).toBe('line');
    expect(result[2].type).toBe('circle');
    expect(result[3].type).toBe('arc');
    expect(result[4].type).toBe('polyline');
    expect(result[5].type).toBe('text');

    // Spot-check values
    near(result[2].geometry.Circle.radius, 3);
    near(result[3].geometry.Arc.end_angle, Math.PI);
    expect(result[4].geometry.Polyline.vertices).toHaveLength(3);
    expect(result[5].geometry.Text.content).toBe('Living Room');
  });

  it('text with rotation survives round-trip', () => {
    const rotation = Math.PI / 6; // 30 degrees
    const ent = makeEntity({
      Text: { position: { x: 1, y: 1 }, content: 'Rotated', height: 3, rotation },
    });
    const result = roundTrip([ent]);

    expect(result).toHaveLength(1);
    const g = result[0].geometry.Text;
    near(g.rotation, rotation);
  });

  it('linear dimension round-trips', () => {
    const ent = makeEntity({
      Dimension: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, offset: 2, text_override: '' },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('dimension');
    const g = result[0].geometry.Dimension;
    near(g.start.x, 0);
    near(g.start.y, 0);
    near(g.end.x, 10);
    near(g.end.y, 0);
    near(g.offset, 2);
  });

  it('aligned dimension round-trips as dimension', () => {
    const ent = makeEntity({
      AlignedDimension: {
        start: { x: 1, y: 1 },
        end: { x: 5, y: 5 },
        offset: 1.5,
        text_override: '',
      },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('dimension');
    const g = result[0].geometry.Dimension;
    near(g.start.x, 1);
    near(g.start.y, 1);
    near(g.end.x, 5);
    near(g.end.y, 5);
    near(g.offset, 1.5);
  });

  it('radial dimension round-trips', () => {
    const ent = makeEntity({
      RadialDimension: {
        center: { x: 0, y: 0 },
        point_on_arc: { x: 5, y: 0 },
        text_override: '',
      },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('radial_dimension');
    const g = result[0].geometry.RadialDimension;
    near(g.center.x, 0);
    near(g.center.y, 0);
    near(g.point_on_arc.x, 5);
    near(g.point_on_arc.y, 0);
  });

  it('diameter dimension round-trips', () => {
    const ent = makeEntity({
      DiameterDimension: {
        center: { x: 0, y: 0 },
        point_on_arc: { x: 3, y: 0 },
        text_override: '',
      },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('diameter_dimension');
    const g = result[0].geometry.DiameterDimension;
    near(g.center.x, 0);
    near(g.center.y, 0);
    near(g.point_on_arc.x, 3);
    near(g.point_on_arc.y, 0);
  });

  it('angular dimension round-trips', () => {
    const ent = makeEntity({
      AngularDimension: {
        center: { x: 0, y: 0 },
        start_ray: { x: 5, y: 0 },
        end_ray: { x: 0, y: 5 },
        radius: 5,
        text_override: '',
      },
    });
    const result = roundTrip([ent]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('angular_dimension');
    const g = result[0].geometry.AngularDimension;
    near(g.center.x, 0);
    near(g.center.y, 0);
    near(g.start_ray.x, 5);
    near(g.start_ray.y, 0);
    near(g.end_ray.x, 0);
    near(g.end_ray.y, 5);
  });

  it('dimension exports as proper DXF DIMENSION entity', () => {
    const ent = makeEntity({
      Dimension: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, offset: 2, text_override: '' },
    });
    const dxf = exportDxf(JSON.stringify([ent]));

    // Now exports as a proper DIMENSION entity, not decomposed lines+text
    expect(dxf).toContain('DIMENSION');
    expect(dxf).toContain('Standard');
    expect(dxf).toContain('10.000');
  });
});
