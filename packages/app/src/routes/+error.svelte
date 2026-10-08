<script lang="ts">
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import * as Sentry from '@sentry/svelte';

  const errorObj = $derived($page.error);

  $effect(() => {
    if (errorObj) {
      Sentry.captureException(errorObj);
    }
  });
</script>

<div class="error-page">
  <h1>{$page.status}</h1>
  <p>{errorObj?.message ?? 'Something went wrong'}</p>
  <a href={resolve('/')}>Back to NEXUS</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--color-text-primary, #ccc);
    background: var(--color-bg-primary, #1a1a2e);
    font-family: inherit;
    gap: 1rem;
  }

  h1 {
    font-size: 3rem;
    margin: 0;
  }

  a {
    color: var(--color-accent, #4fc3f7);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
