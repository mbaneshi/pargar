import { describe, it, expect } from 'vitest';
import { exportDxf } from '../dxf-export.js';
import { parseDxfFull } from '../dxf-import.js';

function roundTrip(entitiesJson: string) {
  const dxf = exportDxf(entitiesJson);
  return parseDxfFull(dxf);
}

describe('Arc sweep direction round-trip', () => {
  it('normal arc (0 to PI/2) round-trips', () => {
    const entities = JSON.stringify([
      {
        id: 'a1',
        layer_id: 'layer_0',
        geometry: {
          Arc: { center: { x: 0, y: 0 }, radius: 10, start_angle: 0, end_angle: 1.5707963 },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const result = roundTrip(entities);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('arc');
  });

  it('wrapping arc (350deg to 10deg) round-trips', () => {
    const startRad = (350 * Math.PI) / 180;
    const endRad = (10 * Math.PI) / 180;
    const entities = JSON.stringify([
      {
        id: 'a1',
        layer_id: 'layer_0',
        geometry: {
          Arc: { center: { x: 0, y: 0 }, radius: 10, start_angle: startRad, end_angle: endRad },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const result = roundTrip(entities);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].geometry.Arc.radius).toBeCloseTo(10, 1);
  });

  it('half circle arc (0 to PI) round-trips', () => {
    const entities = JSON.stringify([
      {
        id: 'a1',
        layer_id: 'layer_0',
        geometry: {
          Arc: { center: { x: 5, y: 5 }, radius: 8, start_angle: 0, end_angle: 3.1415926 },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const result = roundTrip(entities);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].geometry.Arc.center.x).toBeCloseTo(5, 1);
  });

  it('270 degree arc round-trips', () => {
    const entities = JSON.stringify([
      {
        id: 'a1',
        layer_id: 'layer_0',
        geometry: {
          Arc: { center: { x: 0, y: 0 }, radius: 5, start_angle: 0, end_angle: 4.7123889 },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const result = roundTrip(entities);
    expect(result.entities).toHaveLength(1);
  });
});
