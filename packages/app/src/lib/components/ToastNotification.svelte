<script lang="ts">
  import { toasts } from '$lib/stores/toastStore.svelte';
</script>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}" role="status">
        {toast.message}
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 40px;
    right: 16px;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast {
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-family: inherit;
    color: var(--color-text-primary, #e0e0e0);
    background: var(--color-bg-secondary, #2a2a2e);
    border-left: 3px solid var(--color-border-menu, #555);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    animation: toast-in 0.2s ease-out;
    pointer-events: auto;
    max-width: 320px;
  }

  .toast-success {
    border-left-color: #4caf50;
  }

  .toast-error {
    border-left-color: #f44336;
  }

  .toast-info {
    border-left-color: #2196f3;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
