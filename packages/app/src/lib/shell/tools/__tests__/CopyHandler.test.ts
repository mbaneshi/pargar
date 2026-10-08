import { describe, it, expect } from 'vitest';
import { CopyHandler } from '../CopyHandler';
import { createMockContext } from './mockToolContext';

describe('CopyHandler', () => {
  function setup(selectedIds: string[] = ['e1']) {
    const ctx = createMockContext({ selectedIds });
    const handler = new CopyHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('copies and moves entities by displacement', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 5, y: 3 });

    expect(ctx.commands).toHaveLength(2);
    expect(ctx.commands[0]).toMatchObject({ type: 'CopyEntity', id: 'e1' });
    expect(ctx.commands[1]).toMatchObject({ type: 'MoveEntity', dx: 5, dy: 3 });
    expect(ctx.cancelled).toBe(true);
  });

  it('sets status -1 when no entities selected', () => {
    const { handler } = setup([]);
    expect(handler.status).toBe(-1);
  });

  it('escape at status 1 resets', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onKeyDown(1, 'Escape');
    expect(handler.status).toBe(0);
  });
});
