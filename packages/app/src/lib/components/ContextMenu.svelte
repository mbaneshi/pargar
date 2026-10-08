<script lang="ts">
  let {
    x,
    y,
    visible,
    lastCommand = '',
    canUndo = false,
    canRedo = false,
    hasSelection = false,
    canExplode = false,
    hasClipboard = false,
    recentCommands = [] as string[],
    onClose,
    onRepeatLast,
    onUndo,
    onRedo,
    onDelete,
    onSelectAll,
    onZoomExtents,
    onMove,
    onCopy,
    onRotate,
    onMirror,
    onScale,
    onExplode,
    onProperties,
    onCut,
    onClipboardCopy,
    onPaste,
    onRecentCommand,
  }: {
    x: number;
    y: number;
    visible: boolean;
    lastCommand?: string;
    canUndo?: boolean;
    canRedo?: boolean;
    hasSelection?: boolean;
    canExplode?: boolean;
    hasClipboard?: boolean;
    recentCommands?: string[];
    onClose: () => void;
    onRepeatLast: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDelete: () => void;
    onSelectAll: () => void;
    onZoomExtents: () => void;
    onMove: () => void;
    onCopy: () => void;
    onRotate: () => void;
    onMirror: () => void;
    onScale: () => void;
    onExplode: () => void;
    onProperties: () => void;
    onCut: () => void;
    onClipboardCopy: () => void;
    onPaste: () => void;
    onRecentCommand: (cmd: string) => void;
  } = $props();

  let showRecent = $state(false);

  let menuX = $derived.by(() => {
    const menuWidth = 220;
    return x + menuWidth > globalThis.innerWidth ? x - menuWidth : x;
  });

  let menuY = $derived.by(() => {
    const menuHeight = hasSelection ? 380 : 280;
    return y + menuHeight > globalThis.innerHeight ? y - menuHeight : y;
  });

  function act(fn: () => void) {
    fn();
    showRecent = false;
    onClose();
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (visible && e.key === 'Escape') {
      showRecent = false;
      onClose();
    }
  }}
/>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="backdrop"
    onclick={() => {
      showRecent = false;
      onClose();
    }}
  ></div>
  <div class="context-menu" style="left: {menuX}px; top: {menuY}px">
    <button onclick={() => act(onRepeatLast)} disabled={!lastCommand}>
      Repeat {lastCommand || 'Last Command'}
    </button>
    <div class="separator"></div>

    {#if hasSelection}
      <button onclick={() => act(onMove)}>Move <span class="shortcut">M</span></button>
      <button onclick={() => act(onCopy)}>Copy <span class="shortcut">CO</span></button>
      <button onclick={() => act(onRotate)}>Rotate <span class="shortcut">RO</span></button>
      <button onclick={() => act(onMirror)}>Mirror <span class="shortcut">MI</span></button>
      <button onclick={() => act(onScale)}>Scale <span class="shortcut">SC</span></button>
      <div class="separator"></div>
      {#if canExplode}
        <button onclick={() => act(onExplode)}>Explode <span class="shortcut">X</span></button>
        <div class="separator"></div>
      {/if}
      <button onclick={() => act(onCut)}>Cut <span class="shortcut">Ctrl+X</span></button>
      <button onclick={() => act(onClipboardCopy)}
        >Copy to Clipboard <span class="shortcut">Ctrl+C</span></button
      >
      <div class="separator"></div>
      <button onclick={() => act(onDelete)}>Delete <span class="shortcut">Del</span></button>
      <div class="separator"></div>
      <button onclick={() => act(onProperties)}>Properties</button>
    {:else}
      <button onclick={() => act(onUndo)} disabled={!canUndo}
        >Undo <span class="shortcut">Ctrl+Z</span></button
      >
      <button onclick={() => act(onRedo)} disabled={!canRedo}
        >Redo <span class="shortcut">Ctrl+Shift+Z</span></button
      >
      <div class="separator"></div>
      <button onclick={() => act(onPaste)} disabled={!hasClipboard}
        >Paste <span class="shortcut">Ctrl+V</span></button
      >
      <div class="separator"></div>
      <button onclick={() => act(onZoomExtents)}
        >Zoom Extents <span class="shortcut">F2</span></button
      >
      <button onclick={() => act(onSelectAll)}>Select All</button>
    {/if}

    {#if recentCommands.length > 0}
      <div class="separator"></div>
      <div class="submenu-parent">
        <button onmouseenter={() => (showRecent = true)} onmouseleave={() => (showRecent = false)}>
          Recent Input &#x25B6;
        </button>
        {#if showRecent}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="submenu"
            onmouseenter={() => (showRecent = true)}
            onmouseleave={() => (showRecent = false)}
          >
            {#each recentCommands as cmd, i (i)}
              <button onclick={() => act(() => onRecentCommand(cmd))}>{cmd}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-context-backdrop);
  }

  .context-menu {
    position: fixed;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) 0;
    min-width: 220px;
    z-index: var(--z-context-menu);
    box-shadow: var(--shadow-menu);
  }

  .context-menu button {
    display: flex;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-xl) var(--space-sm) var(--space-xl);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    cursor: pointer;
    text-align: left;
  }

  .context-menu button:hover:not(:disabled) {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }

  .context-menu button:disabled {
    color: var(--color-text-dim);
    cursor: default;
  }

  .separator {
    height: 1px;
    background: var(--color-border-input);
    margin: var(--space-sm) 0;
  }

  .shortcut {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin-left: var(--space-xl);
  }

  .submenu-parent {
    position: relative;
  }

  .submenu {
    position: absolute;
    left: 100%;
    top: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) 0;
    min-width: 160px;
    z-index: calc(var(--z-context-menu) + 1);
    box-shadow: var(--shadow-menu);
  }

  .submenu button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-xl) var(--space-sm) var(--space-xl);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    cursor: pointer;
    text-align: left;
  }

  .submenu button:hover {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }
</style>
