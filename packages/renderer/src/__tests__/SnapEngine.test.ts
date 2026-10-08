import { describe, it, expect } from 'vitest';
import { SnapEngine, type EntityData, type SnapPoint } from '../SnapEngine.js';

function line(x1: number, y1: number, x2: number, y2: number) {
  return {
    id: `line-${x1}-${y1}-${x2}-${y2}`,
    geometry: { Line: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } },
  };
}

function circle(cx: number, cy: number, r: number) {
  return {
    id: `circle-${cx}-${cy}-${r}`,
    geometry: { Circle: { center: { x: cx, y: cy }, radius: r } },
  };
}

function arc(cx: number, cy: number, r: number, sa: number, ea: number) {
  return {
    id: `arc-${cx}-${cy}`,
    geometry: { Arc: { center: { x: cx, y: cy }, radius: r, start_angle: sa, end_angle: ea } },
  };
}

describe('SnapEngine', () => {
  it('finds endpoint snap', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(0.1, 0.1, [line(0, 0, 10, 0)]);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('endpoint');
    expect(snap!.x).toBe(0);
    expect(snap!.y).toBe(0);
  });

  it('finds midpoint snap', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(5.1, 0.1, [line(0, 0, 10, 0)]);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('midpoint');
    expect(snap!.x).toBe(5);
    expect(snap!.y).toBe(0);
  });

  it('finds line-line intersection snap', () => {
    const engine = new SnapEngine();
    // Lines cross at (2, 3) -- not at any midpoint or endpoint
    const entities = [line(0, 3, 10, 3), line(2, 0, 2, 10)];
    const snap = engine.findSnap(2.1, 3.1, entities);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('intersection');
    expect(Math.abs(snap!.x - 2)).toBeLessThan(0.01);
    expect(Math.abs(snap!.y - 3)).toBeLessThan(0.01);
  });

  it('does not crash on parallel lines (zero denominator)', () => {
    const engine = new SnapEngine();
    const entities = [line(0, 0, 10, 0), line(0, 1, 10, 1)];
    const snap = engine.findSnap(5, 0.5, entities);
    expect(snap).toBeDefined();
  });

  it('does not crash on zero-length lines', () => {
    const engine = new SnapEngine();
    const entities = [line(5, 5, 5, 5), line(0, 0, 10, 0)];
    const snap = engine.findSnap(5, 5, entities);
    expect(snap).not.toBeNull();
  });

  it('finds circle center snap', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(5.1, 5.1, [circle(5, 5, 3)]);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('center');
    expect(snap!.x).toBe(5);
    expect(snap!.y).toBe(5);
  });

  it('does not crash on zero-radius circle', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(0.1, 0.1, [circle(0, 0, 0)]);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('center');
  });

  it('does not crash on NaN radius circle', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(0.1, 0.1, [circle(0, 0, NaN)]);
    expect(snap).not.toBeNull();
  });

  it('does not crash on Infinity coordinates', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(Infinity, 0, [line(0, 0, 10, 0)]);
    expect(snap).toBeNull();
  });

  it('does not crash on NaN world coordinates', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(NaN, NaN, [line(0, 0, 10, 0)]);
    expect(snap).toBeNull();
  });

  it('nearest snap on circle at center does not produce NaN', () => {
    const engine = new SnapEngine();
    engine.config.threshold = 5; // large enough to include fallback point
    engine.config.types.endpoint = false;
    engine.config.types.midpoint = false;
    engine.config.types.center = false;
    engine.config.types.intersection = false;
    engine.config.types.grid = false;
    engine.config.types.quadrant = false;
    const snap = engine.findSnap(5, 5, [circle(5, 5, 3)]);
    expect(snap).not.toBeNull();
    expect(Number.isFinite(snap!.x)).toBe(true);
    expect(Number.isFinite(snap!.y)).toBe(true);
    expect(snap!.type).toBe('nearest');
  });

  it('nearest snap on arc at center does not produce NaN', () => {
    const engine = new SnapEngine();
    engine.config.threshold = 5;
    engine.config.types.endpoint = false;
    engine.config.types.midpoint = false;
    engine.config.types.center = false;
    engine.config.types.intersection = false;
    engine.config.types.grid = false;
    const snap = engine.findSnap(5, 5, [arc(5, 5, 3, 0, Math.PI)]);
    expect(snap).not.toBeNull();
    expect(Number.isFinite(snap!.x)).toBe(true);
    expect(Number.isFinite(snap!.y)).toBe(true);
  });

  it('handles null/undefined entities gracefully', () => {
    const engine = new SnapEngine();
    const entities = [null, undefined, line(0, 0, 10, 0)] as EntityData[];
    const snap = engine.findSnap(0.1, 0.1, entities);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('endpoint');
  });

  it('handles entity with null geometry gracefully', () => {
    const engine = new SnapEngine();
    const entities = [{ id: 'bad', geometry: null }, line(0, 0, 10, 0)] as EntityData[];
    const snap = engine.findSnap(0.1, 0.1, entities);
    expect(snap).not.toBeNull();
  });

  it('line-circle intersection does not crash with degenerate inputs', () => {
    const engine = new SnapEngine();
    const entities = [line(5, 5, 5, 5), circle(5, 5, 0)];
    const snap = engine.findSnap(5, 5, entities);
    expect(snap).toBeDefined();
  });

  it('returns null when snap disabled', () => {
    const engine = new SnapEngine();
    engine.config.enabled = false;
    const snap = engine.findSnap(0, 0, [line(0, 0, 10, 0)]);
    expect(snap).toBeNull();
  });

  it('osnap toggle returns grid when no entities nearby', () => {
    const engine = new SnapEngine();
    const snap = engine.findSnap(100, 100, [line(0, 0, 10, 0)]);
    expect(snap).not.toBeNull();
    expect(snap!.type).toBe('grid');
  });

  it('tangent is registered in SnapConfig.types and defaults off', () => {
    // Tangent requires a from-point and only applies to circles/arcs;
    // it's normally activated via the OSNAP override menu, not as an
    // always-on mode. The kernel does the actual geometry — see
    // packages/kernel/src/snaps.rs::tangent_to_circle / find_tangent_snap.
    const engine = new SnapEngine();
    expect(engine.config.types).toHaveProperty('tangent');
    expect(engine.config.types.tangent).toBe(false);
  });

  it('SnapPoint type union accepts "tangent"', () => {
    // Type-level test: kernel returns {x, y, type: "tangent"} via the
    // override-menu path (PR_2). This confirms the renderer's type system
    // is ready to receive that result without a cast.
    const tangentSnap: SnapPoint = { x: 2.5, y: 4.33, type: 'tangent' };
    expect(tangentSnap.type).toBe('tangent');
  });

  it('geometric_center is registered in SnapConfig.types and defaults off', () => {
    // Geometric Center (AutoCAD GCEN) — centroid of closed shapes. Implemented
    // in the kernel: see packages/kernel/src/snaps.rs::geometric_center_of_polygon
    // / find_geometric_center_snap. Off by default; activated via the OSNAP
    // override menu, not as an always-on mode.
    const engine = new SnapEngine();
    expect(engine.config.types).toHaveProperty('geometric_center');
    expect(engine.config.types.geometric_center).toBe(false);
  });

  it('SnapPoint type union accepts "geometric_center"', () => {
    // Type-level test: kernel returns {x, y, type: "geometric_center"} via the
    // override-menu path. Renderer types are ready to receive it without a cast.
    const gcenSnap: SnapPoint = { x: 5.0, y: 5.0, type: 'geometric_center' };
    expect(gcenSnap.type).toBe('geometric_center');
  });

  it('extension is registered in SnapConfig.types and defaults off', () => {
    // Extension (AutoCAD EXT) — snaps to the projection of the cursor onto
    // a line extended past its endpoints. Implemented in the kernel: see
    // packages/kernel/src/snaps.rs::extension_of_line / find_extension_snap.
    // Off by default; activated via the OSNAP override menu.
    const engine = new SnapEngine();
    expect(engine.config.types).toHaveProperty('extension');
    expect(engine.config.types.extension).toBe(false);
  });

  it('SnapPoint type union accepts "extension"', () => {
    // Type-level test: kernel returns {x, y, type: "extension"} via the
    // override-menu path. Renderer types are ready to receive it without a cast.
    const extSnap: SnapPoint = { x: 12.0, y: 0.0, type: 'extension' };
    expect(extSnap.type).toBe('extension');
  });
});
