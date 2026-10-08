import { describe, it, expect, beforeEach } from 'vitest';
import { createTestKernel, type TestKernel } from './kernelTestHelper';

let tk: TestKernel;

beforeEach(async () => {
  tk = await createTestKernel();
});

function createLine() {
  return tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
}

describe('Edit Tools', () => {
  it('MoveEntity shifts coordinates', () => {
    const r = createLine();
    const id = r.created_ids[0];
    tk.exec({ type: 'MoveEntity', id, dx: 5, dy: 3 });
    const e = tk.getEntity(id);
    expect(e.geometry.Line.start.x).toBeCloseTo(5);
    expect(e.geometry.Line.start.y).toBeCloseTo(3);
    expect(e.geometry.Line.end.x).toBeCloseTo(15);
  });

  it('CopyEntity increases count', () => {
    const r = createLine();
    tk.exec({ type: 'CopyEntity', id: r.created_ids[0] });
    expect(tk.entityCount()).toBe(2);
  });

  it('RotateEntity changes geometry', () => {
    const r = createLine();
    const id = r.created_ids[0];
    const rot = tk.exec({ type: 'RotateEntity', id, cx: 0, cy: 0, angle: 1.5707963267948966 });
    expect(rot.success).toBe(true);
    const e = tk.getEntity(id);
    expect(e.geometry.Line.end.x).toBeCloseTo(0, 0);
    expect(e.geometry.Line.end.y).toBeCloseTo(10, 0);
  });

  it('ScaleEntity changes size', () => {
    const r = createLine();
    const id = r.created_ids[0];
    tk.exec({ type: 'ScaleEntity', id, cx: 0, cy: 0, factor: 2 });
    const e = tk.getEntity(id);
    expect(e.geometry.Line.end.x).toBeCloseTo(20);
  });

  it('MirrorEntity creates new entity', () => {
    const r = createLine();
    tk.exec({ type: 'MirrorEntity', id: r.created_ids[0], x1: 0, y1: 0, x2: 0, y2: 10 });
    expect(tk.entityCount()).toBe(2);
  });

  it('DeleteEntity removes entity', () => {
    const r = createLine();
    tk.exec({ type: 'DeleteEntity', id: r.created_ids[0] });
    expect(tk.entityCount()).toBe(0);
  });

  it('delete multiple entities', () => {
    createLine();
    createLine();
    expect(tk.entityCount()).toBe(2);
    const entities = tk.getEntities();
    tk.exec({ type: 'DeleteEntity', id: entities[0].id });
    tk.exec({ type: 'DeleteEntity', id: entities[1].id });
    expect(tk.entityCount()).toBe(0);
  });

  it('CopyEntity preserves geometry', () => {
    const r = createLine();
    const copy = tk.exec({ type: 'CopyEntity', id: r.created_ids[0] });
    const e = tk.getEntity(copy.created_ids[0]);
    expect(e.geometry.Line.start.x).toBeCloseTo(0);
    expect(e.geometry.Line.end.x).toBeCloseTo(10);
  });
});
