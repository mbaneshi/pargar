<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import { createLogger } from '@nexus/logger';
  const log = createLogger('app:project-browser');

  let { visible = $bindable(false) } = $props<{ visible: boolean }>();

  const app = getContext<AppState>('app');

  let projects = $state<{ name: string; lastModified: number; size: number }[]>([]);
  let loading = $state(true);

  async function refresh() {
    loading = true;
    try {
      const { listProjects } = await import('@nexus/file-io');
      projects = await listProjects();
    } catch (e) {
      log.error('Failed to list projects', { error: String(e) });
      projects = [];
    }
    loading = false;
  }

  onMount(() => {
    if (visible) refresh();
  });

  $effect(() => {
    if (visible) refresh();
  });

  async function openProject(name: string) {
    try {
      const { loadProject, deserializeProject } = await import('@nexus/file-io');
      const data = await loadProject(name);
      if (!data || !app.kernel) return;
      const project = deserializeProject(data);
      if (!project) {
        app.statusText = `Failed to parse project: ${name}`;
        return;
      }

      const wasmModule = await import('@nexus/kernel');
      app.setKernel(new wasmModule.Kernel());
      for (const ent of project.entities) {
        (app as any).importEntity(ent.geometry, ent.layer_id || 'default');
      }
      app.projectName = name;
      app.syncView();
      app.renderer?.zoomExtents();
      app.statusText = `Opened: ${name}`;
      visible = false;
    } catch (e) {
      app.statusText = `Open failed: ${e}`;
    }
  }

  async function deleteProject(name: string) {
    if (!confirm(`Delete project "${name}"?`)) return;
    try {
      const { deleteProject } = await import('@nexus/file-io');
      await deleteProject(name);
      await refresh();
      app.statusText = `Deleted: ${name}`;
    } catch (e) {
      app.statusText = `Delete failed: ${e}`;
    }
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={() => (visible = false)}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} data-testid="project-browser">
      <div class="header">
        <h2>Projects</h2>
        <button class="close" onclick={() => (visible = false)}>&times;</button>
      </div>

      {#if loading}
        <div class="empty">Loading...</div>
      {:else if projects.length === 0}
        <div class="empty">No saved projects</div>
      {:else}
        <div class="list">
          {#each projects as project (project.name)}
            <div class="row">
              <div class="info">
                <span class="name">{project.name}</span>
                <span class="meta"
                  >{formatDate(project.lastModified)} &middot; {formatSize(project.size)}</span
                >
              </div>
              <div class="actions">
                <button class="open" onclick={() => openProject(project.name)}>Open</button>
                <button class="delete" onclick={() => deleteProject(project.name)}>Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
    width: 500px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
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

  .list {
    overflow-y: auto;
    padding: var(--space-md) 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px var(--space-2xl);
    border-bottom: 1px solid var(--color-border-light);
  }
  .row:hover {
    background: var(--color-bg-secondary);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .name {
    color: var(--color-text-label);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .meta {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .actions {
    display: flex;
    gap: var(--space-sm);
  }

  .actions button {
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-input);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
  }

  .open {
    background: var(--color-bg-active);
    color: var(--color-text-label);
  }
  .open:hover {
    background: var(--color-bg-active);
  }

  .delete {
    background: var(--color-bg-input);
    color: var(--color-text-secondary);
  }
  .delete:hover {
    background: rgba(233, 69, 96, 0.15);
    color: var(--color-danger);
  }

  .empty {
    padding: 40px var(--space-2xl);
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }
</style>
