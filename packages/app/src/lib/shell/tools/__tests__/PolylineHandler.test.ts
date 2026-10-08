import { describe, it, expect } from 'vitest';
import { PolylineHandler } from '../PolylineHandler';
import { createMockContext } from './mockToolContext';

describe('PolylineHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new PolylineHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates open polyline on Enter', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 10 });
    handler.onKeyDown(1, 'Enter');

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreatePolyline',
      closed: false,
      vertices: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
    });
  });

  it('creates closed polyline with close sub-command', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 10 });
    handler.onCommandInput(1, 'close');

    expect(ctx.commands[0]).toMatchObject({ closed: true });
  });

  it('close requires at least 3 points', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    expect(handler.onCommandInput(1, 'close')).toBe(false);
  });

  it('undo removes last point', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onCommandInput(1, 'undo');
    expect(handler.getLastPoint()).toEqual({ x: 0, y: 0 });
  });

  it('right-click finishes with 2+ points', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onRightClick(1);
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.cancelled).toBe(true);
  });

  it('escape with fewer than 2 points resets without creating', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onKeyDown(1, 'Escape');
    expect(ctx.commands).toHaveLength(0);
    expect(handler.status).toBe(0);
  });

  it('getAvailableCommands includes Close when 3+ points', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 1, y: 0 });
    expect(handler.getAvailableCommands()).not.toContain('Close');

    handler.onCoordinateInput(1, { x: 1, y: 1 });
    expect(handler.getAvailableCommands()).toContain('Close');
  });
});
