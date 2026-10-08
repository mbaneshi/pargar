import { describe, it, expect, beforeEach } from 'vitest';
import { createTestKernel, type TestKernel } from './kernelTestHelper';

let tk: TestKernel;

beforeEach(async () => {
  tk = await createTestKernel();
});

describe('Kernel Bridge — command serialization', () => {
  it('executeCommand returns structured CommandResult', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(r).toHaveProperty('success', true);
    expect(r).toHaveProperty('created_ids');
    expect(Array.isArray(r.created_ids)).toBe(true);
  });

  it('invalid command type returns error', () => {
    const r = tk.exec({ type: 'NonexistentCommand' });
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('malformed JSON does not crash', () => {
    const raw = tk.kernel.execute_command('not json');
    const r = JSON.parse(raw);
    expect(r.success).toBe(false);
  });
});

describe('Kernel Bridge — entity lifecycle', () => {
  it('create → query → verify geometry', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 1, y1: 2, x2: 3, y2: 4, layer_id: 'layer_0' });
    const id = r.created_ids[0];
    const e = tk.getEntity(id);
    expect(e.geometry.Line.start).toEqual({ x: 1, y: 2 });
    expect(e.geometry.Line.end).toEqual({ x: 3, y: 4 });
    expect(e.layer_id).toBe('layer_0');
  });

  it('create → move → verify coordinates shifted', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const id = r.created_ids[0];
    tk.exec({ type: 'MoveEntity', id, dx: 5, dy: 3 });
    const e = tk.getEntity(id);
    expect(e.geometry.Line.start.x).toBeCloseTo(5);
    expect(e.geometry.Line.start.y).toBeCloseTo(3);
  });

  it('create → delete → count drops', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(tk.entityCount()).toBe(1);
    tk.exec({ type: 'DeleteEntity', id: r.created_ids[0] });
    expect(tk.entityCount()).toBe(0);
  });
});

describe('Kernel Bridge — undo/redo integration', () => {
  it('undo creation restores empty state', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(tk.kernel.can_undo()).toBe(true);
    tk.kernel.undo();
    expect(tk.entityCount()).toBe(0);
  });

  it('redo after undo restores entity', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    tk.kernel.undo();
    expect(tk.kernel.can_redo()).toBe(true);
    tk.kernel.redo();
    expect(tk.entityCount()).toBe(1);
  });

  it('undo move restores original position', () => {
    const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const id = r.created_ids[0];
    tk.exec({ type: 'MoveEntity', id, dx: 100, dy: 100 });
    tk.kernel.undo();
    const e = tk.getEntity(id);
    expect(e.geometry.Line.start.x).toBeCloseTo(0);
    expect(e.geometry.Line.end.x).toBeCloseTo(10);
  });

  it('multi-step undo/redo chain', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateRectangle', x: 0, y: 0, width: 4, height: 3, layer_id: 'layer_0' });
    expect(tk.entityCount()).toBe(3);

    tk.kernel.undo(); // undo rect
    tk.kernel.undo(); // undo circle
    expect(tk.entityCount()).toBe(1);

    tk.kernel.redo(); // redo circle
    expect(tk.entityCount()).toBe(2);

    tk.kernel.redo(); // redo rect
    expect(tk.entityCount()).toBe(3);
  });
});

describe('Kernel Bridge — layer operations', () => {
  it('create layer and assign entity', () => {
    const lr = tk.exec({ type: 'CreateLayer', name: 'Walls', color: '#ff0000' });
    expect(lr.success).toBe(true);
    const layerId = lr.created_ids[0];

    const cr = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: layerId });
    const e = tk.getEntity(cr.created_ids[0]);
    expect(e.layer_id).toBe(layerId);
  });

  it('layers json includes created layers', () => {
    tk.exec({ type: 'CreateLayer', name: 'Foundation', color: '#0000ff' });
    const layers = JSON.parse(tk.kernel.get_layers_json());
    expect(layers.some((l: any) => l.name === 'Foundation')).toBe(true);
  });
});

describe('Kernel Bridge — error propagation', () => {
  it('move nonexistent entity returns error', () => {
    const r = tk.exec({ type: 'MoveEntity', id: 'ent_999', dx: 1, dy: 1 });
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('delete nonexistent entity returns error', () => {
    const r = tk.exec({ type: 'DeleteEntity', id: 'ent_999' });
    expect(r.success).toBe(false);
  });

  it('set entity layer to nonexistent layer returns error', () => {
    const cr = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const r = tk.exec({ type: 'SetEntityLayer', id: cr.created_ids[0], layer_id: 'layer_999' });
    expect(r.success).toBe(false);
  });
});

describe('Kernel Bridge — getEntities consistency', () => {
  it('getEntities matches entityCount', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    const entities = tk.getEntities();
    expect(entities.length).toBe(tk.entityCount());
    expect(entities.length).toBe(2);
  });

  it('each entity has id, geometry, layer_id', () => {
    tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const entities = tk.getEntities();
    const e = entities[0];
    expect(e).toHaveProperty('id');
    expect(e).toHaveProperty('geometry');
    expect(e).toHaveProperty('layer_id');
  });

  it('entities survive undo/redo with correct geometry', () => {
    const r = tk.exec({ type: 'CreateCircle', cx: 7, cy: 3, radius: 5, layer_id: 'layer_0' });
    tk.kernel.undo();
    tk.kernel.redo();
    const e = tk.getEntity(r.created_ids[0]);
    expect(e.geometry.Circle.center).toEqual({ x: 7, y: 3 });
    expect(e.geometry.Circle.radius).toBe(5);
  });
});
