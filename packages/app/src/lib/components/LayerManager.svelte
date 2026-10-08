<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let layerVersion = $state(0);
  let editingNameId = $state<string | null>(null);
  let editingNameValue = $state('');

  function refreshLayers() {
    layerVersion++;
  }

  let layers = $derived.by(() => {
    void layerVersion;
    return app.getLayers();
  });

  function randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  }

  function hslToHex(hsl: string): string {
    const el = document.createElement('div');
    el.style.color = hsl;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const match = computed.match(/(\d+)/g);
    if (!match) return '#ffffff';
    const [r, g, b] = match.map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function handleCreateLayer() {
    const count = layers.length;
    const color = hslToHex(randomColor());
    app.executeCommand({ type: 'CreateLayer', name: `Layer ${count}`, color });
    refreshLayers();
  }

  function handleDeleteLayer(id: string) {
    if (id === 'layer_0') return;
    app.executeCommand({ type: 'DeleteLayer', id });
    if (app.activeLayerId === id) {
      app.activeLayerId = 'layer_0';
    }
    refreshLayers();
  }

  function handleToggleVisible(id: string, current: boolean) {
    app.executeCommand({ type: 'SetLayerVisible', id, visible: !current });
    refreshLayers();
  }

  function handleToggleLocked(id: string, current: boolean) {
    app.executeCommand({ type: 'SetLayerLocked', id, locked: !current });
    refreshLayers();
  }

  function handleColorChange(id: string, color: string) {
    app.executeCommand({ type: 'SetLayerColor', id, color });
    refreshLayers();
  }

  function handleStartRename(id: string, currentName: string) {
    editingNameId = id;
    editingNameValue = currentName;
  }

  function handleFinishRename(id: string) {
    if (editingNameValue.trim()) {
      app.executeCommand({ type: 'RenameLayer', id, name: editingNameValue.trim() });
    }
    editingNameId = null;
    refreshLayers();
  }

  function handleSetActive(id: string) {
    app.activeLayerId = id;
  }
</script>

<aside class="layer-manager">
  <div class="header">
    <span class="title">Layer Properties</span>
    <button class="close-btn" onclick={() => (app.layerManagerOpen = false)} title="Close (Ctrl+L)"
      >&times;</button
    >
  </div>

  <div class="actions">
    <button class="action-btn" onclick={handleCreateLayer} title="New Layer">+ New</button>
  </div>

  <div class="layer-list">
    <div class="layer-header-row">
      <span class="col-active"></span>
      <span class="col-color">Color</span>
      <span class="col-name">Name</span>
      <span class="col-vis">Vis</span>
      <span class="col-lock">Lock</span>
      <span class="col-lt">LType</span>
      <span class="col-lw">LW</span>
      <span class="col-del"></span>
    </div>

    {#each layers as layer (layer.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="layer-row"
        class:active-layer={app.activeLayerId === layer.id}
        ondblclick={() => handleSetActive(layer.id)}
      >
        <span class="col-active">
          {#if app.activeLayerId === layer.id}
            <span class="active-indicator" title="Current layer">&#9654;</span>
          {/if}
        </span>

        <span class="col-color">
          <label class="color-swatch-label">
            <span class="color-swatch" style="background: {layer.color}"></span>
            <input
              type="color"
              class="color-input"
              value={layer.color}
              onchange={(e) => handleColorChange(layer.id, e.currentTarget.value)}
            />
          </label>
        </span>

        <span class="col-name">
          {#if editingNameId === layer.id}
            <input
              class="name-input"
              bind:value={editingNameValue}
              onblur={() => handleFinishRename(layer.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter') handleFinishRename(layer.id);
                if (e.key === 'Escape') editingNameId = null;
              }}
            />
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="name-text"
              ondblclick={(e) => {
                e.stopPropagation();
                handleStartRename(layer.id, layer.name);
              }}
              title="Double-click to rename">{layer.name}</span
            >
          {/if}
        </span>

        <span class="col-vis">
          <button
            class="icon-btn"
            class:off={!layer.visible}
            onclick={() => handleToggleVisible(layer.id, layer.visible)}
            title={layer.visible ? 'Hide layer' : 'Show layer'}
          >
            {#if layer.visible}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
                  cx="12"
                  cy="12"
                  r="3"
                /></svg
              >
            {:else}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
                /><path
                  d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
                /><line x1="1" y1="1" x2="23" y2="23" /></svg
              >
            {/if}
          </button>
        </span>

        <span class="col-lock">
          <button
            class="icon-btn"
            class:on={layer.locked}
            onclick={() => handleToggleLocked(layer.id, layer.locked)}
            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          >
            {#if layer.locked}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path
                  d="M7 11V7a5 5 0 0 1 10 0v4"
                /></svg
              >
            {:else}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path
                  d="M7 11V7a5 5 0 0 1 9.9-1"
                /></svg
              >
            {/if}
          </button>
        </span>

        <span class="col-lt">{layer.linetype || 'Continuous'}</span>
        <span class="col-lw"
          >{layer.lineweight != null ? layer.lineweight.toFixed(2) : 'Default'}</span
        >

        <span class="col-del">
          {#if layer.id !== 'layer_0'}
            <button
              class="icon-btn del-btn"
              onclick={() => handleDeleteLayer(layer.id)}
              title="Delete layer">&times;</button
            >
          {/if}
        </span>
      </div>
    {/each}
  </div>
</aside>

<style>
  .layer-manager {
    width: var(--layer-panel-width);
    min-width: 260px;
    background: var(--color-bg-secondary);
    border-left: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
  }

  .title {
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.5px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0 var(--space-sm);
    line-height: 1;
  }
  .close-btn:hover {
    color: var(--color-accent);
  }

  .actions {
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    gap: var(--space-sm);
  }

  .action-btn {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.72rem;
  }
  .action-btn:hover {
    background: var(--color-bg-hover);
  }

  .layer-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
  }

  /* Narrow screens (#6): never wider than the overlay/viewport; the column
     grid keeps its natural width and scrolls inside the list instead. */
  @media (max-width: 1024px) {
    .layer-manager {
      width: 100%;
      max-width: 100vw;
      min-width: 0;
      box-sizing: border-box;
    }
    .layer-header-row,
    .layer-row {
      min-width: 260px;
    }
  }

  .layer-header-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    font-size: 0.65rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .layer-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
    cursor: default;
  }
  .layer-row:hover {
    background: var(--color-border-light);
  }
  .layer-row.active-layer {
    background: var(--color-bg-active-row);
  }

  .col-active {
    width: 16px;
    flex-shrink: 0;
    text-align: center;
  }
  .col-color {
    width: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .col-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-vis {
    width: 28px;
    flex-shrink: 0;
    text-align: center;
  }
  .col-lock {
    width: 28px;
    flex-shrink: 0;
    text-align: center;
  }
  .col-lt {
    width: 58px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: 0.65rem;
  }
  .col-lw {
    width: 42px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: 0.65rem;
  }
  .col-del {
    width: 20px;
    flex-shrink: 0;
    text-align: center;
  }

  .active-indicator {
    color: var(--color-accent);
    font-size: 0.6rem;
  }

  .color-swatch-label {
    position: relative;
    cursor: pointer;
    display: inline-block;
  }

  .color-swatch {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-sm);
  }

  .color-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 16px;
    height: 16px;
    opacity: 0;
    cursor: pointer;
  }

  .icon-btn {
    background: none;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    padding: 0;
    font-size: 0.85rem;
    line-height: 1;
  }
  .icon-btn:hover {
    color: var(--color-text-bright);
  }
  .icon-btn.off {
    color: var(--color-text-dim);
  }
  .icon-btn.on {
    color: var(--color-accent);
  }

  .del-btn {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .del-btn:hover {
    color: var(--color-accent);
  }

  .name-input {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-menu);
    color: var(--color-text-primary);
    padding: 1px var(--space-sm);
    font-size: 0.72rem;
    font-family: inherit;
    width: 100%;
    outline: none;
  }
  .name-input:focus {
    border-color: var(--color-accent);
  }

  .name-text {
    cursor: default;
  }
</style>
