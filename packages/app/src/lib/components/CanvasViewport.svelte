<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { CadRenderer } from '@nexus/renderer';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { InteractionShell } from '$lib/shell/InteractionShell.svelte';
  import NavigationBar from './NavigationBar.svelte';
  import MTextEditor from './MTextEditor.svelte';

  const app = getContext<AppState>('app');
  const shell = getContext<InteractionShell>('shell');
  let container: HTMLElement;
  let screenX = $state(0);
  let screenY = $state(0);
  let cursorVisible = $state(false);

  const chX = $derived.by(() => {
    if (app.hasSnap && app.renderer) {
      return app.renderer.worldToScreen(app.snapX, app.snapY).x;
    }
    return screenX;
  });
  const chY = $derived.by(() => {
    if (app.hasSnap && app.renderer) {
      return app.renderer.worldToScreen(app.snapX, app.snapY).y;
    }
    return screenY;
  });

  const canvasCursor = $derived.by(() => {
    if (shell.mode === 'TOOL_ACTIVE' || shell.mode === 'TRANSPARENT') return 'crosshair';
    if (shell.mode === 'CONTEXT_MENU') return 'default';
    return 'default';
  });

  $effect(() => {
    if (app.renderer) {
      app.renderer.defaultCursor = canvasCursor;
      app.renderer.getCanvas().style.cursor = canvasCursor;
    }
  });

  const promptAtCursor = $derived.by(() => {
    if (!app.dynInputEnabled) return null;
    if (shell.mode !== 'TOOL_ACTIVE') return null;
    if (!shell.activeToolId || shell.activeToolId === 'select') return null;
    const text = app.statusText;
    if (!text || text === 'Ready' || text === 'Command:') return null;
    return text
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s*or\s*:/, ':')
      .trim();
  });

  const paperBounds = $derived.by(() => {
    if (app.activeSpace !== 'paper' || !app.renderer) return null;
    void screenX;
    void screenY;
    const layout = app.activeLayout;
    const topLeft = app.renderer.worldToScreen(0, layout.paperHeight);
    const bottomRight = app.renderer.worldToScreen(layout.paperWidth, 0);
    return { topLeft, bottomRight };
  });

  const dynDistance = $derived.by(() => {
    if (!app.dynInputEnabled) return null;
    const _status = app.statusText;
    // Try shell's active handler first
    const handler = shell.getActiveHandler();
    const lp = handler?.getLastPoint() ?? null;
    if (!lp) return null;
    const cx = app.hasSnap ? app.snapX : app.cursorX;
    const cy = app.hasSnap ? app.snapY : app.cursorY;
    const dx = cx - lp.x;
    const dy = cy - lp.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) return null;
    return { d, a: (Math.atan2(dy, dx) * 180) / Math.PI };
  });

  onMount(() => {
    const check = () => {
      if (!app.kernel) {
        requestAnimationFrame(check);
        return;
      }

      app.renderer = new CadRenderer(container);
      shell.updateDeps();

      app.renderer.onCursorMove = (wx: number, wy: number) => {
        const pt = app.cursorPoint;
        shell.handleInput({
          type: 'POINTER_MOVE',
          point: pt,
          worldX: wx,
          worldY: wy,
        });
      };

      app.renderer.onClick = (wx: number, wy: number, shiftKey: boolean) => {
        const pt = app.cursorPoint;
        shell.handleInput({
          type: 'POINTER_DOWN',
          point: pt,
          worldX: wx,
          worldY: wy,
          button: 'left',
          shiftKey,
          ctrlKey: false,
        });
      };

      app.renderer.onCursorScreen = (sx: number, sy: number) => {
        screenX = sx;
        screenY = sy;
      };

      app.renderer.onDragStart = (wx: number, wy: number) => {
        shell.handleInput({
          type: 'DRAG_START',
          point: { x: wx, y: wy },
          worldX: wx,
          worldY: wy,
        });
      };

      app.renderer.onDragMove = (wx: number, wy: number) => {
        shell.handleInput({
          type: 'DRAG_MOVE',
          point: { x: wx, y: wy },
          worldX: wx,
          worldY: wy,
        });
      };

      app.renderer.onDragEnd = (start: { x: number; y: number }, end: { x: number; y: number }) => {
        shell.handleInput({
          type: 'DRAG_END',
          start,
          end,
        });
      };
      app.renderer.zoomExtents();
    };
    check();

    return () => app.renderer?.dispose();
  });
</script>

<div
  class="canvas-container"
  role="application"
  bind:this={container}
  onmouseenter={() => (cursorVisible = true)}
  onmouseleave={() => (cursorVisible = false)}
