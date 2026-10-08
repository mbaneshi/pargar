<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState, DrawingDocument } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let contextMenu = $state<{ visible: boolean; x: number; y: number; docId: string }>({
    visible: false,
    x: 0,
    y: 0,
    docId: '',
  });

  function handleTabClick(id: string) {
    if (id !== app.activeDocumentId) {
      app.switchDocument(id);
    }
  }

  function handleClose(e: MouseEvent, id: string) {
    e.stopPropagation();
    app.closeDocument(id);
  }

  function handleContextMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { visible: true, x: e.clientX, y: e.clientY, docId: id };
  }

  function closeContextMenu() {
    contextMenu = { ...contextMenu, visible: false };
  }

  function handleRename(id: string) {
    const doc = app.documents.find((d: DrawingDocument) => d.id === id);
    if (!doc) return;
    const name = prompt('Rename drawing:', doc.name);
    if (name && name.trim()) {
      app.renameDocument(id, name.trim());
    }
    closeContextMenu();
  }

  function handleCloseAllOthers(id: string) {
    const others = app.documents
      .filter((d: DrawingDocument) => d.id !== id)
      .map((d: DrawingDocument) => d.id);
    for (const otherId of others) {
      app.closeDocument(otherId);
    }
    closeContextMenu();
  }
</script>

<svelte:window
  onclick={() => {
    if (contextMenu.visible) closeContextMenu();
  }}
/>

<div class="drawing-tabs">
  {#each app.documents as doc (doc.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
      class="tab"
      class:active={doc.id === app.activeDocumentId}
      onclick={() => handleTabClick(doc.id)}
      oncontextmenu={(e) => handleContextMenu(e, doc.id)}
    >
      <span class="tab-name">{doc.name}</span>
      <button class="tab-close" onclick={(e) => handleClose(e, doc.id)} title="Close"
        >&times;</button
      >
    </div>
  {/each}
  <button class="tab-add" onclick={() => app.newDocument()} title="New drawing">+</button>
</div>

{#if contextMenu.visible}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="ctx-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      onclick={() => {
        app.closeDocument(contextMenu.docId);
        closeContextMenu();
      }}>Close</button
    >
    <button onclick={() => handleCloseAllOthers(contextMenu.docId)}>Close All Others</button>
    <button
      onclick={() => {
        app.handleSave();
        closeContextMenu();
      }}>Save</button
    >
    <button onclick={() => handleRename(contextMenu.docId)}>Rename</button>
  </div>
{/if}

<style>
  .drawing-tabs {
    display: flex;
    align-items: flex-end;
    height: 28px;
    padding: 0 4px;
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 1px;
  }

  .drawing-tabs::-webkit-scrollbar {
    height: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    background: var(--color-bg-secondary, #2d2d2d);
    border: 1px solid var(--color-border, #3c3c3c);
    border-bottom: none;
    border-radius: 3px 3px 0 0;
    cursor: pointer;
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-secondary, #999);
    white-space: nowrap;
    flex-shrink: 0;
    user-select: none;
  }

  .tab:hover {
    background: var(--color-bg-hover, #383838);
    color: var(--color-text-primary, #ccc);
  }

  .tab.active {
    background: var(--color-bg-tertiary, #1e1e1e);
    color: var(--color-text-primary, #ddd);
    border-bottom: 2px solid var(--color-accent, #4fc3f7);
    height: 26px;
  }

  .tab-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close {
    display: none;
    background: none;
    border: none;
    color: var(--color-text-secondary, #888);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
    border-radius: 2px;
  }

  .tab:hover .tab-close,
  .tab.active .tab-close {
    display: inline;
  }

  .tab-close:hover {
    background: var(--color-bg-active, #555);
    color: var(--color-text-primary, #fff);
  }

  .tab-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    background: none;
    border: 1px solid transparent;
    border-bottom: none;
    color: var(--color-text-secondary, #888);
    font-size: 16px;
    cursor: pointer;
    border-radius: 3px 3px 0 0;
    flex-shrink: 0;
    margin-left: 2px;
  }

  .tab-add:hover {
    background: var(--color-bg-hover, #383838);
    color: var(--color-text-primary, #ccc);
    border-color: var(--color-border, #3c3c3c);
  }

  .ctx-menu {
    position: fixed;
    z-index: 9999;
    background: var(--color-bg-secondary, #2d2d2d);
    border: 1px solid var(--color-border, #3c3c3c);
    border-radius: 4px;
    padding: 4px 0;
    min-width: 140px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .ctx-menu button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary, #ccc);
    padding: 5px 16px;
    text-align: left;
    font-size: var(--font-size-xs, 11px);
    cursor: pointer;
    font-family: inherit;
  }

  .ctx-menu button:hover {
    background: var(--color-bg-active, #094771);
  }
</style>
