<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let filterText = $state('');

  let blocksExpanded = $state(true);
  let layersExpanded = $state(true);
  let textStylesExpanded = $state(true);

  interface BlockDef {
    name: string;
    entity_count?: number;
  }

  interface LayerInfo {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
    linetype: string | null;
    lineweight: number | null;
  }

  interface TextStyle {
    name: string;
    font_family: string;
    height: number;
    width_factor: number;
    oblique_angle: number;
    is_bold: boolean;
    is_italic: boolean;
  }

  let version = $state(0);

  function refresh() {
    version++;
  }

  let blocks = $derived.by(() => {
    void version;
    if (!app.kernel) return [];
    try {
      const defs: BlockDef[] = JSON.parse(app.kernel.get_block_defs_json());
      return defs;
    } catch {
      return [];
    }
  });

  let layers: LayerInfo[] = $derived.by(() => {
    void version;
    return app.getLayers();
  });

  let textStyles = $derived.by(() => {
    void version;
    if (!app.kernel) return [];
    try {
      return JSON.parse(app.kernel.get_text_styles_json()) as TextStyle[];
    } catch {
      return [];
    }
  });

  let filter = $derived(filterText.toLowerCase().trim());

  let filteredBlocks = $derived(
    filter ? blocks.filter((b) => b.name.toLowerCase().includes(filter)) : blocks,
  );

  let filteredLayers = $derived(
    filter ? layers.filter((l) => l.name.toLowerCase().includes(filter)) : layers,
  );

  let filteredTextStyles = $derived(
    filter ? textStyles.filter((s) => s.name.toLowerCase().includes(filter)) : textStyles,
  );

  function handleInsertBlock(name: string) {
    app.statusText = `Insert block: ${name} (place at cursor)`;
  }

  function handleSetActiveLayer(id: string) {
    app.activeLayerId = id;
    refresh();
    app.statusText = `Active layer: ${layers.find((l) => l.id === id)?.name ?? id}`;
  }

  function handleSetCurrentTextStyle(name: string) {
    app.executeCommand({ type: 'SetCurrentTextStyle', name });
    refresh();
    app.statusText = `Current text style: ${name}`;
  }
</script>

<aside class="design-center">
  <div class="header">
    <span class="title">Design Center</span>
    <button class="close-btn" onclick={() => (app.designCenterOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="search-bar">
    <svg
      class="search-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input class="search-input" type="text" placeholder="Filter..." bind:value={filterText} />
  </div>

  <div class="tree-content">
    <!-- Blocks section -->
    <div class="tree-section">
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="section-header" onclick={() => (blocksExpanded = !blocksExpanded)}>
        <span class="expand-arrow" class:expanded={blocksExpanded}>&#9654;</span>
        <span class="section-title">Blocks</span>
        <span class="section-count">{filteredBlocks.length}</span>
      </div>
      {#if blocksExpanded}
        <div class="section-items">
          {#if filteredBlocks.length === 0}
            <div class="empty-msg">No block definitions</div>
          {:else}
            {#each filteredBlocks as block (block.name)}
              <button
                class="tree-item"
                onclick={() => handleInsertBlock(block.name)}
                title="Click to insert block '{block.name}'"
              >
                <svg
                  class="item-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
                <span class="item-name">{block.name}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <!-- Layers section -->
    <div class="tree-section">
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="section-header" onclick={() => (layersExpanded = !layersExpanded)}>
        <span class="expand-arrow" class:expanded={layersExpanded}>&#9654;</span>
        <span class="section-title">Layers</span>
        <span class="section-count">{filteredLayers.length}</span>
      </div>
      {#if layersExpanded}
        <div class="section-items">
          {#each filteredLayers as layer (layer.id)}
            <button
              class="tree-item"
              class:active-item={app.activeLayerId === layer.id}
              onclick={() => handleSetActiveLayer(layer.id)}
              title="Click to set '{layer.name}' as active layer"
            >
              <span class="layer-swatch" style="background: {layer.color}"></span>
              <span class="item-name">{layer.name}</span>
              {#if app.activeLayerId === layer.id}
                <span class="active-badge">active</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Text Styles section -->
    <div class="tree-section">
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="section-header" onclick={() => (textStylesExpanded = !textStylesExpanded)}>
        <span class="expand-arrow" class:expanded={textStylesExpanded}>&#9654;</span>
        <span class="section-title">Text Styles</span>
        <span class="section-count">{filteredTextStyles.length}</span>
      </div>
      {#if textStylesExpanded}
        <div class="section-items">
          {#if filteredTextStyles.length === 0}
            <div class="empty-msg">No text styles</div>
          {:else}
            {#each filteredTextStyles as style (style.name)}
              <button
                class="tree-item"
                onclick={() => handleSetCurrentTextStyle(style.name)}
                title="Click to set '{style.name}' as current text style"
              >
                <svg
                  class="item-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                <span class="item-name">{style.name}</span>
                <span class="item-detail">{style.font_family} h={style.height}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</aside>

<style>
  .design-center {
    width: 280px;
    min-width: 240px;
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

  .search-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }

  .search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 0.72rem;
    outline: none;
  }
  .search-input:focus {
    border-color: var(--color-accent);
  }
  .search-input::placeholder {
    color: var(--color-text-muted);
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
  }

  .tree-section {
    border-bottom: 1px solid var(--color-border-light);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    cursor: pointer;
    user-select: none;
  }
  .section-header:hover {
    background: var(--color-bg-hover);
  }

  .expand-arrow {
    font-size: 0.55rem;
    color: var(--color-text-muted);
    transition: transform 150ms ease;
    display: inline-block;
    width: 12px;
    text-align: center;
  }
  .expand-arrow.expanded {
    transform: rotate(90deg);
  }

  .section-title {
    font-weight: 600;
    font-size: 0.72rem;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .section-count {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 0.65rem;
  }

  .section-items {
    padding: var(--space-xs) 0;
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-md) + 12px);
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    text-align: left;
  }
  .tree-item:hover {
    background: var(--color-border-light);
  }
  .tree-item.active-item {
    background: var(--color-bg-active-row);
  }

  .item-icon {
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-detail {
    color: var(--color-text-muted);
    font-size: 0.65rem;
    flex-shrink: 0;
  }

  .layer-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .active-badge {
    font-size: 0.6rem;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .empty-msg {
    padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-md) + 12px);
    color: var(--color-text-muted);
    font-style: italic;
    font-size: 0.7rem;
  }
</style>
