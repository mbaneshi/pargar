import { describe, it, expect, beforeEach } from 'vitest';
import { createTestKernel, type TestKernel } from './kernelTestHelper';

let tk: TestKernel;

beforeEach(async () => {
  tk = await createTestKernel();
});

describe('Draw Tools', () => {
  it('CreateLine', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(r.success).toBe(true);
    expect(r.created_ids).toHaveLength(1);
    const e = tk.getEntity(r.created_ids[0]);
    expect(e.geometry.Line.start).toEqual({ x: 0, y: 0 });
    expect(e.geometry.Line.end).toEqual({ x: 10, y: 0 });
  });

  it('CreateCircle', () => {
    const r = tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    expect(r.success).toBe(true);
    const e = tk.getEntity(r.created_ids[0]);
    expect(e.geometry.Circle.center).toEqual({ x: 5, y: 5 });
    expect(e.geometry.Circle.radius).toBe(3);
  });

  it('CreateRectangle', () => {
    const r = tk.exec({
      type: 'CreateRectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 5,
      layer_id: 'layer_0',
    });
    expect(r.success).toBe(true);
    expect(tk.entityCount()).toBe(1);
  });

  it('CreateArc', () => {
    const r = tk.exec({
      type: 'CreateArc',
      cx: 0,
      cy: 0,
      radius: 5,
      start_angle: 0,
      end_angle: 1.57,
      layer_id: 'layer_0',
    });
    expect(r.success).toBe(true);
  });

  it('CreatePolyline', () => {
    const r = tk.exec({
      type: 'CreatePolyline',
      vertices: [
        [0, 0],
        [5, 5],
        [10, 0],
      ],
      closed: false,
      layer_id: 'layer_0',
    });
    expect(r.success).toBe(true);
  });

  it('CreatePoint', () => {
    const r = tk.exec({ type: 'CreatePoint', x: 7, y: 3, layer_id: 'layer_0' });
    expect(r.success).toBe(true);
  });

  it('CreateText', () => {
    const r = tk.exec({
      type: 'CreateText',
      x: 5,
      y: 10,
      content: 'Hello',
      height: 2.5,
      rotation: 0,
      layer_id: 'layer_0',
    });
    expect(r.success).toBe(true);
  });

  it('multiple entities increment count', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateRectangle', x: 0, y: 0, width: 10, height: 5, layer_id: 'layer_0' });
    expect(tk.entityCount()).toBe(3);
  });
});
