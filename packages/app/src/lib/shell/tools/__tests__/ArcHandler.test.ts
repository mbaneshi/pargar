import { describe, it, expect } from 'vitest';
import { ArcHandler } from '../ArcHandler';
import { createMockContext } from './mockToolContext';

describe('ArcHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new ArcHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates an arc from center, start, end', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 }); // center
    expect(handler.status).toBe(1);

    handler.onCoordinateInput(1, { x: 5, y: 0 }); // start point (radius=5, angle=0)
    expect(handler.status).toBe(2);

    handler.onCoordinateInput(2, { x: 0, y: 5 }); // end point (angle=PI/2)
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateArc',
      cx: 0,
      cy: 0,
      radius: 5,
    });
    expect(handler.status).toBe(0);
  });

  it('rejects too-small radius', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 0.001, y: 0 });
    handler.onCoordinateInput(2, { x: 0, y: 0.001 });
    expect(ctx.commands).toHaveLength(0);
  });

  it('escape at status 2 resets', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 5, y: 0 });
    expect(handler.onKeyDown(2, 'Escape')).toBe('HANDLED');
    expect(handler.status).toBe(0);
  });

  it('prompts cycle through three steps', () => {
    const { handler } = setup();
    expect(handler.getPrompt()).toContain('center');
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.getPrompt()).toContain('start');
    handler.onCoordinateInput(1, { x: 5, y: 0 });
    expect(handler.getPrompt()).toContain('end');
  });
});
