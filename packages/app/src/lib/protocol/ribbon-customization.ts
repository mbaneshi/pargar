export interface RibbonCustomization {
  hiddenTabs: string[];
  hiddenPanels: Record<string, string[]>;
}

export const RIBBON_CUSTOMIZE_STORAGE_KEY = 'nexus:ribbonCustomize';

function isValidCustomization(value: unknown): value is RibbonCustomization {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.hiddenTabs) &&
    v.hiddenTabs.every((t) => typeof t === 'string') &&
    typeof v.hiddenPanels === 'object' &&
    v.hiddenPanels !== null &&
    !Array.isArray(v.hiddenPanels) &&
    Object.values(v.hiddenPanels as Record<string, unknown>).every(
      (labels) => Array.isArray(labels) && labels.every((label) => typeof label === 'string'),
    )
  );
}

export function loadRibbonCustomization(): RibbonCustomization {
  try {
    const saved = localStorage.getItem(RIBBON_CUSTOMIZE_STORAGE_KEY);
    if (!saved) return { hiddenTabs: [], hiddenPanels: {} };
    const parsed = JSON.parse(saved);
    return isValidCustomization(parsed) ? parsed : { hiddenTabs: [], hiddenPanels: {} };
  } catch {
    return { hiddenTabs: [], hiddenPanels: {} };
  }
}

export function saveRibbonCustomization(state: RibbonCustomization): void {
  try {
    localStorage.setItem(RIBBON_CUSTOMIZE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore localStorage errors, same as saveRibbonDock in AppState.svelte.ts
  }
}

export function filterHiddenTabs<T extends { id: string }>(
  tabs: T[],
  hiddenTabIds: Set<string>,
): T[] {
  return tabs.filter((t) => !hiddenTabIds.has(t.id));
}

export function filterVisiblePanels<T extends { label: string }>(
  panels: T[],
  hiddenPanelLabels: string[],
): T[] {
  return panels.filter((p) => !hiddenPanelLabels.includes(p.label));
}