>
  {#if cursorVisible}
    <div
      class="crosshair-h"
      data-testid="crosshair-h"
      style="top: {chY}px; width: {Math.max(0, chX - 5)}px; left: 0"
    ></div>
    <div class="crosshair-h" style="top: {chY}px; left: {chX + 5}px; right: 0"></div>
    <div
      class="crosshair-v"
      data-testid="crosshair-v"
      style="left: {chX}px; height: {Math.max(0, chY - 5)}px; top: 0"
    ></div>
    <div class="crosshair-v" style="left: {chX}px; top: {chY + 5}px; bottom: 0"></div>
    <div
      class="aperture"
      data-testid="aperture-box"
      style="left: {chX - 5}px; top: {chY - 5}px"
    ></div>
  {/if}

  {#if paperBounds}
    <div class="paper-overlay" data-testid="paper-overlay">
      <div
        class="paper-mask paper-mask-top"
        style="height: {Math.max(0, paperBounds.topLeft.y)}px"
      ></div>
      <div class="paper-mask paper-mask-bottom" style="top: {paperBounds.bottomRight.y}px"></div>
      <div
        class="paper-mask paper-mask-left"
        style="top: {paperBounds.topLeft.y}px; height: {paperBounds.bottomRight.y -
          paperBounds.topLeft.y}px; width: {Math.max(0, paperBounds.topLeft.x)}px"
      ></div>
      <div
        class="paper-mask paper-mask-right"
        style="top: {paperBounds.topLeft.y}px; height: {paperBounds.bottomRight.y -
          paperBounds.topLeft.y}px; left: {paperBounds.bottomRight.x}px"
      ></div>
      <div
        class="paper-boundary"
        data-testid="paper-boundary"
        style="left: {paperBounds.topLeft.x}px; top: {paperBounds.topLeft.y}px; width: {paperBounds
          .bottomRight.x - paperBounds.topLeft.x}px; height: {paperBounds.bottomRight.y -
          paperBounds.topLeft.y}px"
      ></div>
    </div>
  {/if}

  <NavigationBar />

  <svg class="ucs-icon" data-testid="ucs-icon" width="50" height="50" viewBox="0 0 50 50">
    <line x1="10" y1="40" x2="45" y2="40" stroke="#ff4444" stroke-width="2" />
    <polygon points="45,37 50,40 45,43" fill="#ff4444" />
    <text x="42" y="35" fill="#ff4444" font-size="10" font-family="sans-serif">X</text>
    <line x1="10" y1="40" x2="10" y2="5" stroke="#44ff44" stroke-width="2" />
    <polygon points="7,5 10,0 13,5" fill="#44ff44" />
    <text x="14" y="10" fill="#44ff44" font-size="10" font-family="sans-serif">Y</text>
  </svg>

  {#if promptAtCursor}
    <div
      class="dynamic-prompt"
      data-testid="dynamic-prompt"
      style="left: {chX + 20}px; top: {chY + 5}px"
    >
      {promptAtCursor}
    </div>
  {/if}

  {#if dynDistance && app.dynInputEnabled}
    <div
      class="dynamic-input"
      data-testid="dynamic-input"
      style="left: {chX + 20}px; top: {chY + (promptAtCursor ? 22 : 20)}px"
    >
      d: {dynDistance.d.toFixed(2)} &nbsp; &ang;: {dynDistance.a.toFixed(1)}&deg;
    </div>
  {/if}

  {#if app.mtextEditorState}
    <MTextEditor
      x={app.mtextEditorState.x}
      y={app.mtextEditorState.y}
      initialContent={app.mtextEditorState.content}
      onSave={app.mtextEditorState.onSave}
      onCancel={app.mtextEditorState.onCancel}
    />
  {/if}
</div>

<style>
  .canvas-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .crosshair-h {
    position: absolute;
    height: 1px;
    background: var(--color-crosshair);
    pointer-events: none;
    z-index: var(--z-crosshair);
  }

  .crosshair-v {
    position: absolute;
    width: 1px;
    background: var(--color-crosshair);
    pointer-events: none;
    z-index: var(--z-crosshair);
  }

  .aperture {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 1px solid var(--color-aperture);
    pointer-events: none;
    z-index: var(--z-aperture);
  }

  .ucs-icon {
    position: absolute;
    bottom: var(--space-xl);
    left: var(--space-xl);
    pointer-events: none;
    opacity: 0.7;
    z-index: var(--z-crosshair);
  }

  .dynamic-prompt {
    position: absolute;
    background: rgba(30, 30, 30, 0.85);
    padding: 2px var(--space-sm);
    font-size: 10px;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    pointer-events: none;
    z-index: var(--z-dynamic-input);
    white-space: nowrap;
    border-radius: var(--radius-sm);
  }

  .paper-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }

  .paper-mask {
    position: absolute;
    background: rgba(80, 80, 80, 0.6);
  }

  .paper-mask-top {
    top: 0;
    left: 0;
    right: 0;
  }
  .paper-mask-bottom {
    left: 0;
    right: 0;
    bottom: 0;
  }
  .paper-mask-left {
    left: 0;
  }
  .paper-mask-right {
    right: 0;
  }

  .paper-boundary {
    position: absolute;
    background: #ffffff;
    border: 1px solid var(--color-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .dynamic-input {
    position: absolute;
    background: rgba(30, 30, 30, 0.9);
    border: 1px solid var(--color-border-menu);
    padding: var(--space-xs) var(--space-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-label);
    font-family: var(--font-mono);
    pointer-events: none;
    z-index: var(--z-dynamic-input);
    white-space: nowrap;
    border-radius: var(--radius-sm);
  }
</style>
