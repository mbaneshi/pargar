<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  let tick = $state(0);

  function zoomExtents() {
    app.renderer?.zoomExtents();
    tick++;
  }

  function zoomPrevious() {
    app.renderer?.zoomPrevious();
    tick++;
  }

  function zoomNext() {
    app.renderer?.zoomNext();
    tick++;
  }

  function zoomIn() {
    app.renderer?.zoomIn();
    tick++;
  }

  function zoomOut() {
    app.renderer?.zoomOut();
    tick++;
  }

  const canPrev = $derived.by(() => {
    void tick;
    return app.renderer?.canZoomPrevious ?? false;
  });

  const canNext = $derived.by(() => {
    void tick;
    return app.renderer?.canZoomNext ?? false;
  });
</script>

<div class="nav-bar">
  <button onclick={zoomExtents} title="Zoom Extents (Home)">ZE</button>
  <button onclick={zoomPrevious} disabled={!canPrev} title="Zoom Previous">&#x2190;</button>
  <button onclick={zoomNext} disabled={!canNext} title="Zoom Next">&#x2192;</button>
  <button onclick={zoomIn} title="Zoom In (+)">+</button>
  <button onclick={zoomOut} title="Zoom Out (-)">&#x2212;</button>
  <button disabled title="Zoom Window (coming soon)">ZW</button>
</div>

<style>
  .nav-bar {
    position: absolute;
    right: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    z-index: var(--z-crosshair);
  }

  .nav-bar button {
    background: rgba(37, 37, 37, 0.8);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    width: 28px;
    height: 28px;
    font-size: var(--font-size-md);
    cursor: pointer;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: var(--font-mono);
  }

  .nav-bar button:hover:not(:disabled) {
    background: rgba(60, 60, 60, 0.9);
    border-color: var(--color-text-muted);
    color: var(--color-text-bright);
  }

  .nav-bar button:active:not(:disabled) {
    background: rgba(80, 80, 80, 0.9);
  }

  .nav-bar button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
