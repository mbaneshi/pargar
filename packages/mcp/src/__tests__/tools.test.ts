import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let kernel: any;

beforeEach(async () => {
  const wasmPath = join(__dirname, '..', '..', '..', 'kernel', 'pkg', 'nexus_kernel_bg.wasm');
  const wasmBytes = readFileSync(wasmPath);
  const mod = await import('@nexus/kernel');
  if (mod.initSync) {
    mod.initSync({ module: new WebAssembly.Module(wasmBytes) });
  }
  kernel = new mod.Kernel();
});

function exec(cmd: object) {
  return JSON.parse(kernel.execute_command(JSON.stringify(cmd)));
}

describe('Kernel Bridge', () => {
  it('should create a line and query it', () => {
    const result = exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(result.success).toBe(true);
    expect(result.created_ids).toHaveLength(1);
    expect(kernel.entity_count()).toBe(1);
  });

  it('should create multiple entities', () => {
    exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    exec({ type: 'CreateCircle', cx: 5, cy: 5, radius: 3, layer_id: 'layer_0' });
    exec({ type: 'CreateRectangle', x: 0, y: 0, width: 10, height: 5, layer_id: 'layer_0' });
    expect(kernel.entity_count()).toBe(3);
  });

  it('should move an entity', () => {
    exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const moveResult = exec({ type: 'MoveEntity', id: 'ent_1', dx: 5, dy: 5 });
    expect(moveResult.success).toBe(true);

    const entities = JSON.parse(kernel.get_entities_json());
    const line = entities[0].geometry.Line;
    expect(line.start.x).toBeCloseTo(5);
    expect(line.start.y).toBeCloseTo(5);
  });

  it('should undo and redo', () => {
    exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    expect(kernel.entity_count()).toBe(1);
    expect(kernel.can_undo()).toBe(true);

    kernel.undo();
    expect(kernel.entity_count()).toBe(0);
    expect(kernel.can_redo()).toBe(true);

    kernel.redo();
    expect(kernel.entity_count()).toBe(1);
  });

  it('should copy and delete', () => {
    exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    const copyResult = exec({ type: 'CopyEntity', id: 'ent_1' });
    expect(copyResult.success).toBe(true);
    expect(kernel.entity_count()).toBe(2);

    exec({ type: 'DeleteEntity', id: 'ent_1' });
    expect(kernel.entity_count()).toBe(1);
  });

  it('should measure distance', () => {
    const result = exec({ type: 'MeasureDistance', x1: 0, y1: 0, x2: 3, y2: 4 });
    expect(result.success).toBe(true);
    expect(result.measurement).toBeCloseTo(5);
  });

  it('should get layers', () => {
    const layers = JSON.parse(kernel.get_layers_json());
    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe('0');
  });

  it('should draw all entity types', () => {
    exec({ type: 'CreatePoint', x: 0, y: 0, layer_id: 'layer_0' });
    exec({ type: 'CreateLine', x1: 0, y1: 0, x2: 10, y2: 0, layer_id: 'layer_0' });
    exec({ type: 'CreateCircle', cx: 0, cy: 0, radius: 5, layer_id: 'layer_0' });
    exec({
      type: 'CreateArc',
      cx: 0,
      cy: 0,
      radius: 5,
      start_angle: 0,
      end_angle: 1.57,
      layer_id: 'layer_0',
    });
    exec({ type: 'CreateRectangle', x: 0, y: 0, width: 10, height: 5, layer_id: 'layer_0' });
    exec({
      type: 'CreatePolyline',
      vertices: [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
      closed: false,
      layer_id: 'layer_0',
    });
    exec({
      type: 'CreateText',
      x: 0,
      y: 0,
      content: 'hello',
      height: 2.5,
      rotation: 0,
      layer_id: 'layer_0',
    });
    expect(kernel.entity_count()).toBe(7);
  });
});
