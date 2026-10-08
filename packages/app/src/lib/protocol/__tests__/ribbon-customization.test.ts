// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RIBBON_CUSTOMIZE_STORAGE_KEY,
  loadRibbonCustomization,
  saveRibbonCustomization,
  filterHiddenTabs,
  filterVisiblePanels,
} from '../ribbon-customization';

describe('loadRibbonCustomization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty defaults when nothing is stored', () => {
    expect(loadRibbonCustomization()).toEqual({ hiddenTabs: [], hiddenPanels: {} });
  });

  it('returns previously saved state', () => {
    localStorage.setItem(
      RIBBON_CUSTOMIZE_STORAGE_KEY,
      JSON.stringify({ hiddenTabs: ['insert'], hiddenPanels: { home: ['modify'] } }),
    );
    expect(loadRibbonCustomization()).toEqual({
      hiddenTabs: ['insert'],
      hiddenPanels: { home: ['modify'] },
    });
  });

  it('returns empty defaults when stored JSON is malformed', () => {
    localStorage.setItem(RIBBON_CUSTOMIZE_STORAGE_KEY, 'not json');
    expect(loadRibbonCustomization()).toEqual({ hiddenTabs: [], hiddenPanels: {} });
  });

  it('returns empty defaults when stored shape is wrong', () => {
    localStorage.setItem(RIBBON_CUSTOMIZE_STORAGE_KEY, JSON.stringify({ hiddenTabs: 'nope' }));
    expect(loadRibbonCustomization()).toEqual({ hiddenTabs: [], hiddenPanels: {} });
  });

  it('returns empty defaults when a hiddenPanels value is not a string array', () => {
    localStorage.setItem(
      RIBBON_CUSTOMIZE_STORAGE_KEY,
      JSON.stringify({ hiddenTabs: [], hiddenPanels: { home: 123 } }),
    );
    expect(loadRibbonCustomization()).toEqual({ hiddenTabs: [], hiddenPanels: {} });
  });

  it('does not throw when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadRibbonCustomization()).toEqual({ hiddenTabs: [], hiddenPanels: {} });
    spy.mockRestore();
  });
});

describe('saveRibbonCustomization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips through loadRibbonCustomization', () => {
    const state = { hiddenTabs: ['insert', 'parametric'], hiddenPanels: { home: ['draw'] } };
    saveRibbonCustomization(state);
    expect(loadRibbonCustomization()).toEqual(state);
  });

  it('does not throw when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveRibbonCustomization({ hiddenTabs: [], hiddenPanels: {} })).not.toThrow();
    spy.mockRestore();
  });
});

describe('filterHiddenTabs', () => {
  const tabs = [{ id: 'home' }, { id: 'insert' }, { id: 'view' }];

  it('removes tabs whose id is in hiddenTabIds', () => {
    const result = filterHiddenTabs(tabs, new Set(['insert']));
    expect(result.map((t) => t.id)).toEqual(['home', 'view']);
  });

  it('returns all tabs when nothing is hidden', () => {
    expect(filterHiddenTabs(tabs, new Set())).toEqual(tabs);
  });

  it('returns empty array when everything is hidden', () => {
    expect(filterHiddenTabs(tabs, new Set(['home', 'insert', 'view']))).toEqual([]);
  });
});

describe('filterVisiblePanels', () => {
  const panels = [{ label: 'Select' }, { label: 'Draw' }, { label: 'Modify' }];

  it('removes panels whose label is hidden', () => {
    const result = filterVisiblePanels(panels, ['Draw']);
    expect(result.map((p) => p.label)).toEqual(['Select', 'Modify']);
  });

  it('returns all panels when nothing is hidden', () => {
    expect(filterVisiblePanels(panels, [])).toEqual(panels);
  });
});
