import { describe, it, expect, vi } from 'vitest';
import { LineBatcher } from '../LineBatcher';
import * as THREE from 'three';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = {
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        style: {},
        remove: () => {},
      };
      setSize() {}
      setPixelRatio() {}
      render() {}
      dispose() {}
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateLineEntities(count: number) {
  const entities = [];
  for (let i = 0; i < count; i++) {
    const x = (i % 100) * 10;
    const y = Math.floor(i / 100) * 10;
    entities.push({
      id: `e${i}`,
      type: 'line',
      geometry: {
        Line: {
          start: { x, y },
          end: { x: x + 8, y: y + 5 },
        },
      },
      layerId: 'layer0',
      color: '#ffffff',
    });
  }
  return entities;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateMixedEntities(count: number) {
  const entities = [];
  for (let i = 0; i < count; i++) {
    const x = (i % 100) * 10;
    const y = Math.floor(i / 100) * 10;
    if (i % 3 === 0) {
      entities.push({
        id: `e${i}`,
        type: 'circle',
        geometry: { Circle: { center: { x, y }, radius: 3 } },
        layerId: 'layer0',
        color: '#ffffff',
      });
    } else if (i % 3 === 1) {
      entities.push({
        id: `e${i}`,
        type: 'rectangle',
        geometry: {
          Rectangle: { origin: { x, y }, width: 6, height: 4, rotation: 0 },
        },
        layerId: 'layer0',
        color: '#ffffff',
      });
    } else {
      entities.push({
        id: `e${i}`,
        type: 'line',
        geometry: {
          Line: { start: { x, y }, end: { x: x + 8, y: y + 5 } },
        },
        layerId: 'layer0',
        color: '#ffffff',
      });
    }
  }
  return entities;
}

describe('LineBatcher — performance', () => {
  it('batches 10K line entities under 500ms', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    const entries: { id: string; segments: number[]; materialKey: string }[] = [];
    for (let i = 0; i < 10000; i++) {
      const x = (i % 100) * 10;
      const y = Math.floor(i / 100) * 10;
      entries.push({
        id: `e${i}`,
        segments: [x, y, 0, x + 8, y + 5, 0],
        materialKey: '#ffffff|CONTINUOUS|1',
      });
    }

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const start = performance.now();
    batcher.rebuild(entries, () => material);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(batcher.getEntityCount()).toBe(10000);
    // All same material key -> 1 batch draw call
    expect(batcher.getBatchCount()).toBe(1);

    batcher.clear();
  });

  it('hit testing 10K entities completes under 50ms', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    const entries: { id: string; segments: number[]; materialKey: string }[] = [];
    for (let i = 0; i < 10000; i++) {
      const x = (i % 100) * 10;
      const y = Math.floor(i / 100) * 10;
      entries.push({
        id: `e${i}`,
        segments: [x, y, 0, x + 8, y + 5, 0],
        materialKey: '#ffffff|CONTINUOUS|1',
      });
    }

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    batcher.rebuild(entries, () => material);

    const start = performance.now();
    const hit = batcher.hitTest(4, 2.5, 1);
    const elapsed = performance.now() - start;

    expect(hit).toBe('e0');
    expect(elapsed).toBeLessThan(50);

    batcher.clear();
  });

  it('rect selection on 10K entities completes under 50ms', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    const entries: { id: string; segments: number[]; materialKey: string }[] = [];
    for (let i = 0; i < 10000; i++) {
      const x = (i % 100) * 10;
      const y = Math.floor(i / 100) * 10;
      entries.push({
        id: `e${i}`,
        segments: [x, y, 0, x + 8, y + 5, 0],
        materialKey: '#ffffff|CONTINUOUS|1',
      });
    }

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    batcher.rebuild(entries, () => material);

    const start = performance.now();
    const hits = batcher.getEntityIdsInRect(0, 0, 50, 50, 'crossing');
    const elapsed = performance.now() - start;

    expect(hits.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);

    batcher.clear();
  });

  it('multiple material keys produce multiple batches', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    const entries: { id: string; segments: number[]; materialKey: string }[] = [];
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    for (let i = 0; i < 300; i++) {
      entries.push({
        id: `e${i}`,
        segments: [0, 0, 0, 10, 10, 0],
        materialKey: `${colors[i % 3]}|CONTINUOUS|1`,
      });
    }

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    batcher.rebuild(entries, () => material);

    expect(batcher.getBatchCount()).toBe(3);
    expect(batcher.getEntityCount()).toBe(300);

    batcher.clear();
  });
});

describe('LineBatcher — correctness', () => {
  it('hit test returns null for miss', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    batcher.rebuild(
      [{ id: 'e0', segments: [0, 0, 0, 10, 0, 0], materialKey: 'k' }],
      () => new THREE.LineBasicMaterial({ color: 0xffffff }),
    );

    expect(batcher.hitTest(100, 100, 0.5)).toBeNull();
    batcher.clear();
  });

  it('window selection requires full containment', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    batcher.rebuild(
      [{ id: 'e0', segments: [0, 0, 0, 20, 0, 0], materialKey: 'k' }],
      () => new THREE.LineBasicMaterial({ color: 0xffffff }),
    );

    // Window that doesn't fully contain the line
    const partial = batcher.getEntityIdsInRect(0, -1, 10, 1, 'window');
    expect(partial).toEqual([]);

    // Window that fully contains the line
    const full = batcher.getEntityIdsInRect(-1, -1, 21, 1, 'window');
    expect(full).toEqual(['e0']);

    batcher.clear();
  });

  it('crossing selection includes partial overlap', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    batcher.rebuild(
      [{ id: 'e0', segments: [0, 0, 0, 20, 0, 0], materialKey: 'k' }],
      () => new THREE.LineBasicMaterial({ color: 0xffffff }),
    );

    const hits = batcher.getEntityIdsInRect(5, -1, 15, 1, 'crossing');
    expect(hits).toEqual(['e0']);

    batcher.clear();
  });

  it('clear removes all entities', () => {
    const scene = new THREE.Scene();
    const batcher = new LineBatcher(scene);

    batcher.rebuild(
      [{ id: 'e0', segments: [0, 0, 0, 10, 0, 0], materialKey: 'k' }],
      () => new THREE.LineBasicMaterial({ color: 0xffffff }),
    );

    expect(batcher.getEntityCount()).toBe(1);
    batcher.clear();
    expect(batcher.getEntityCount()).toBe(0);
    expect(batcher.getBatchCount()).toBe(0);
  });
});
