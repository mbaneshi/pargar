import { describe, it, expect, vi } from 'vitest';
import { BatchPickHelper } from '../BatchPickHelper';

function mockKernel(ids: string[] = []) {
  return { query_spatial_window: vi.fn(() => JSON.stringify(ids)) };
}

describe('BatchPickHelper', () => {
  it('starts inactive', () => {
    expect(new BatchPickHelper().isActive()).toBe(false);
  });

  it('handleClick returns false when no mode', () => {
    expect(new BatchPickHelper().handleClick({ x: 0, y: 0 })).toBe(false);
  });

  describe('crossing mode', () => {
    it('activates on startCrossing', () => {
      const h = new BatchPickHelper();
      h.startCrossing(mockKernel(), () => {});
      expect(h.isActive()).toBe(true);
    });

    it('triggers finish after 2 clicks', () => {
      const h = new BatchPickHelper();
      const onComplete = vi.fn();
      h.startCrossing(mockKernel(['id_1', 'id_2']), onComplete);
      h.handleClick({ x: 0, y: 0 });
      expect(onComplete).not.toHaveBeenCalled();
      h.handleClick({ x: 10, y: 10 });
      expect(onComplete).toHaveBeenCalledWith(['id_1', 'id_2']);
      expect(h.isActive()).toBe(false);
    });

    it('passes min/max coords to kernel', () => {
      const h = new BatchPickHelper();
      const kernel = mockKernel();
      h.startCrossing(kernel, () => {});
      h.handleClick({ x: 10, y: 20 });
      h.handleClick({ x: 5, y: 8 });
      expect(kernel.query_spatial_window).toHaveBeenCalledWith(5, 8, 10, 20);
    });

    it('prompt changes per click', () => {
      const h = new BatchPickHelper();
      h.startCrossing(mockKernel(), () => {});
      expect(h.getPrompt()).toBe('Specify first corner:');
      h.handleClick({ x: 0, y: 0 });
      expect(h.getPrompt()).toBe('Specify opposite corner:');
    });
  });

  describe('fence mode', () => {
    it('collects points without auto-finishing', () => {
      const h = new BatchPickHelper();
      const onComplete = vi.fn();
      h.startFence(mockKernel(), onComplete);
      h.handleClick({ x: 0, y: 0 });
      h.handleClick({ x: 10, y: 0 });
      h.handleClick({ x: 10, y: 10 });
      expect(onComplete).not.toHaveBeenCalled();
      expect(h.points).toHaveLength(3);
    });

    it('finish triggers callback', () => {
      const h = new BatchPickHelper();
      const kernel = mockKernel(['id_3']);
      const onComplete = vi.fn();
      h.startFence(kernel, onComplete);
      h.handleClick({ x: 5, y: 2 });
      h.handleClick({ x: 15, y: 12 });
      h.finish();
      expect(kernel.query_spatial_window).toHaveBeenCalledWith(5, 2, 15, 12);
      expect(onComplete).toHaveBeenCalledWith(['id_3']);
    });
  });

  it('cancel resets state', () => {
    const h = new BatchPickHelper();
    h.startCrossing(mockKernel(), () => {});
    h.handleClick({ x: 0, y: 0 });
    h.cancel();
    expect(h.isActive()).toBe(false);
    expect(h.points).toHaveLength(0);
  });

  it('getPrompt returns empty when no mode', () => {
    expect(new BatchPickHelper().getPrompt()).toBe('');
  });
});
