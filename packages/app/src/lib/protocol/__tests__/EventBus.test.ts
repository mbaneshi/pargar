import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('should call handler on emit', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('command.executed', handler);
    bus.emit('command.executed', {
      commandId: 'line',
      label: 'Line',
      result: { success: true, created_ids: ['ent_1'] },
      source: { type: 'human' },
      timestamp: Date.now(),
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].commandId).toBe('line');
  });

  it('should not call handler after unsubscribe', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('selection.changed', handler);
    unsub();
    bus.emit('selection.changed', { ids: ['1'], previousIds: [] });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers per event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('tool.changed', h1);
    bus.on('tool.changed', h2);
    bus.emit('tool.changed', { toolId: 'circle', previousToolId: 'line' });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should not leak between event types', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('status.updated', handler);
    bus.emit('tool.changed', { toolId: 'x', previousToolId: 'y' } as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('command.executed', handler);
    bus.clear();
    bus.emit('command.executed', {
      commandId: 'line',
      label: 'Line',
      result: { success: true, created_ids: [] },
      source: { type: 'system' },
      timestamp: 0,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should carry agent source metadata', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('command.executed', handler);
    bus.emit('command.executed', {
      commandId: 'draw_line',
      label: 'Draw Line',
      result: { success: true, created_ids: ['ent_5'] },
      source: { type: 'agent', agentId: 'drafting-agent', model: 'claude-opus-4-6' },
      timestamp: Date.now(),
      undoGroupId: 'batch_1',
    });
    const event = handler.mock.calls[0][0];
    expect(event.source.type).toBe('agent');
    expect(event.source.agentId).toBe('drafting-agent');
    expect(event.undoGroupId).toBe('batch_1');
  });
});
