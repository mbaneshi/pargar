<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { InteractionShell } from '$lib/shell/InteractionShell.svelte';
  import { WORKSPACES } from '$lib/protocol/workspaces';

  const app = getContext<AppState>('app');
  const shell = getContext<InteractionShell>('shell');

  const mouseHints = $derived(shell.mouseHints);
  const activeToolId = $derived(shell.activeToolId);
  const statusMessage = $derived(app.statusText);
</script>

<footer class="status-bar" data-testid="status-bar">
  <span class="mouse-hints">
    <span class="hint">LMB: {mouseHints.left}</span>
    <span class="hint-sep">|</span>
    <span class="hint">RMB: {mouseHints.right}</span>
  </span>
  {#if activeToolId && activeToolId !== 'select'}
    <span class="active-tool">Tool: {activeToolId.toUpperCase()}</span>
  {/if}

  <span class="status-text">{statusMessage}</span>

  <div class="toggles">
    <button
      class="space-toggle"
      class:active={true}
      onclick={() => {
        if (app.activeSpace === 'model' && app.layouts.length > 0) {
          app.switchToLayout(app.activeLayoutId);
        } else {
          app.switchToModel();
        }
      }}
      title="Toggle Model/Paper Space"
      data-testid="space-toggle">{app.activeSpace === 'model' ? 'MODEL' : 'PAPER'}</button
    >
    <button
      class:active={app.snapEnabled}
      onclick={() => {
        app.snapEnabled = !app.snapEnabled;
      }}
      title="Object Snap (F3)">OSNAP</button
    >
    <button
      class:active={app.gridSnapEnabled}
      onclick={() => {
        app.gridSnapEnabled = !app.gridSnapEnabled;
      }}
      title="Grid Snap (F9)">SNAP</button
    >
    <button
      class:active={app.orthoMode}
      onclick={() => {
        app.orthoMode = !app.orthoMode;
        if (app.orthoMode) app.polarEnabled = false;
      }}
      title="Ortho (F8)">ORTHO</button
    >
    <button
      class:active={app.polarEnabled}
      onclick={() => {
        app.polarEnabled = !app.polarEnabled;
        if (app.polarEnabled) app.orthoMode = false;
      }}
      title="Polar Tracking (F10)">POLAR</button
    >
    <button
      class:active={app.otrackEnabled}
      onclick={() => {
        app.otrackEnabled = !app.otrackEnabled;
        if (!app.otrackEnabled) app.acquiredSnapPoints = [];
      }}
      title="Object Snap Tracking (F11)">OTRACK</button
    >
    <button
      class:active={app.dynInputEnabled}
      onclick={() => (app.dynInputEnabled = !app.dynInputEnabled)}
      title="Dynamic Input (F12)">DYN</button
    >
    <button
      class:active={app.gridEnabled}
      onclick={() => (app.gridEnabled = !app.gridEnabled)}
      title="Grid (F7)">GRID</button
    >
  </div>

  {#if app.hasConstraints}
    <button
      class="dof-indicator"
      class:dof-ok={app.dofRemaining === 0 && !app.dofIsOver}
      class:dof-under={app.dofRemaining > 0}
      class:dof-over={app.dofIsOver}
      class:active={app.showDofColors}
      onclick={() => app.toggleDofColors()}
      title="Toggle DOF color overlay"
    >
      DOF: {app.dofRemaining}{app.dofRemaining === 0 && !app.dofIsOver
        ? ' \u2713'
        : ''}{app.dofIsOver ? ' !' : ''}
    </button>
  {/if}

  <div class="toggles ai-toggle">
    <button
      class:active={app.toolPaletteOpen}
      onclick={() => (app.toolPaletteOpen = !app.toolPaletteOpen)}
      title="Tool Palettes">PALETTES</button
    >
    <button
      class:active={app.agentPanelOpen}
      onclick={() => (app.agentPanelOpen = !app.agentPanelOpen)}
      title="Agent Panel">AI</button
    >
    <button
      class:active={app.chatPanelOpen}
      onclick={() => (app.chatPanelOpen = !app.chatPanelOpen)}
      title="Chat Panel">Chat</button
    >
  </div>

  {#if app.autoSaveStatus}
    <span class="autosave">{app.autoSaveStatus}</span>
  {/if}

  <div class="workspace-selector">
    <select bind:value={app.activeWorkspace} title="Workspace">
      {#each WORKSPACES as ws (ws.id)}
        <option value={ws.id}>{ws.name}</option>
      {/each}
    </select>
  </div>

  <div class="coordinates">
    {#if app.hasSnap && app.snapType !== 'grid'}
      <span class="snap-type">[{app.snapType}]</span>
    {/if}
    <span class="coord"
      >{app.formatLinear(app.hasSnap ? app.snapX : app.cursorX)}, {app.formatLinear(
        app.hasSnap ? app.snapY : app.cursorY,
      )}</span
    >
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 0 var(--space-md);
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border);
    height: var(--statusbar-height);
    font-size: 0.7rem;
    flex-shrink: 0;
  }

  .mouse-hints {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .hint-sep {
    color: var(--color-text-dim);
  }

  .active-tool {
    color: var(--color-text-accent);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .status-text {
    flex: 1;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toggles {
    display: flex;
    gap: var(--space-xs);
  }

  .toggles button {
    background: none;
    border: 1px solid transparent;
    color: var(--color-text-dim);
    font-size: var(--font-size-xs);
    padding: 1px 5px;
    cursor: pointer;
    font-family: inherit;
    border-radius: var(--radius-sm);
  }

  .toggles button.active {
    color: var(--color-text-accent);
    border-color: var(--color-text-accent);
  }

  .toggles button:hover {
    color: var(--color-text-secondary);
  }

  .coordinates {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 0 0 180px;
    justify-content: flex-end;
  }

  .snap-type {
    color: var(--color-warning);
    font-size: 0.65rem;
  }
  .coord {
    color: var(--color-text-accent);
    font-family: var(--font-mono);
  }
  .dof-indicator {
    background: none;
    border: 1px solid transparent;
    font-size: var(--font-size-xs);
    padding: 1px 5px;
    cursor: pointer;
    font-family: inherit;
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }
  .dof-indicator.dof-under {
    color: #4488ff;
  }
  .dof-indicator.dof-ok {
    color: #44cc44;
  }
  .dof-indicator.dof-over {
    color: #ff4444;
  }
  .dof-indicator.active {
    border-color: currentColor;
  }
  .dof-indicator:hover {
    opacity: 0.8;
  }
  .workspace-selector select {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: 1px var(--space-sm);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .workspace-selector select:hover {
    background: var(--color-bg-hover);
  }

  .autosave {
    color: var(--color-text-dim);
    font-size: 0.65rem;
  }

  @media (max-width: 768px) {
    .mouse-hints,
    .active-tool,
    .toggles,
    .ai-toggle,
    .dof-indicator,
    .workspace-selector {
      display: none;
    }
    .coordinates {
      flex: 0 0 120px;
    }
    .autosave {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .status-bar {
      gap: var(--space-sm);
      padding: 0 var(--space-sm);
      font-size: 0.6rem;
    }
    .coordinates {
      flex: 0 0 auto;
    }
    .status-text {
      min-width: 0;
    }
  }
</style>
