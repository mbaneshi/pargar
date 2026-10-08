<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');
</script>

<div class="qat">
  <button class="qat-btn" onclick={() => app.handleNew()} title="New drawing (Ctrl+N)">New</button>
  <button class="qat-btn" onclick={() => app.handleOpen()} title="Open file (Ctrl+O)">Open</button>
  <button class="qat-btn" onclick={() => app.handleSave()} title="Save (Ctrl+S)">Save</button>
  <span class="qat-sep"></span>
  <button class="qat-btn" onclick={() => app.undo()} disabled={!app.canUndo} title="Undo (Ctrl+Z)"
    >Undo</button
  >
  <button class="qat-btn" onclick={() => app.redo()} disabled={!app.canRedo} title="Redo (Ctrl+Y)"
    >Redo</button
  >
  <span class="qat-sep"></span>
  <button class="qat-btn" onclick={() => app.handleExportDxf()} title="Export DXF">DXF</button>
</div>

<style>
  .qat {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    padding: 0 var(--space-md);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .qat-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-xs);
    line-height: 1;
    white-space: nowrap;
  }

  .qat-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .qat-btn:active {
    background: var(--color-bg-active);
  }

  .qat-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .qat-btn:disabled:hover {
    background: transparent;
    color: var(--color-text-secondary);
  }

  .qat-sep {
    width: 1px;
    height: 14px;
    background: var(--color-border);
    margin: 0 2px;
    flex-shrink: 0;
  }
</style>
