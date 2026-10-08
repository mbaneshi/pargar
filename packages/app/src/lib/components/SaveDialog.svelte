<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  let { visible = $bindable(false) } = $props<{ visible: boolean }>();

  const app = getContext<AppState>('app');

  let name = $state('');
  let saveToCloud = $state(true);
  let saving = $state(false);
  let error = $state('');

  $effect(() => {
    if (visible) {
      name = app.projectName;
      saveToCloud = app.authService?.isAuthenticated ?? false;
      error = '';
    }
  });

  async function handleSave() {
    if (!name.trim()) return;
    saving = true;
    error = '';
    try {
      app.projectName = name.trim();
      if (saveToCloud && app.authService?.isAuthenticated) {
        await app.saveToCloud();
      }
      await app.handleSave();
      visible = false;
      app.statusText = saveToCloud ? `Saved to cloud: ${name}` : `Saved locally: ${name}`;
    } catch (e: any) {
      error = e.message || 'Save failed';
    }
    saving = false;
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
        <h2>Save Project</h2>
        <button class="close" onclick={() => (visible = false)}>&times;</button>
      </div>

      <div class="body">
        <label class="field">
          <span>Project Name</span>
          <input type="text" bind:value={name} placeholder="My Project" disabled={saving} />
        </label>

        {#if app.authService?.isAuthenticated}
          <div class="toggle-row">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={saveToCloud} disabled={saving} />
              <span>Save to Cloud</span>
            </label>
            <span class="hint">{saveToCloud ? 'Cloud + local backup' : 'Local only (OPFS)'}</span>
          </div>
        {:else}
          <div class="hint-row">Saving locally (sign in to enable cloud save)</div>
        {/if}

        {#if error}
          <div class="error">{error}</div>
        {/if}
      </div>

      <div class="footer">
        <button class="cancel" onclick={() => (visible = false)} disabled={saving}>Cancel</button>
        <button class="save" onclick={handleSave} disabled={saving || !name.trim()}>
          {#if saving}
            Saving...
          {:else}
            Save
          {/if}
        </button>
      </div>
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
    width: 400px;
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

  .body {
    padding: var(--space-xl) var(--space-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .field span {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }
  .field input {
    padding: 8px var(--space-lg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-input);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }
  .field input:focus {
    border-color: var(--color-accent);
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: 0.85rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .toggle-label input[type='checkbox'] {
    accent-color: var(--color-accent);
  }

  .hint {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .hint-row {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .error {
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    background: rgba(233, 69, 96, 0.15);
    color: var(--color-danger);
    font-size: 0.78rem;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    padding: var(--space-lg) var(--space-2xl) var(--space-xl);
    border-top: 1px solid var(--color-bg-input);
  }

  .footer button {
    padding: 8px 20px;
    border-radius: var(--radius-xl);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .cancel {
    background: var(--color-bg-input);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-input) !important;
  }
  .cancel:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .save {
    background: var(--color-accent);
    color: var(--color-text-bright);
  }
  .save:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
