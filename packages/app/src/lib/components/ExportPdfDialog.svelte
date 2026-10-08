<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  let { visible = $bindable(false) } = $props<{ visible: boolean }>();

  const app = getContext<AppState>('app');

  let paperSize = $state<'a4' | 'a3' | 'letter'>('a4');
  let orientation = $state<'portrait' | 'landscape'>('landscape');
  let exporting = $state(false);
  let error = $state('');

  type ScalePreset = 'fit' | '1' | '2' | '5' | '10' | '20' | '50' | '100' | 'custom';
  let scalePreset = $state<ScalePreset>('fit');
  let customScale = $state(1);

  type PlotArea = 'extents' | 'current_view';
  let plotArea = $state<PlotArea>('extents');

  let showLineweights = $state(true);

  const scaleValue = $derived<number | undefined>(() => {
    if (scalePreset === 'fit') return undefined;
    if (scalePreset === 'custom') return customScale > 0 ? customScale : 1;
    return Number(scalePreset);
  });

  function getEntityCount(): number {
    if (!app.kernel) return 0;
    try {
      const entities = JSON.parse(app.kernel.get_entities_json());
      return entities.length;
    } catch {
      return 0;
    }
  }

  const entityCount = $derived(getEntityCount());

  const scaleLabel = $derived(
    scalePreset === 'fit'
      ? 'Fit to Page'
      : scalePreset === 'custom'
        ? `1:${customScale}`
        : `1:${scalePreset}`,
  );

  const paperLabel = $derived(
    `${paperSize.toUpperCase()} ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`,
  );

  const areaLabel = $derived(plotArea === 'extents' ? 'Extents' : 'Current View');

  async function handleExport() {
    exporting = true;
    error = '';
    try {
      let viewBounds: { minX: number; minY: number; maxX: number; maxY: number } | undefined;
      if (plotArea === 'current_view' && app.renderer) {
        viewBounds = app.renderer.getViewBounds();
      }

      await app.handleExportPdf({
        paperSize,
        orientation,
        scale: scaleValue(),
        viewBounds,
        showLineweights,
      });
      visible = false;
    } catch (e: any) {
      error = e.message || 'Export failed';
    }
    exporting = false;
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={() => (visible = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="header">
        <h2>Plot</h2>
        <button class="close" onclick={() => (visible = false)}>&times;</button>
      </div>

      <div class="body">
        <label class="field">
          <span>Paper Size</span>
          <select bind:value={paperSize} disabled={exporting}>
            <option value="a4">A4</option>
            <option value="a3">A3</option>
            <option value="letter">Letter</option>
          </select>
        </label>

        <fieldset class="field" disabled={exporting}>
          <legend>Orientation</legend>
          <label class="radio-label">
            <input type="radio" bind:group={orientation} value="portrait" />
            <span>Portrait</span>
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={orientation} value="landscape" />
            <span>Landscape</span>
          </label>
        </fieldset>

        <label class="field">
          <span>What to Plot</span>
          <select bind:value={plotArea} disabled={exporting}>
            <option value="extents">Extents</option>
            <option value="current_view">Current View</option>
          </select>
        </label>

        <label class="field">
          <span>Scale</span>
          <select bind:value={scalePreset} disabled={exporting}>
            <option value="fit">Fit to Page</option>
            <option value="1">1:1</option>
            <option value="2">1:2</option>
            <option value="5">1:5</option>
            <option value="10">1:10</option>
            <option value="20">1:20</option>
            <option value="50">1:50</option>
            <option value="100">1:100</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        {#if scalePreset === 'custom'}
          <label class="field">
            <span>Custom Scale (1:n)</span>
            <input
              type="number"
              bind:value={customScale}
              min="0.01"
              step="1"
              disabled={exporting}
              class="custom-input"
            />
          </label>
        {/if}

        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showLineweights} disabled={exporting} />
          <span>Display lineweights</span>
        </label>

        <div class="preview">
          Paper: {paperLabel} | Scale: {scaleLabel} | Area: {areaLabel} | {entityCount} entities
        </div>

        {#if error}
          <div class="error">{error}</div>
        {/if}
      </div>

      <div class="footer">
        <button class="cancel" onclick={() => (visible = false)} disabled={exporting}>Cancel</button
        >
        <button class="export" onclick={handleExport} disabled={exporting}>
          {#if exporting}
            Exporting...
          {:else}
            Plot to PDF
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-project-browser);
  }

  .modal {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-2xl);
    width: 400px;
    box-shadow: var(--shadow-modal);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xl) var(--space-2xl);
    border-bottom: 1px solid var(--color-bg-input);
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-heading);
    font-weight: 600;
  }

  .close {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0 var(--space-sm);
  }
  .close:hover {
    color: var(--color-text-bright);
  }

  .body {
    padding: var(--space-xl) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border: none;
    padding: 0;
    margin: 0;
  }
  .field span,
  .field legend {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    padding: 0;
  }
  .field select,
  .custom-input {
    padding: 8px var(--space-lg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-input);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }
  .field select:focus,
  .custom-input:focus {
    border-color: var(--color-accent);
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: 0.85rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .radio-label input[type='radio'] {
    accent-color: var(--color-accent);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: 0.85rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox'] {
    accent-color: var(--color-accent);
  }

  .preview {
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    background: var(--color-bg-input);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-family: monospace;
    line-height: 1.5;
  }

  .error {
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    background: rgba(233, 69, 96, 0.15);
    color: var(--color-danger);
    font-size: 0.78rem;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    padding: var(--space-lg) var(--space-2xl) var(--space-xl);
    border-top: 1px solid var(--color-bg-input);
  }

  .footer button {
    padding: 8px 20px;
    border-radius: var(--radius-xl);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .cancel {
    background: var(--color-bg-input);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-input) !important;
  }
  .cancel:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .export {
    background: var(--color-accent);
    color: var(--color-text-bright);
  }
  .export:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .export:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
