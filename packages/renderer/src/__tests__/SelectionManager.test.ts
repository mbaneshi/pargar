import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
  class Scene {
    add() {}
    remove() {}
  }
  class Color {
    constructor() {}
  }
  class Object3D {
    traverse() {}
  }
  return { Scene, Color, Object3D };
});

import { SelectionManager } from '../SelectionManager';
import * as THREE from 'three';

function createManager(): SelectionManager {
  return new SelectionManager(new THREE.Scene());
}

describe('SelectionManager — state', () => {
  it('starts empty', () => expect(createManager().getSelectedIds()).toEqual([]));

  it('select adds', () => {
    const m = createManager();
    m.select('e1');
    expect(m.isSelected('e1')).toBe(true);
  });

  it('deselect removes', () => {
    const m = createManager();
    m.select('e1');
    m.deselect('e1');
    expect(m.isSelected('e1')).toBe(false);
  });

  it('toggle', () => {
    const m = createManager();
    m.toggle('e1');
    expect(m.isSelected('e1')).toBe(true);
    m.toggle('e1');
    expect(m.isSelected('e1')).toBe(false);
  });

  it('clear', () => {
    const m = createManager();
    m.select('e1');
    m.select('e2');
    m.clear();
    expect(m.getSelectedIds()).toEqual([]);
  });
});

describe('SelectionManager — getGripPoints', () => {
  const m = createManager();

  it('Line: 3 grips (start, end, midpoint)', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } },
    });
    expect(grips).toHaveLength(3);
    expect(grips[2]).toEqual({ x: 5, y: 0 });
  });

  it('Circle: 5 grips (center + 4 quadrants)', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: { Circle: { center: { x: 5, y: 5 }, radius: 3 } },
    });
    expect(grips).toHaveLength(5);
    expect(grips[0]).toEqual({ x: 5, y: 5 });
    expect(grips[1]).toEqual({ x: 8, y: 5 });
  });

  it('Arc: 3 grips', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: {
        Arc: { center: { x: 0, y: 0 }, radius: 5, start_angle: 0, end_angle: Math.PI / 2 },
      },
    });
    expect(grips).toHaveLength(3);
    expect(grips[1].x).toBeCloseTo(5);
    expect(grips[2].y).toBeCloseTo(5);
  });

  it('Rectangle: 5 grips', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: { Rectangle: { origin: { x: 0, y: 0 }, width: 10, height: 6 } },
    });
    expect(grips).toHaveLength(5);
    expect(grips[4]).toEqual({ x: 5, y: 3 });
  });

  it('Polyline: all vertices', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: {
        Polyline: {
          vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 0 },
          ],
        },
      },
    });
    expect(grips).toHaveLength(3);
  });

  it('Ellipse: 5 grips', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: { Ellipse: { center: { x: 0, y: 0 }, semi_major: 10, semi_minor: 5, rotation: 0 } },
    });
    expect(grips).toHaveLength(5);
    expect(grips[1].x).toBeCloseTo(10);
  });

  it('Text: 1 grip', () => {
    const grips = m.getGripPoints({ id: 'e1', geometry: { Text: { position: { x: 5, y: 10 } } } });
    expect(grips).toHaveLength(1);
  });

  it('Point: 1 grip', () => {
    const grips = m.getGripPoints({ id: 'e1', geometry: { Point: { position: { x: 1, y: 2 } } } });
    expect(grips).toHaveLength(1);
  });

  it('Dimension: 2 grips', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: { Dimension: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, offset: 3 } },
    });
    expect(grips).toHaveLength(2);
  });

  it('RevisionCloud: all boundary', () => {
    const grips = m.getGripPoints({
      id: 'e1',
      geometry: {
        RevisionCloud: {
          boundary: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
          ],
        },
      },
    });
    expect(grips).toHaveLength(4);
  });

  it('unknown geometry: empty', () => {
    expect(m.getGripPoints({ id: 'e1', geometry: { Unknown: {} } })).toHaveLength(0);
  });
});

describe('SelectionManager — getGripAtPoint', () => {
  it('returns closest grip', () => {
    const m = createManager();
    m.select('e1');
    const hit = m.getGripAtPoint(
      0.1,
      0.1,
      [{ id: 'e1', geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } } }],
      1,
    );
    expect(hit).not.toBeNull();
    expect(hit!.entityId).toBe('e1');
    expect(hit!.gripType).toBe('endpoint');
  });

  it('returns null when too far', () => {
    const m = createManager();
    m.select('e1');
    const hit = m.getGripAtPoint(
      100,
      100,
      [{ id: 'e1', geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } } }],
      1,
    );
    expect(hit).toBeNull();
  });

  it('midpoint grip for line center', () => {
    const m = createManager();
    m.select('e1');
    const hit = m.getGripAtPoint(
      5,
      0.1,
      [{ id: 'e1', geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } } }],
      1,
    );
    expect(hit!.gripType).toBe('midpoint');
  });

  it('center grip for circle', () => {
    const m = createManager();
    m.select('e1');
    const hit = m.getGripAtPoint(
      5,
      5,
      [{ id: 'e1', geometry: { Circle: { center: { x: 5, y: 5 }, radius: 3 } } }],
      1,
    );
    expect(hit!.gripType).toBe('center');
  });
});
