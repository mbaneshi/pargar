import { describe, it, expect, vi } from 'vitest';
import { UIEventBus } from '../UIEventBus';

describe('UIEventBus', () => {
  it('calls listener on emit', () => {
    const bus = new UIEventBus();
    const fn = vi.fn();
    bus.on('entities:created', fn);
    bus.emit('entities:created');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call listener for other channels', () => {
    const bus = new UIEventBus();
    const fn = vi.fn();
    bus.on('entities:created', fn);
    bus.emit('entities:deleted');
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes via returned function', () => {
    const bus = new UIEventBus();
    const fn = vi.fn();
    const unsub = bus.on('entities:created', fn);
    unsub();
    bus.emit('entities:created');
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multiple listeners on same channel', () => {
    const bus = new UIEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('layers:changed', a);
    bus.on('layers:changed', b);
    bus.emit('layers:changed');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('emitMany deduplicates channels', () => {
    const bus = new UIEventBus();
    const fn = vi.fn();
    bus.on('entities:created', fn);
    bus.emitMany(['entities:created', 'entities:created', 'entities:created']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('emitMany fires multiple distinct channels', () => {
    const bus = new UIEventBus();
    const created = vi.fn();
    const modified = vi.fn();
    bus.on('entities:created', created);
    bus.on('entities:modified', modified);
    bus.emitMany(['entities:created', 'entities:modified']);
    expect(created).toHaveBeenCalledTimes(1);
    expect(modified).toHaveBeenCalledTimes(1);
  });

  it('listenerCount returns correct count', () => {
    const bus = new UIEventBus();
    expect(bus.listenerCount('entities:created')).toBe(0);
    const unsub1 = bus.on('entities:created', () => {});
    const unsub2 = bus.on('entities:created', () => {});
    expect(bus.listenerCount('entities:created')).toBe(2);
    unsub1();
    expect(bus.listenerCount('entities:created')).toBe(1);
    unsub2();
    expect(bus.listenerCount('entities:created')).toBe(0);
  });

  it('clear removes all listeners', () => {
    const bus = new UIEventBus();
    const fn = vi.fn();
    bus.on('entities:created', fn);
    bus.on('layers:changed', fn);
    bus.clear();
    bus.emit('entities:created');
    bus.emit('layers:changed');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emit with no listeners is a no-op', () => {
    const bus = new UIEventBus();
    expect(() => bus.emit('entities:created')).not.toThrow();
  });
});
