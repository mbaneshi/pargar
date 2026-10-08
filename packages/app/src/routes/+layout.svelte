<script>
  import '$lib/styles/tokens.css';
  let { children } = $props();
</script>

<svelte:head>
  <style>
    :global(body) {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: var(--color-bg-primary);
      color: var(--color-text-heading);
      font-family: var(--font-mono);
    }
  </style>
</svelte:head>

{@render children()}
