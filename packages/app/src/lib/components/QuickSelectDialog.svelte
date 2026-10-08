<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { Entity, GeometryType } from '$lib/types/kernel';

  let { visible = $bindable(false) }: { visible: boolean } = $props();

  const app = getContext<AppState>('app');

  const entityTypes = [
    'All',
    'Line',
    'Circle',
    'Arc',
    'Polyline',
    'Rectangle',
    'Text',
    'Ellipse',
    'Spline',
    'Point',
    'Dimension',
    'AlignedDimension',
    'ConstructionLine',
    'BlockRef',
    'MText',
    'Hatch',
    'Table',
  ] as const;

  let selectedType = $state('All');
  let selectedLayer = $state('All');
  let colorFilter = $state('');

  let layers = $derived(app.getLayers());

  function getGeometryTypeName(geometry: GeometryType): string {
    const keys = Object.keys(geometry);
    return keys.length > 0 ? keys[0] : '';
  }

  function applyFilter() {
    if (!app.kernel) return;
    try {
      const entities: Entity[] = JSON.parse(app.kernel.get_entities_json());
      const matching = entities.filter((e) => {
        if (selectedType !== 'All') {
          const typeName = getGeometryTypeName(e.geometry);
          if (typeName !== selectedType) return false;
        }
        if (selectedLayer !== 'All') {
          if (e.layer_id !== selectedLayer) return false;
        }
        if (colorFilter.trim()) {
          const filterColor = colorFilter.trim().toLowerCase();
          const entityColor = (e.style?.color || '').toLowerCase();
          const layerObj = layers.find((l) => l.id === e.layer_id);
          const layerColor = (layerObj?.color || '').toLowerCase();
          if (!entityColor.includes(filterColor) && !layerColor.includes(filterColor)) {
            return false;
          }
        }
        return true;
      });
      const ids = matching.map((e) => e.id);
      app.selection.replaceWith(ids);
      app.statusText = `Quick Select: ${ids.length} entities selected`;
      visible = false;
    } catch {
      app.statusText = 'Quick Select: failed to query entities';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      visible = false;
    } else if (e.key === 'Enter') {
      applyFilter();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="qs-overlay" onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="qs-dialog" onkeydown={handleKeydown}>
      <div class="qs-header">
        <h3>Quick Select</h3>
        <button class="qs-close" onclick={() => (visible = false)}>&#x2715;</button>
      </div>

      <div class="qs-body">
        <div class="qs-field">
          <label for="qs-type">Entity Type</label>
          <select id="qs-type" bind:value={selectedType}>
            {#each entityTypes as t (t)}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </div>

        <div class="qs-field">
          <label for="qs-layer">Layer</label>
          <select id="qs-layer" bind:value={selectedLayer}>
            <option value="All">All</option>
            {#each layers as layer (layer.id)}
              <option value={layer.id}>{layer.name}</option>
            {/each}
          </select>
        </div>

        <div class="qs-field">
          <label for="qs-color">Color (optional)</label>
          <input
            id="qs-color"
            type="text"
            bind:value={colorFilter}
            placeholder="e.g. #ff0000 or red"
          />
        </div>
      </div>

      <div class="qs-footer">
        <button class="qs-btn qs-btn-cancel" onclick={() => (visible = false)}>Cancel</button>
        <button class="qs-btn qs-btn-apply" onclick={applyFilter}>Apply</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .qs-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .qs-dialog {
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #444);
    border-radius: var(--radius-lg, 8px);
    width: 360px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .qs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border-light, #333);
  }

  .qs-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-bright, #fff);
  }

  .qs-close {
    background: none;
    border: none;
    color: var(--color-text-secondary, #aaa);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
  }

  .qs-close:hover {
    color: var(--color-text-bright, #fff);
  }

  .qs-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .qs-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .qs-field label {
    font-size: 12px;
    color: var(--color-text-secondary, #aaa);
    font-weight: 500;
  }

  .qs-field select,
  .qs-field input {
    background: var(--color-bg-input, #2a2a3e);
    border: 1px solid var(--color-border, #444);
    color: var(--color-text-primary, #ddd);
    padding: 6px 8px;
    border-radius: var(--radius-md, 4px);
    font-size: 13px;
    font-family: inherit;
  }

  .qs-field select:focus,
  .qs-field input:focus {
    outline: none;
    border-color: var(--color-accent-blue, #3b82f6);
  }

  .qs-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--color-border-light, #333);
  }

  .qs-btn {
    padding: 6px 16px;
    border-radius: var(--radius-md, 4px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .qs-btn-cancel {
    background: var(--color-bg-input, #2a2a3e);
    color: var(--color-text-secondary, #aaa);
    border-color: var(--color-border, #444);
  }

  .qs-btn-cancel:hover {
    background: var(--color-bg-active, #333);
  }

  .qs-btn-apply {
    background: var(--color-accent-blue, #3b82f6);
    color: #fff;
  }

  .qs-btn-apply:hover {
    opacity: 0.9;
  }
</style>
