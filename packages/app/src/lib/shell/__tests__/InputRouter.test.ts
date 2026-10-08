import { describe, it, expect, vi } from 'vitest';
import { InputRouter } from '../InputRouter';
import type { InputHandler } from '../InputRouter';
import type { InputEvent } from '../InputEvent';

function makeEvent(key = 'a'): InputEvent {
  return {
    type: 'KEY_DOWN',
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };
}

function makeHandler(id: string, priority: number, consume = true): InputHandler {
  return {
    id,
    priority,
    handle: vi.fn(() => consume),
  };
}

describe('InputRouter', () => {
  it('dispatches to single handler', () => {
    const router = new InputRouter();
    const h = makeHandler('test', 100);
    router.register(h);
    const consumed = router.dispatch(makeEvent());
    expect(consumed).toBe(true);
    expect(h.handle).toHaveBeenCalledTimes(1);
  });

  it('dispatches in priority order (higher first)', () => {
    const router = new InputRouter();
    const order: string[] = [];
    const low: InputHandler = {
      id: 'low',
      priority: 100,
      handle: () => {
        order.push('low');
        return false;
      },
    };
    const high: InputHandler = {
      id: 'high',
      priority: 500,
      handle: () => {
        order.push('high');
        return false;
      },
    };
    router.register(low);
    router.register(high);
    router.dispatch(makeEvent());
    expect(order).toEqual(['high', 'low']);
  });

  it('stops at first handler that returns true', () => {
    const router = new InputRouter();
    const high = makeHandler('high', 500, true);
    const low = makeHandler('low', 100, true);
    router.register(low);
    router.register(high);
    router.dispatch(makeEvent());
    expect(high.handle).toHaveBeenCalledTimes(1);
    expect(low.handle).not.toHaveBeenCalled();
  });

  it('falls through when handler returns false', () => {
    const router = new InputRouter();
    const high = makeHandler('high', 500, false);
    const low = makeHandler('low', 100, true);
    router.register(low);
    router.register(high);
    const consumed = router.dispatch(makeEvent());
    expect(consumed).toBe(true);
    expect(high.handle).toHaveBeenCalled();
    expect(low.handle).toHaveBeenCalled();
  });

  it('returns false when no handler consumes', () => {
    const router = new InputRouter();
    const h = makeHandler('test', 100, false);
    router.register(h);
    expect(router.dispatch(makeEvent())).toBe(false);
  });

  it('returns false when no handlers registered', () => {
    const router = new InputRouter();
    expect(router.dispatch(makeEvent())).toBe(false);
  });

  it('unregister removes handler', () => {
    const router = new InputRouter();
    const h = makeHandler('test', 100);
    const unsub = router.register(h);
    unsub();
    router.dispatch(makeEvent());
    expect(h.handle).not.toHaveBeenCalled();
  });

  it('has() returns correct state', () => {
    const router = new InputRouter();
    const h = makeHandler('escape', 500);
    expect(router.has('escape')).toBe(false);
    const unsub = router.register(h);
    expect(router.has('escape')).toBe(true);
    unsub();
    expect(router.has('escape')).toBe(false);
  });

  it('clear() removes all handlers', () => {
    const router = new InputRouter();
    router.register(makeHandler('a', 100));
    router.register(makeHandler('b', 200));
    router.clear();
    expect(router.has('a')).toBe(false);
    expect(router.has('b')).toBe(false);
  });

  it('handles dynamic registration between dispatches', () => {
    const router = new InputRouter();
    const h1 = makeHandler('first', 100, false);
    router.register(h1);
    router.dispatch(makeEvent());

    const h2 = makeHandler('second', 200, true);
    router.register(h2);
    router.dispatch(makeEvent());
    expect(h2.handle).toHaveBeenCalledTimes(1);
  });
});
