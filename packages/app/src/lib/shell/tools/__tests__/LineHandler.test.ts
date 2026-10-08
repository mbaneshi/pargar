import { describe, it, expect } from 'vitest';
import { LineHandler } from '../LineHandler';
import { createMockContext } from './mockToolContext';

describe('LineHandler', () => {
  function setup() {
    const ctx = createMockContext();
    const handler = new LineHandler();
    handler.activate(ctx);
    return { handler, ctx };
  }

  it('creates a line from two points', () => {
    const { handler, ctx } = setup();
    expect(handler.status).toBe(0);

    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.status).toBe(1);

    handler.onCoordinateInput(1, { x: 10, y: 5 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateLine',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 5,
    });
  });

  it('chains segments — stays at status 1', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 10 });
    expect(handler.status).toBe(1);
    expect(ctx.commands).toHaveLength(2);
  });

  it('close sub-command creates closing segment', () => {
    const { handler, ctx } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 0 });
    handler.onCoordinateInput(1, { x: 10, y: 10 });

    const handled = handler.onCommandInput(1, 'close');
    expect(handled).toBe(true);
    expect(ctx.commands).toHaveLength(3);
    expect(ctx.commands[2]).toMatchObject({
      type: 'CreateLine',
      x1: 10,
      y1: 10,
      x2: 0,
      y2: 0,
    });
    expect(ctx.cancelled).toBe(true);
  });

  it('close not available with fewer than 3 segments', () => {
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

  it('escape at status 1 resets to 0', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.status).toBe(1);
    const result = handler.onKeyDown(1, 'Escape');
    expect(result).toBe('HANDLED');
    expect(handler.status).toBe(0);
  });

  it('escape at status 0 passes through', () => {
    const { handler } = setup();
    const result = handler.onKeyDown(0, 'Escape');
    expect(result).toBe('PASS_THROUGH');
  });

  it('right-click at status 0 cancels tool', () => {
    const { handler, ctx } = setup();
    handler.onRightClick(0);
    expect(ctx.cancelled).toBe(true);
  });

  it('prompt changes with status', () => {
    const { handler } = setup();
    expect(handler.getPrompt()).toContain('first point');
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    expect(handler.getPrompt()).toContain('next point');
  });

  it('getAvailableCommands includes Close after 2+ chains', () => {
    const { handler } = setup();
    handler.onCoordinateInput(0, { x: 0, y: 0 });
    handler.onCoordinateInput(1, { x: 1, y: 0 });
    expect(handler.getAvailableCommands()).not.toContain('Close');

    handler.onCoordinateInput(1, { x: 1, y: 1 });
    handler.onCoordinateInput(1, { x: 0, y: 1 });
    expect(handler.getAvailableCommands()).toContain('Close');
  });
});
