<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let showShareMsg = $state(false);

  function handleShare() {
    showShareMsg = true;
    setTimeout(() => (showShareMsg = false), 3000);
  }

  function handleClose() {
    app.collabPanelOpen = false;
  }
</script>

{#if app.collabPanelOpen}
  <div class="collab-overlay">
    <div class="collab-panel">
      <div class="collab-header">
        <h2>Collaboration</h2>
        <button class="close-btn" onclick={handleClose} title="Close">&times;</button>
      </div>
      <div class="collab-body">
        <div class="share-section">
          <button class="share-btn" onclick={handleShare}>Share this drawing</button>
          {#if showShareMsg}
            <p class="coming-soon">Coming in v0.4</p>
          {/if}
        </div>

        <div class="collaborators-section">
          <h3>Active collaborators</h3>
          {#if app.collaborators.length === 0}
            <p class="solo-msg">You are working solo</p>
          {:else}
            <ul class="collab-list">
              {#each app.collaborators as collab (collab.name)}
                <li class="collab-item">
                  <span class="collab-avatar" style="background: {collab.color}"></span>
                  <span class="collab-name">{collab.name}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <p class="info-text">Collaboration requires a NEXUS account and cloud-saved drawing.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .collab-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    background: rgba(0, 0, 0, 0.4);
  }

  .collab-panel {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 400px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .collab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .collab-header h2 {
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

  .collab-body {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .share-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .share-btn {
    background: var(--color-accent);
    border: none;
    color: #fff;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-sm);
  }

  .share-btn:hover {
    background: var(--color-accent-hover);
  }

  .coming-soon {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-style: italic;
    margin: 0;
  }

  .collaborators-section h3 {
    margin: 0 0 var(--space-sm) 0;
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
  }

  .solo-msg {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin: 0;
  }

  .collab-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .collab-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .collab-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .collab-name {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .info-text {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
  }
</style>
