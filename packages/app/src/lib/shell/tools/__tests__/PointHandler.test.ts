import { describe, it, expect } from 'vitest';
import { PointHandler } from '../PointHandler';
import { createMockContext } from './mockToolContext';

describe('PointHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new PointHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates a point on click', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 5, y: 7 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreatePoint',
      x: 5,
      y: 7,
    });
  });

  it('stays at status 0 — repeats', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(0, { x: 1, y: 1 });
    expect(handler.status).toBe(0);
    expect(ctx.commands).toHaveLength(2);
  });

  it('right-click cancels tool', () => {
    const { handler, ctx } = setup();
    handler.onRightClick(0);
    expect(ctx.cancelled).toBe(true);
  });
});
