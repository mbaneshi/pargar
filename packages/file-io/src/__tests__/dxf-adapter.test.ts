import { describe, it, expect } from 'vitest';
import { dxfAdapter } from '../dxf-adapter.js';

describe('dxfAdapter', () => {
  it('has correct metadata', () => {
    expect(dxfAdapter.id).toBe('dxf');
    expect(dxfAdapter.extensions).toEqual(['dxf']);
    expect(dxfAdapter.capabilities.import).toBe(true);
    expect(dxfAdapter.capabilities.export).toBe(true);
  });

  it('exports entities to DXF string', () => {
    const entities = [
      {
        id: '1',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } } },
        layer_id: '0',
      },
    ];
    const layers = [{ id: '0', name: '0', color: '#ffffff', visible: true, locked: false }];
    const result = dxfAdapter.export!(entities, layers);
    expect(typeof result).toBe('string');
    expect(result).toContain('LINE');
    expect(result).toContain('EOF');
  });

  it('exports with layers passed through', () => {
    const entities = [
      {
        id: '1',
        geometry: { Circle: { center: { x: 5, y: 5 }, radius: 3 } },
        layer_id: 'walls',
      },
    ];
    const layers = [{ id: 'walls', name: 'Walls', color: '#ff0000', visible: true, locked: false }];
    const result = dxfAdapter.export!(entities, layers) as string;
    expect(result).toContain('Walls');
    expect(result).toContain('CIRCLE');
  });
});
