<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let contextMenu = $state<{ visible: boolean; x: number; y: number; layoutId: string }>({
    visible: false,
    x: 0,
    y: 0,
    layoutId: '',
  });

  let editingId = $state<string | null>(null);
  let editingName = $state('');

  function handleTabClick(type: 'model' | 'layout', layoutId?: string) {
    if (type === 'model') {
      app.switchToModel();
    } else if (layoutId) {
      app.switchToLayout(layoutId);
    }
  }

  function handleContextMenu(e: MouseEvent, layoutId: string) {
    e.preventDefault();
    contextMenu = { visible: true, x: e.clientX, y: e.clientY, layoutId };
  }

  function closeContextMenu() {
    contextMenu = { ...contextMenu, visible: false };
  }

  function startRename(id: string) {
    const layout = app.layouts.find((l) => l.id === id);
    if (!layout) return;
    editingId = id;
    editingName = layout.name;
    closeContextMenu();
  }

  function commitRename() {
    if (editingId && editingName.trim()) {
      app.renameLayout(editingId, editingName.trim());
    }
    editingId = null;
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') {
      editingId = null;
    }
  }

  function handleDelete(id: string) {
    app.removeLayout(id);
    closeContextMenu();
  }

  function handleNewLayout() {
    app.addLayout();
    closeContextMenu();
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="layout-tabs" data-testid="layout-tabs">
  <button
    class="tab"
    class:active={app.activeSpace === 'model'}
    onclick={() => handleTabClick('model')}
    data-testid="tab-model"
  >
    Model
  </button>

  {#each app.layouts as layout (layout.id)}
    {#if editingId === layout.id}
      <input
        class="tab-rename-input"
        type="text"
        bind:value={editingName}
        onblur={commitRename}
        onkeydown={handleRenameKeydown}
        autofocus
      />
    {:else}
      <button
        class="tab"
        class:active={app.activeSpace === 'paper' && app.activeLayoutId === layout.id}
        onclick={() => handleTabClick('layout', layout.id)}
        oncontextmenu={(e) => handleContextMenu(e, layout.id)}
        data-testid="tab-{layout.id}"
      >
        {layout.name}
      </button>
    {/if}
  {/each}

  <button
    class="tab add-tab"
    onclick={handleNewLayout}
    title="Add new layout"
    data-testid="add-layout-btn"
  >
    +
  </button>
</div>

{#if contextMenu.visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ctx-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    onclick={(e: MouseEvent) => e.stopPropagation()}
  >
    <button onclick={() => startRename(contextMenu.layoutId)}>Rename</button>
    <button onclick={handleNewLayout}>New Layout</button>
    <button class="delete" onclick={() => handleDelete(contextMenu.layoutId)}> Delete </button>
  </div>
{/if}

<style>
  .layout-tabs {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    height: 28px;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .layout-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    background: var(--color-bg-secondary);
    border: none;
    border-right: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    padding: 0 var(--space-lg);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    min-width: 60px;
    transition:
      background 0.1s,
      color 0.1s;
  }

  .tab:hover {
    background: var(--color-bg-input);
    color: var(--color-text-primary);
  }

  .tab.active {
    background: var(--color-bg-primary);
    color: var(--color-text-accent);
    border-bottom: 2px solid var(--color-accent-blue);
    font-weight: 600;
  }

  .add-tab {
    min-width: 32px;
    padding: 0 var(--space-md);
    font-size: var(--font-size-md);
    font-weight: bold;
    color: var(--color-text-dim);
  }

  .add-tab:hover {
    color: var(--color-text-accent);
  }

  .tab-rename-input {
    background: var(--color-bg-input);
    border: 1px solid var(--color-accent-blue);
    color: var(--color-text-primary);
    font-size: var(--font-size-xs);
    font-family: inherit;
    padding: 0 var(--space-sm);
    width: 100px;
    outline: none;
  }

  .ctx-menu {
    position: fixed;
    background: var(--color-bg-menu);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-md);
    padding: var(--space-xs) 0;
    z-index: var(--z-ctx-menu);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    min-width: 140px;
  }

  .ctx-menu button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-family: inherit;
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    text-align: left;
  }

  .ctx-menu button:hover {
    background: var(--color-bg-input);
  }

  .ctx-menu button.delete {
    color: var(--color-error);
  }
</style>
