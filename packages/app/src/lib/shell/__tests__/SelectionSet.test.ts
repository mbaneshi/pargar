import { describe, it, expect, vi } from 'vitest';
import { SelectionSet } from '../SelectionSet.svelte';
import { EventBus } from '../../protocol/EventBus';

describe('SelectionSet', () => {
  function create() {
    return new SelectionSet();
  }

  it('starts empty', () => {
    const s = create();
    expect(s.isEmpty()).toBe(true);
    expect(s.count).toBe(0);
    expect(s.getIds()).toEqual([]);
  });

  it('select sets single entity', () => {
    const s = create();
    s.select('e1');
    expect(s.has('e1')).toBe(true);
    expect(s.count).toBe(1);
  });

  it('select replaces previous selection', () => {
    const s = create();
    s.select('e1');
    s.select('e2');
    expect(s.has('e1')).toBe(false);
    expect(s.has('e2')).toBe(true);
    expect(s.count).toBe(1);
  });

  it('toggle adds and removes', () => {
    const s = create();
    s.toggle('e1');
    expect(s.has('e1')).toBe(true);
    s.toggle('e1');
    expect(s.has('e1')).toBe(false);
  });

  it('selectMultiple adds to existing', () => {
    const s = create();
    s.select('e1');
    s.selectMultiple(['e2', 'e3']);
    expect(s.count).toBe(3);
    expect(s.has('e1')).toBe(true);
    expect(s.has('e2')).toBe(true);
    expect(s.has('e3')).toBe(true);
  });

  it('replaceWith clears and sets', () => {
    const s = create();
    s.select('e1');
    s.replaceWith(['e2', 'e3']);
    expect(s.has('e1')).toBe(false);
    expect(s.has('e2')).toBe(true);
    expect(s.count).toBe(2);
  });

  it('clear empties selection', () => {
    const s = create();
    s.selectMultiple(['e1', 'e2', 'e3']);
    s.clear();
    expect(s.isEmpty()).toBe(true);
    expect(s.count).toBe(0);
  });

  it('deselect removes single entity', () => {
    const s = create();
    s.selectMultiple(['e1', 'e2']);
    s.deselect('e1');
    expect(s.has('e1')).toBe(false);
    expect(s.has('e2')).toBe(true);
    expect(s.count).toBe(1);
  });

  it('preselection tracks hover', () => {
    const s = create();
    expect(s.preselectedId).toBeNull();
    s.setPreselect('e1');
    expect(s.preselectedId).toBe('e1');
    s.setPreselect(null);
    expect(s.preselectedId).toBeNull();
  });

  it('gate prevents disallowed entities', () => {
    const s = create();
    s.installGate({
      canSelect: (id) => id.startsWith('allowed_'),
      reason: 'Test gate',
    });
    s.select('blocked_1');
    expect(s.isEmpty()).toBe(true);
    s.select('allowed_1');
    expect(s.has('allowed_1')).toBe(true);
  });

  it('gate filters selectMultiple', () => {
    const s = create();
    s.installGate({
      canSelect: (id) => id !== 'blocked',
      reason: 'Test gate',
    });
    s.selectMultiple(['ok1', 'blocked', 'ok2']);
    expect(s.count).toBe(2);
    expect(s.has('blocked')).toBe(false);
  });

  it('removeGate allows all again', () => {
    const s = create();
    s.installGate({
      canSelect: () => false,
      reason: 'Block all',
    });
    s.select('e1');
    expect(s.isEmpty()).toBe(true);
    s.removeGate();
    s.select('e1');
    expect(s.has('e1')).toBe(true);
  });

  it('getIds returns array', () => {
    const s = create();
    s.selectMultiple(['e1', 'e2']);
    const ids = s.getIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('e1');
    expect(ids).toContain('e2');
  });

  it('getSelectedIds is an alias for getIds', () => {
    const s = create();
    s.selectMultiple(['e1', 'e2']);
    expect(s.getSelectedIds()).toEqual(s.getIds());
  });

  describe('selectedEntity', () => {
    function createWithKernel() {
      const entityData: Record<string, object> = {
        e1: {
          id: 'e1',
          geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
          layer_id: 'layer_0',
          style: {},
        },
        e2: {
          id: 'e2',
          geometry: { Circle: { center: { x: 0, y: 0 }, radius: 5 } },
          layer_id: 'layer_0',
          style: {},
        },
      };
      const mockKernel = {
        get_entity_json: (id: string) => {
          const data = entityData[id];
          return data ? JSON.stringify(data) : '';
        },
        get_entities_json: () => JSON.stringify(Object.values(entityData)),
      };
      return new SelectionSet({ kernel: mockKernel });
    }

    it('select() populates selectedEntity from kernel', () => {
      const s = createWithKernel();
      s.select('e1');
      expect(s.selectedEntity).not.toBeNull();
      expect(s.selectedEntity!.id).toBe('e1');
    });

    it('clear() sets selectedEntity to null', () => {
      const s = createWithKernel();
      s.select('e1');
      expect(s.selectedEntity).not.toBeNull();
      s.clear();
      expect(s.selectedEntity).toBeNull();
    });

    it('toggle() updates selectedEntity for single selection', () => {
      const s = createWithKernel();
      s.toggle('e1');
      expect(s.selectedEntity).not.toBeNull();
      expect(s.selectedEntity!.id).toBe('e1');
    });

    it('toggle() nulls selectedEntity when multiple selected', () => {
      const s = createWithKernel();
      s.toggle('e1');
      s.toggle('e2');
      expect(s.selectedEntity).toBeNull();
    });

    it('toggle() restores selectedEntity when back to single', () => {
      const s = createWithKernel();
      s.toggle('e1');
      s.toggle('e2');
      s.toggle('e2');
      expect(s.selectedEntity).not.toBeNull();
      expect(s.selectedEntity!.id).toBe('e1');
    });

    it('replaceWith() sets selectedEntity for single id', () => {
      const s = createWithKernel();
      s.replaceWith(['e2']);
      expect(s.selectedEntity).not.toBeNull();
      expect(s.selectedEntity!.id).toBe('e2');
    });

    it('replaceWith() nulls selectedEntity for multiple ids', () => {
      const s = createWithKernel();
      s.replaceWith(['e1', 'e2']);
      expect(s.selectedEntity).toBeNull();
    });

    it('selectedEntity is null without kernel', () => {
      const s = create();
      s.select('e1');
      expect(s.selectedEntity).toBeNull();
    });
  });

  describe('SelectionSet event emission', () => {
    function makeKernelStub() {
      return {
        get_entity_json: vi.fn(() => ''),
        entity_count: vi.fn(() => 0),
        get_entities_json: vi.fn(() => '[]'),
      };
    }

    function makeRendererStub() {
      return {
        selectionManager: {
          clear: vi.fn(),
          select: vi.fn(),
        },
        updateSelection: vi.fn(),
        markDirty: vi.fn(),
      };
    }

    function makeWiredSelectionSet() {
      const bus = new EventBus();
      const sel = new SelectionSet();
      sel.setBus(bus);
      sel.updateDeps({ renderer: makeRendererStub(), kernel: makeKernelStub() });
      return { bus, sel };
    }

    it('emits selection.changed on select()', () => {
      const { bus, sel } = makeWiredSelectionSet();
      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.select('ent_1');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({
        ids: ['ent_1'],
        previousIds: [],
      });
    });

    it('emits selection.changed on clear()', () => {
      const { bus, sel } = makeWiredSelectionSet();
      sel.select('ent_1');

      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.clear();

      expect(handler).toHaveBeenCalledWith({
        ids: [],
        previousIds: ['ent_1'],
      });
    });

    it('emits selection.changed on toggle() add', () => {
      const { bus, sel } = makeWiredSelectionSet();
      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.toggle('ent_1');

      expect(handler).toHaveBeenCalledWith({
        ids: ['ent_1'],
        previousIds: [],
      });
    });

    it('emits selection.changed on toggle() remove', () => {
      const { bus, sel } = makeWiredSelectionSet();
      sel.select('ent_1');

      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.toggle('ent_1');

      expect(handler).toHaveBeenCalledWith({
        ids: [],
        previousIds: ['ent_1'],
      });
    });

    it('emits selection.changed on selectMultiple()', () => {
      const { bus, sel } = makeWiredSelectionSet();
      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.selectMultiple(['ent_1', 'ent_2']);

      expect(handler).toHaveBeenCalledOnce();
      const call = handler.mock.calls[0][0];
      expect(call.ids.sort()).toEqual(['ent_1', 'ent_2']);
      expect(call.previousIds).toEqual([]);
    });

    it('emits selection.changed on replaceWith()', () => {
      const { bus, sel } = makeWiredSelectionSet();
      sel.select('ent_1');

      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.replaceWith(['ent_2', 'ent_3']);

      expect(handler).toHaveBeenCalledOnce();
      const call = handler.mock.calls[0][0];
      expect(call.ids.sort()).toEqual(['ent_2', 'ent_3']);
      expect(call.previousIds).toEqual(['ent_1']);
    });

    it('does not emit when selection is unchanged', () => {
      const { bus, sel } = makeWiredSelectionSet();
      sel.select('ent_1');

      const handler = vi.fn();
      bus.on('selection.changed', handler);

      sel.select('ent_1');

      expect(handler).not.toHaveBeenCalled();
    });

    it('works without bus (no crash)', () => {
      const sel = new SelectionSet();
      sel.updateDeps({ renderer: makeRendererStub(), kernel: makeKernelStub() });

      expect(() => sel.select('ent_1')).not.toThrow();
      expect(() => sel.clear()).not.toThrow();
    });
  });
});
