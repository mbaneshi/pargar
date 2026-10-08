import { describe, it, expect } from 'vitest';
import { CircleHandler } from '../CircleHandler';
import { createMockContext } from './mockToolContext';

describe('CircleHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new CircleHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates a circle from center and radius point', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 5, y: 5 });
    expect(handler.status).toBe(1);

    handler.onCoordinateInput(1, { x: 8, y: 9 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateCircle',
      cx: 5,
      cy: 5,
    });
    expect(handler.status).toBe(0);
  });

  it('diameter sub-command toggles mode', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.onCommandInput(1, 'diameter')).toBe(true);
    expect(handler.getPrompt()).toContain('diameter');
  });

  it('accepts radius as numeric input', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.onCommandInput(1, '5')).toBe(true);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateCircle',
      cx: 0,
      cy: 0,
      radius: 5,
    });
  });

  it('diameter mode halves the input value', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCommandInput(1, 'diameter');
    handler.onCommandInput(1, '10');
    expect(ctx.commands[0]).toMatchObject({ radius: 5 });
  });

  it('escape resets', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.onKeyDown(1, 'Escape')).toBe('HANDLED');
    expect(handler.status).toBe(0);
  });

  it('rejects too-small radius', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 0.001, y: 0 });
    expect(ctx.commands).toHaveLength(0);
  });
});
