import { describe, it, expect } from 'vitest';
import { RectHandler } from '../RectHandler';
import { createMockContext } from './mockToolContext';

describe('RectHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new RectHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates a rectangle from two corners', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 5 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateRectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 5,
    });
  });

  it('normalizes when second corner is before first', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 10, y: 10 });
    handler.onCoordinateInput(1, { x: 0, y: 0 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateRectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('rejects degenerate rectangle', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 0, y: 5 }); // zero width
    expect(ctx.commands).toHaveLength(0);
  });

  it('escape resets to status 0', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.status).toBe(1);
    handler.onKeyDown(1, 'Escape');
    expect(handler.status).toBe(0);
  });

  it('prompts change with status', () => {
    const { handler } = setup();
    expect(handler.getPrompt()).toContain('first corner');
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.getPrompt()).toContain('other corner');
  });
});
