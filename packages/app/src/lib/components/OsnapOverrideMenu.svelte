<script lang="ts">
  // Canonical AutoCAD OSNAP override menu (Shift+RClick). Modes implemented in
  // the kernel are clickable; the rest are rendered disabled with a tooltip so
  // we don't lie about parity. See packages/kernel/src/snap_queries.rs:65-80
  // for the implemented set.

  type SnapMode =
    | 'endpoint'
    | 'midpoint'
    | 'intersection'
    | 'apparent_intersection'
    | 'extension'
    | 'center'
    | 'geometric_center'
    | 'quadrant'
    | 'tangent'
    | 'perpendicular'
    | 'parallel'
    | 'node'
    | 'insert'
    | 'nearest'
    | 'from'
    | 'mid_between_two_points'
    | 'none';

  let {
    x,
    y,
    visible,
    onClose,
    onOverride,
    onOpenSettings,
  }: {
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    onOverride: (mode: SnapMode) => void;
    onOpenSettings: () => void;
  } = $props();

  // Implemented in kernel today. Anything outside this set is disabled.
  const IMPLEMENTED = new Set<SnapMode>([
    'endpoint',
    'midpoint',
    'intersection',
    'center',
    'quadrant',
    'perpendicular',
    'nearest',
    'none',
  ]);

  type Item =
    | { kind: 'override'; label: string; mode: SnapMode }
    | { kind: 'separator' }
    | { kind: 'settings'; label: string };

  const ITEMS: Item[] = [
    { kind: 'override', label: 'From', mode: 'from' },
    { kind: 'override', label: 'Mid Between 2 Points', mode: 'mid_between_two_points' },
    { kind: 'separator' },
    { kind: 'override', label: 'Endpoint', mode: 'endpoint' },
    { kind: 'override', label: 'Midpoint', mode: 'midpoint' },
    { kind: 'override', label: 'Intersection', mode: 'intersection' },
    { kind: 'override', label: 'Apparent Intersection', mode: 'apparent_intersection' },
    { kind: 'override', label: 'Extension', mode: 'extension' },
    { kind: 'separator' },
    { kind: 'override', label: 'Center', mode: 'center' },
    { kind: 'override', label: 'Geometric Center', mode: 'geometric_center' },
    { kind: 'override', label: 'Quadrant', mode: 'quadrant' },
    { kind: 'override', label: 'Tangent', mode: 'tangent' },
    { kind: 'separator' },
    { kind: 'override', label: 'Perpendicular', mode: 'perpendicular' },
    { kind: 'override', label: 'Parallel', mode: 'parallel' },
    { kind: 'override', label: 'Node', mode: 'node' },
    { kind: 'override', label: 'Insert', mode: 'insert' },
    { kind: 'override', label: 'Nearest', mode: 'nearest' },
    { kind: 'separator' },
    { kind: 'override', label: 'None', mode: 'none' },
    { kind: 'settings', label: 'Osnap Settings...' },
  ];

  let menuX = $derived.by(() => {
    const w = 240;
    return x + w > globalThis.innerWidth ? x - w : x;
  });

  let menuY = $derived.by(() => {
    const h = ITEMS.length * 28;
    const flipped = y + h > globalThis.innerHeight ? y - h : y;
    // Clamp top so the menu never starts above the viewport.
    return Math.max(0, flipped);
  });

  function handleOverride(mode: SnapMode) {
    onOverride(mode);
    onClose();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (visible && e.key === 'Escape') onClose();
  }}
/>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onClose}></div>
  <div class="osnap-menu" style="left: {menuX}px; top: {menuY}px" data-testid="osnap-override-menu">
    {#each ITEMS as item, i (i)}
      {#if item.kind === 'separator'}
        <div class="separator"></div>
      {:else if item.kind === 'override'}
        {@const enabled = IMPLEMENTED.has(item.mode)}
        <button
          class="item"
          disabled={!enabled}
          title={enabled ? '' : 'not yet implemented'}
          onclick={() => handleOverride(item.mode)}
        >
          {item.label}
        </button>
      {:else}
        <button
          class="item"
          onclick={() => {
            onOpenSettings();
            onClose();
          }}
        >
          {item.label}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-context-backdrop);
  }

  .osnap-menu {
    position: fixed;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) 0;
    min-width: 240px;
    z-index: var(--z-context-menu);
    box-shadow: var(--shadow-menu);
  }

  .item {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-xl);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    cursor: pointer;
    text-align: left;
  }

  .item:hover:not(:disabled) {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }

  .item:disabled {
    color: var(--color-text-dim);
    cursor: default;
  }

  .separator {
    height: 1px;
    background: var(--color-border-input);
    margin: var(--space-sm) 0;
  }
</style>
