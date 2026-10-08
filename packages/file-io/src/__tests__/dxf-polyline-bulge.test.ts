import { describe, it, expect } from 'vitest';
import { parseDxfFull } from '../dxf-import';
import { exportDxf } from '../dxf-export';

describe('Polyline bulge handling', () => {
  it('straight polyline imports correctly', () => {
    const entities = JSON.stringify([
      {
        id: 'p1',
        layer_id: 'layer_0',
        geometry: {
          Polyline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
            closed: false,
          },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const dxf = exportDxf(entities);
    const result = parseDxfFull(dxf);
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    const pl = result.entities[0];
    expect(pl.geometry.Polyline.vertices.length).toBe(3);
  });

  it('closed polyline preserves closed flag', () => {
    const entities = JSON.stringify([
      {
        id: 'p1',
        layer_id: 'layer_0',
        geometry: {
          Polyline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            closed: true,
          },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const dxf = exportDxf(entities);
    const result = parseDxfFull(dxf);
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    const pl = result.entities[0];
    expect(pl.geometry.Polyline.closed).toBe(true);
  });

  it('straight segments do not produce extra vertices', () => {
    const entities = JSON.stringify([
      {
        id: 'p1',
        layer_id: 'layer_0',
        geometry: {
          Polyline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
            closed: false,
          },
        },
        style: { color: null, linetype: null, lineweight: null },
      },
    ]);
    const dxf = exportDxf(entities);
    const result = parseDxfFull(dxf);
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    const pl = result.entities[0];
    expect(pl.geometry.Polyline.vertices.length).toBe(3);
  });
});
