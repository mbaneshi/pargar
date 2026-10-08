<script lang="ts">
  import type { ToolbarVariant } from '$lib/protocol/toolbar-layout';

  let {
    commandId,
    label,
    variants,
    active = false,
    onactivate,
  }: {
    commandId: string;
    label: string;
    variants: ToolbarVariant[];
    active: boolean;
    onactivate: () => void;
  } = $props();

  let flyoutOpen = $state(false);
  let containerEl: HTMLDivElement | undefined = $state(undefined);

  const storageKey = `nexus-split-${commandId}`;

  let currentLabel = $state(loadLastVariant());

  function loadLastVariant(): string {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const found = variants.find((v) => v.label === stored);
        if (found) return found.label;
      }
    } catch {
      // localStorage unavailable
    }
    return variants[0]?.label ?? label;
  }

  function selectVariant(variant: ToolbarVariant) {
    currentLabel = variant.label;
    try {
      localStorage.setItem(storageKey, variant.label);
    } catch {
      // localStorage unavailable
    }
    flyoutOpen = false;
    onactivate();
  }

  function handleMainClick() {
    onactivate();
  }

  function toggleFlyout(e: MouseEvent) {
    e.stopPropagation();
    flyoutOpen = !flyoutOpen;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && flyoutOpen) {
      flyoutOpen = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (flyoutOpen && containerEl && !containerEl.contains(e.target as Node)) {
      flyoutOpen = false;
    }
  }

  $effect(() => {
    if (flyoutOpen) {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('keydown', handleKeydown, true);
      return () => {
        document.removeEventListener('click', handleClickOutside, true);
        document.removeEventListener('keydown', handleKeydown, true);
      };
    }
  });
</script>

<div class="split-button" bind:this={containerEl}>
  <button
    class="split-main"
    class:active
    onclick={handleMainClick}
    title="{label} ({currentLabel})"
  >
    {currentLabel}
  </button>
  <button
    class="split-arrow"
    class:active
    onclick={toggleFlyout}
    title="More {label} options"
    aria-haspopup="true"
    aria-expanded={flyoutOpen}
  >
    <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor">
      <path d="M0 0l4 5 4-5z" />
    </svg>
  </button>

  {#if flyoutOpen}
    <div class="flyout" role="menu">
      {#each variants as variant (variant.label)}
        <button
          class="flyout-item"
          class:flyout-item-active={variant.label === currentLabel}
          role="menuitem"
          onclick={() => selectVariant(variant)}
        >
          <span class="flyout-label">{variant.label}</span>
          <span class="flyout-desc">{variant.description}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .split-button {
    display: inline-flex;
    position: relative;
  }

  .split-main {
    background: var(--color-bg-secondary);
    border: 1px solid transparent;
    border-bottom: 2px solid transparent;
    border-right: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-sm);
    white-space: nowrap;
    transition:
      background-color 100ms ease,
      border-color 100ms ease,
      color 100ms ease;
  }

  .split-main:hover {
    background: var(--color-bg-hover);
  }

  .split-main:active {
    background: var(--color-bg-active);
  }

  .split-main.active {
    border-bottom-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-bg-active);
  }

  .split-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    background: var(--color-bg-secondary);
    border: 1px solid transparent;
    border-bottom: 2px solid transparent;
    border-left: 1px solid var(--color-border);
    color: var(--color-text-muted);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    cursor: pointer;
    padding: 0;
    transition:
      background-color 100ms ease,
      border-color 100ms ease,
      color 100ms ease;
  }

  .split-arrow:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .split-arrow.active {
    border-bottom-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-bg-active);
  }

  .flyout {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10000;
    min-width: 200px;
    max-width: 220px;
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-sm);
    padding: var(--space-xs) 0;
    margin-top: 2px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .flyout-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background-color 100ms ease;
  }

  .flyout-item:hover {
    background: var(--color-bg-hover);
  }

  .flyout-item-active {
    background: var(--color-bg-active);
  }

  .flyout-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .flyout-desc {
    font-size: var(--font-size-2xs);
    color: var(--color-text-muted);
    margin-top: 1px;
  }
</style>
