import { describe, it, expect, beforeEach } from 'vitest';
import { createTestKernel, type TestKernel } from './kernelTestHelper';

let tk: TestKernel;

beforeEach(async () => {
  tk = await createTestKernel();
});

describe('State Tools', () => {
  describe('Undo', () => {
    it('undo creation removes entity', () => {
      tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
      expect(tk.entityCount()).toBe(1);
      tk.kernel.undo();
      expect(tk.entityCount()).toBe(0);
    });

    it('undo move restores position', () => {
      const r = tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
      const id = r.created_ids[0];
      tk.exec({ type: 'MoveEntity', id, dx: 100, dy: 100 });
      tk.kernel.undo();
      const e = tk.getEntity(id);
      expect(e.geometry.Line.start.x).toBeCloseTo(0);
    });

    it('nothing to undo', () => {
      expect(tk.kernel.can_undo()).toBe(false);
    });
  });

  describe('Redo', () => {
    it('redo restores after undo', () => {
      tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
      tk.kernel.undo();
      expect(tk.entityCount()).toBe(0);
      tk.kernel.redo();
      expect(tk.entityCount()).toBe(1);
    });

    it('nothing to redo', () => {
      expect(tk.kernel.can_redo()).toBe(false);
    });
  });

  describe('Layers', () => {
    it('default layer exists', () => {
      const layers = JSON.parse(tk.kernel.get_layers_json());
      expect(layers.length).toBeGreaterThanOrEqual(1);
      expect(layers.some((l: any) => l.id === 'layer_0')).toBe(true);
    });

    it('create layer appears in list', () => {
      const r = tk.exec({ type: 'CreateLayer', name: 'Test', color: '#ff0000' });
      expect(r.success).toBe(true);
      const layers = JSON.parse(tk.kernel.get_layers_json());
      expect(layers.some((l: any) => l.name === 'Test')).toBe(true);
    });
  });

  describe('Entity count tracking', () => {
    it('empty drawing', () => expect(tk.entityCount()).toBe(0));

    it('after creates', () => {
      tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
      tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
      expect(tk.entityCount()).toBe(2);
    });

    it('after undo/redo cycle', () => {
      tk.exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
      tk.exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
      tk.kernel.undo();
      expect(tk.entityCount()).toBe(1);
      tk.kernel.redo();
      expect(tk.entityCount()).toBe(2);
    });
  });
});
