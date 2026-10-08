<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  interface XrefEntry {
    name: string;
    status: string;
    type: string;
    path: string;
  }

  let xrefs = $state<XrefEntry[]>([]);
  let selectedIndex = $state<number | null>(null);
  let attachMessage = $state('');

  function handleAttach() {
    attachMessage = 'Xref attach will be available in v0.4';
    setTimeout(() => (attachMessage = ''), 3000);
  }

  function handleDetach() {
    if (selectedIndex === null || selectedIndex >= xrefs.length) return;
    xrefs = xrefs.filter((_, i) => i !== selectedIndex);
    selectedIndex = null;
  }
</script>

<aside class="xref-manager">
  <div class="header">
    <span class="title">External References</span>
    <button class="close-btn" onclick={() => (app.xrefManagerOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="actions">
    <button class="action-btn" onclick={handleAttach}>Attach</button>
    <button class="action-btn" onclick={handleDetach} disabled={selectedIndex === null}
      >Detach</button
    >
    <button class="action-btn" disabled>Reload</button>
  </div>

  {#if attachMessage}
    <div class="attach-message">{attachMessage}</div>
  {/if}

  <div class="xref-list">
    {#if xrefs.length === 0}
      <div class="empty-message">No external references</div>
    {:else}
      <div class="xref-header-row">
        <span class="col-name">Name</span>
        <span class="col-status">Status</span>
        <span class="col-type">Type</span>
        <span class="col-path">Path</span>
      </div>
      {#each xrefs as xref, i (i)}
        <button
          class="xref-row"
          class:selected={selectedIndex === i}
          onclick={() => (selectedIndex = i)}
        >
          <span class="col-name">{xref.name}</span>
          <span class="col-status">{xref.status}</span>
          <span class="col-type">{xref.type}</span>
          <span class="col-path">{xref.path}</span>
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .xref-manager {
    width: 420px;
    min-width: 300px;
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
  .action-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }
  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .attach-message {
    padding: var(--space-sm) var(--space-md);
    color: var(--color-accent);
    font-size: 0.7rem;
    border-bottom: 1px solid var(--color-border);
  }

  .xref-list {
    flex: 1;
    overflow-y: auto;
  }

  .empty-message {
    padding: var(--space-lg) var(--space-md);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }

  .xref-header-row {
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    font-size: 0.65rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .xref-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-bottom: 1px solid var(--color-border-light);
    background: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
    text-align: left;
  }
  .xref-row:hover {
    background: var(--color-border-light);
  }
  .xref-row.selected {
    background: var(--color-bg-active-row);
  }

  .col-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-status {
    width: 60px;
    flex-shrink: 0;
  }
  .col-type {
    width: 60px;
    flex-shrink: 0;
  }
  .col-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
  }
</style>
