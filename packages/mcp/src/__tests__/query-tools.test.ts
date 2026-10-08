import { describe, it, expect, beforeEach } from 'vitest';
import { createTestKernel, type TestKernel } from './kernelTestHelper';

let tk: TestKernel;

beforeEach(async () => {
  tk = await createTestKernel();
});

describe('Query Tools', () => {
  it('getEntities on empty drawing', () => {
    expect(tk.getEntities()).toHaveLength(0);
  });

  it('getEntities after creating', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    expect(tk.getEntities()).toHaveLength(2);
  });

  it('getEntity by id', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const e = tk.getEntity(r.created_ids[0]);
    expect(e.id).toBe(r.created_ids[0]);
    expect(e.geometry.Line).toBeDefined();
  });

  it('MeasureDistance between two points', () => {
    const r = tk.exec({ type: 'MeasureDistance', x1: 0, y1: 0, x2: 3, y2: 4 });
    expect(r.success).toBe(true);
    expect(r.measurement).toBeCloseTo(5);
  });

  it('MeasureDistance same point = 0', () => {
    const r = tk.exec({ type: 'MeasureDistance', x1: 5, y1: 5, x2: 5, y2: 5 });
    expect(r.measurement).toBeCloseTo(0);
  });

  it('MeasureDistance horizontal', () => {
    const r = tk.exec({ type: 'MeasureDistance', x1: 0, y1: 0, x2: 7, y2: 0 });
    expect(r.measurement).toBeCloseTo(7);
  });

  it('MeasureArea on rectangle', () => {
    const cr = tk.exec({
      type: 'CreateRectangle',
      x: 0,
      y: 0,
      width: 4,
      height: 3,
      layer_id: 'layer_0',
    });
    const r = tk.exec({ type: 'MeasureArea', entity_id: cr.created_ids[0] });
    expect(r.success).toBe(true);
    expect(r.measurement).toBeCloseTo(12);
  });

  it('MeasureArea on circle', () => {
    const cr = tk.exec({ type: 'CreateCircle', cx: 0, cy: 0, radius: 5, layer_id: 'layer_0' });
    const r = tk.exec({ type: 'MeasureArea', entity_id: cr.created_ids[0] });
    expect(r.success).toBe(true);
    expect(r.measurement).toBeCloseTo(Math.PI * 25, 0);
  });
});
