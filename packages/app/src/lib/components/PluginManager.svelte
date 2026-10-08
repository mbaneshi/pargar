<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import { pluginRegistry } from '$lib/plugins/pluginRegistry';

  const app = getContext<AppState>('app');

  let plugins = $derived(pluginRegistry.plugins);

  function handleToggle(id: string) {
    pluginRegistry.toggle(id);
  }

  function handleClose() {
    app.pluginManagerOpen = false;
  }
</script>

{#if app.pluginManagerOpen}
  <div class="plugin-overlay">
    <div class="plugin-panel">
      <div class="plugin-header">
        <h2>Add-in Manager</h2>
        <button class="close-btn" onclick={handleClose} title="Close">&times;</button>
      </div>
      <div class="plugin-body">
        {#if plugins.length === 0}
          <div class="empty-state">
            <p class="empty-title">No plugins installed</p>
            <p class="empty-desc">
              The NEXUS plugin API allows extensions to add custom commands, ribbon panels, and
              tools. Plugin support is coming in a future release.
            </p>
          </div>
        {:else}
          <ul class="plugin-list">
            {#each plugins as plugin (plugin.id)}
              <li class="plugin-item">
                <div class="plugin-info">
                  <span class="plugin-name">{plugin.name}</span>
                  <span class="plugin-version">v{plugin.version}</span>
                  <span class="plugin-author">by {plugin.author}</span>
                  <p class="plugin-desc">{plugin.description}</p>
                </div>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    checked={plugin.enabled}
                    onchange={() => handleToggle(plugin.id)}
                  />
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </label>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .plugin-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    background: rgba(0, 0, 0, 0.4);
  }

  .plugin-panel {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 480px;
    max-width: 90vw;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .plugin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .plugin-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--color-text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1.4rem;
    cursor: pointer;
    padding: var(--space-xs);
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .plugin-body {
    padding: var(--space-lg);
    overflow-y: auto;
    flex: 1;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-xl) var(--space-md);
  }

  .empty-title {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-sm);
  }

  .empty-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .plugin-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .plugin-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
  }

  .plugin-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .plugin-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .plugin-version {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .plugin-author {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .plugin-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
