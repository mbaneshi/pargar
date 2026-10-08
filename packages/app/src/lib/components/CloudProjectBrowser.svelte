<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { ProjectMetadata } from '$lib/cloud/storage';

  let { visible = $bindable(false) } = $props<{ visible: boolean }>();

  const app = getContext<AppState>('app');

  let projects = $state<ProjectMetadata[]>([]);
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    if (visible) refresh();
  });

  async function refresh() {
    if (!app.authService?.uid || !app.cloudStorage) return;
    loading = true;
    error = '';
    try {
      projects = await app.cloudStorage.listProjects(app.authService.uid);
    } catch (e: any) {
      const msg = e.message || 'Failed to load projects';
      if (msg.includes('requires an index') || msg.includes('index')) {
        error =
          'Cloud database is being set up. This takes a few minutes after first deploy. Please try again shortly.';
      } else {
        error = msg;
      }
      projects = [];
    }
    loading = false;
  }

  async function openProject(project: ProjectMetadata) {
    if (!app.authService?.uid || !app.cloudStorage) {
      app.statusText = 'Sign in to open cloud projects';
      return;
    }
    if (!app.kernel) {
      app.statusText = 'Kernel not loaded';
      return;
    }
    try {
      const json = await app.cloudStorage.loadProject(app.authService.uid, project.id);
      await app.openFromCloud(json, project.id, project.name);
      visible = false;
    } catch (e: any) {
      app.statusText = `Open failed: ${e.message}`;
    }
  }

  async function deleteProject(project: ProjectMetadata) {
    if (!app.authService?.uid || !app.cloudStorage) {
      app.statusText = 'Sign in to delete projects';
      return;
    }
    if (!confirm(`Delete "${project.name}" from cloud?`)) return;
    try {
      await app.cloudStorage.deleteProject(app.authService.uid, project.id);
      await refresh();
      app.statusText = `Deleted from cloud: ${project.name}`;
    } catch (e: any) {
      app.statusText = `Delete failed: ${e.message}`;
    }
  }

  async function exportDxf(project: ProjectMetadata) {
    if (!app.authService?.uid || !app.cloudStorage) {
      app.statusText = 'Sign in to export';
      return;
    }
    if (!app.kernel) {
      app.statusText = 'Kernel not loaded';
      return;
    }
    try {
      const json = await app.cloudStorage.loadProject(app.authService.uid, project.id);
      await app.openFromCloud(json, project.id, project.name);
      app.handleExportDxf();
      visible = false;
    } catch (e: any) {
      app.statusText = `Export failed: ${e.message}`;
    }
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <h2>Cloud Projects</h2>
        <button class="close" onclick={() => (visible = false)}>&times;</button>
      </div>

      {#if loading}
        <div class="empty">Loading...</div>
      {:else if error}
        <div class="empty error-text">
          {error}
          <button class="retry-btn" onclick={refresh}>Retry</button>
        </div>
      {:else if projects.length === 0}
        <div class="empty">No cloud projects yet</div>
      {:else}
        <div class="list">
          {#each projects as project (project.id)}
            <div class="row">
              <div class="info">
                <span class="name">{project.name}</span>
                <span class="meta">
                  {formatDate(project.updatedAt)}
                  &middot; {project.entityCount} entities &middot; {project.layerCount} layers
                </span>
              </div>
              <div class="actions">
                <button class="open" onclick={() => openProject(project)}>Open</button>
                <button class="export" onclick={() => exportDxf(project)}>DXF</button>
                <button class="delete" onclick={() => deleteProject(project)}>Delete</button>
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
    width: 540px;
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
    min-width: 0;
  }

  .name {
    color: var(--color-text-label);
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
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

  .export {
    background: var(--color-bg-input);
    color: var(--color-text-secondary);
  }
  .export:hover {
    background: var(--color-bg-hover);
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

  .error-text {
    color: var(--color-danger);
  }

  .retry-btn {
    display: block;
    margin: var(--space-xl) auto 0;
    padding: var(--space-sm) var(--space-2xl);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-input);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
  }
  .retry-btn:hover {
    background: var(--color-bg-hover);
  }

  @media (max-width: 480px) {
    .modal {
      width: calc(100% - var(--space-xl));
      margin: var(--space-md);
      max-height: 80vh;
    }
    .row {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-xl);
    }
    .actions {
      width: 100%;
    }
    .actions button {
      flex: 1;
    }
  }
</style>
