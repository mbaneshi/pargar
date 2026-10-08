import { describe, it, expect } from 'vitest';
import { MoveHandler } from '../MoveHandler';
import { createMockContext } from './mockToolContext';

describe('MoveHandler', () => {
  function setup(selectedIds: string[] = ['e1', 'e2']) {
    const ctx = createMockContext({ selectedIds });
    const handler = new MoveHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('moves selected entities by displacement', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 }); // base point
    handler.onCoordinateInput(1, { x: 5, y: 3 }); // displacement

    expect(ctx.commands).toHaveLength(2);
    expect(ctx.commands[0]).toMatchObject({ type: 'MoveEntity', id: 'e1', dx: 5, dy: 3 });
    expect(ctx.commands[1]).toMatchObject({ type: 'MoveEntity', id: 'e2', dx: 5, dy: 3 });
    expect(ctx.cancelled).toBe(true);
  });

  it('sets status -1 when no entities selected', () => {
    const { handler } = setup([]);
    expect(handler.status).toBe(-1);
  });

  it('escape at status 1 resets to 0', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onKeyDown(1, 'Escape');
    expect(handler.status).toBe(0);
  });

  it('prompt reflects no-selection state', () => {
    const { handler } = setup([]);
    expect(handler.getPrompt()).toContain('Select');
  });
});
