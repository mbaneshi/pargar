<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { AppState } from '$lib/stores/AppState.svelte';
  import Ribbon from '$lib/components/Ribbon.svelte';
  import Workspace from '$lib/components/Workspace.svelte';
  import CommandLine from '$lib/components/CommandLine.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import QuickAccessToolbar from '$lib/components/QuickAccessToolbar.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import OsnapOverrideMenu from '$lib/components/OsnapOverrideMenu.svelte';

  import ProjectBrowser from '$lib/components/ProjectBrowser.svelte';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
  import UnitsDialog from '$lib/components/UnitsDialog.svelte';
  import QuickSelectDialog from '$lib/components/QuickSelectDialog.svelte';
  import LoginPage from '$lib/components/LoginPage.svelte';
  import SaveDialog from '$lib/components/SaveDialog.svelte';
  import LayoutTabs from '$lib/components/LayoutTabs.svelte';
  import ActionRecorder from '$lib/components/ActionRecorder.svelte';
  import CloudProjectBrowser from '$lib/components/CloudProjectBrowser.svelte';
  import { commandRegistry } from '$lib/commands/CommandRegistry';
  import { registerBuiltinCommands } from '$lib/commands/registerBuiltinCommands';
  import { InteractionShell } from '$lib/shell/InteractionShell.svelte';
  import type { InputEvent } from '$lib/shell/InputEvent';
  import { createLogger } from '@nexus/logger';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import DrawingTabs from '$lib/components/DrawingTabs.svelte';
  import ToastNotification from '$lib/components/ToastNotification.svelte';
  import HelpOverlay from '$lib/HelpOverlay.svelte';
  import { BridgeClient } from '$lib/mcp/BridgeClient';
  import { cloudConfigured } from '$lib/cloud/supabase';

  const log = createLogger('app:init');

  const app = new AppState();
  setContext('app', app);
  registerBuiltinCommands(app);

  const shell = new InteractionShell({ commandRegistry, app });
  app.setSelection(shell.selection);
  setContext('shell', shell);

  const STORAGE_KEY_FIRST_RUN = 'nexus.first-run-shown.v1';
  const STORAGE_KEY_GUEST = 'nexus.guest-mode.v1';

  const isFirstRun =
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_FIRST_RUN) !== 'true';
  const wasGuest =
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_GUEST) === 'true';

  let lastCommand = $state('');
  let ctxMenu = $state({ visible: false, x: 0, y: 0 });
  let osnapMenu = $state({ visible: false, x: 0, y: 0 });
  let browserVisible = $state(false);
  let cloudBrowserVisible = $state(false);
  let saveDialogVisible = $state(false);
  let welcomeVisible = $state(isFirstRun);
  let showLogin = $state(!wasGuest && !isFirstRun && cloudConfigured);
  let helpVisible = $state(false);
  let cmdLine: CommandLine;

  // Phone notice (#6): the UI is desktop-first; tell narrow-screen users once.
  const STORAGE_KEY_MOBILE_NOTICE = 'nexus.mobile-notice-dismissed.v1';
  let mobileNoticeDismissed = $state(readMobileNoticeDismissed());

  function readMobileNoticeDismissed(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY_MOBILE_NOTICE) === 'true';
    } catch {
      return false;
    }
  }

  function dismissMobileNotice() {
    mobileNoticeDismissed = true;
    try {
      localStorage.setItem(STORAGE_KEY_MOBILE_NOTICE, 'true');
    } catch {
      // localStorage unavailable
    }
  }

  if (!cloudConfigured) {
    app.guestMode = true;
  }

  // Init cloud services
  app.initCloud();

  // Once auth resolves, decide login visibility
  $effect(() => {
    if (app.authService && !app.authService.loading) {
      if (app.authService.isAuthenticated || app.guestMode) {
        showLogin = false;
        if (app.authService.isAuthenticated) {
          app.startCloudAutoSave();
        }
      }
    }
  });

  const commandAliases = $derived(
    Array.from(
      new Set([
        ...commandRegistry.getAllAliases(),
        ...shell.availableCommands,
        'undo',
        'redo',
        'u',
        'ze',
        'zoom extents',
        'del',
        'delete',
        'erase',
        'ortho',
      ]),
    ),
  );

  const layerNames = $derived(app.getLayers().map((l) => l.name));

  const blockNames = $derived.by(() => {
    if (!app.kernel) return [];
    try {
      const defs: Array<{ name: string }> = JSON.parse(app.kernel.get_block_defs_json());
      return defs.map((d) => d.name);
    } catch {
      return [];
    }
  });

  function handleLayerSelect(layerId: string) {
    const layers = app.getLayers();
    const layer = layers.find((l) => l.name === layerId || l.id === layerId);
    if (layer) {
      app.activeLayerId = layer.id;
      app.statusText = `Active layer: ${layer.name}`;
    }
  }

  function handleBlockSelect(blockName: string) {
    // Start INSERT command with the block name
    shell.handleInput({ type: 'COMMAND_TEXT', text: `insert ${blockName}` });
  }

  function chooseGuest() {
    app.enterGuestMode();
    showLogin = false;
    try {
      localStorage.setItem(STORAGE_KEY_GUEST, 'true');
    } catch {
      // localStorage unavailable
    }
  }

  // Persist welcome dismissal when WelcomeScreen closes
  $effect(() => {
    if (!welcomeVisible) {
      try {
        localStorage.setItem(STORAGE_KEY_FIRST_RUN, 'true');
      } catch {
        // localStorage unavailable
      }
    }
  });

  $effect(() => {
    document.title = `${app.projectName} - NEXUS CAD`;
  });

  $effect(() => {
    const active = shell.activeToolId;
    const drawing = !!active && active !== 'select';
    app.renderer?.setCrosshairVisible(drawing);
  });

  $effect(() => {
    // Expose the renderer for E2E specs (e.g. shift-rclick-osnap, crosshair)
    // and as an extension hook for AI/automation per the platform thesis. Was
    // previously gated on `import.meta.env.DEV`, which kept the global out of
    // prod sirv builds (and out of CI Playwright runs that hit packages/app/build),
    // breaking specs that rely on `window.__nexusRenderer.worldToScreen(...)`.
    if (typeof window !== 'undefined' && app.renderer) {
      (window as unknown as { __nexusRenderer?: unknown }).__nexusRenderer = app.renderer;
    }
  });

  function handleCommand(cmd: string) {
    const trimmed = cmd.trim();
    if (!trimmed) {
      // Empty Enter while a tool is active: dispatch to the tool
      // (e.g. TRIM select-all default, LINE end-chain, OFFSET use-default)
      if (shell.mode === 'TOOL_ACTIVE') {
        shell.handleInput({ type: 'COMMAND_TEXT', text: '' });
      }
      return;
    }
    // 'esc' is the cancel sentinel from CommandLine — never the "last command"
    // a user wants to repeat with Space.
    if (trimmed.toLowerCase() !== 'esc') {
      lastCommand = trimmed;
    }
    shell.handleInput({ type: 'COMMAND_TEXT', text: trimmed });
  }

  onMount(async () => {
    try {
      const wasmModule = await import('@nexus/kernel');
      await wasmModule.default();
      if (wasmModule.init_tracing) {
        wasmModule.init_tracing(import.meta.env.VITE_LOG_LEVEL || 'info');
      }
      app.setKernel(new wasmModule.Kernel());
      log.info('WASM kernel initialized');
      shell.updateDeps();
      shell.installLayerLockGate();
      app.statusText = 'Ready — select a tool or press / for command line';

      if (!welcomeVisible && !showLogin && app.projectName === 'untitled') {
        app.handleNew();
      }

      shell.onPointAccepted = (pt, prompt) => {
        cmdLine?.echo(`${app.formatLinear(pt.x)},${app.formatLinear(pt.y)}`, prompt);
      };

      let bridgeClient: BridgeClient | null = null;
      if (import.meta.env.DEV) {
        bridgeClient = new BridgeClient(app);
        bridgeClient.connect();
        log.info('MCP bridge client connecting to ws://localhost:3100');
      }
      const timer = setInterval(() => app.autoSave(), 30000);
      return () => {
        clearInterval(timer);
        bridgeClient?.disconnect();
        app.destroyCloud();
      };
    } catch (e) {
      app.statusText = `Init error: ${e}`;
      log.error('WASM init failed', { error: String(e) });
    }
  });

  function isTextInputFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** Track whether the shell started a tool from the current keypress */
  let modeBeforeKey: string | null = null;

  function handleKeydown(e: KeyboardEvent) {
    // When the command line has focus, only let global modifier combos through
    // (Ctrl+Z/Y/S/N/O/A/X/C/V) — ordinary typed keys belong to the input.
    // Without this gate, Ctrl+Z falls through to the browser's text-input undo
    // and never reaches the canvas (a no-op when the input is empty).
    const isGlobalCombo =
      (e.ctrlKey || e.metaKey) &&
      ['z', 'y', 's', 'n', 'o', 'a', 'x', 'c', 'v'].includes(e.key.toLowerCase());
    if (document.activeElement?.id === 'cmd-input' && !isGlobalCombo) return;
    // Any other text field (sign-in phone/OTP, dialogs, property editors) owns
    // its keystrokes entirely, so they must not be hijacked into the command line.
    if (isTextInputFocused() && document.activeElement?.id !== 'cmd-input') return;

    modeBeforeKey = shell.mode;

    const event: InputEvent = {
      type: 'KEY_DOWN',
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey || e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      raw: e,
    };

    shell.handleInput(event);

    // Prevent default for keys the shell handles
    if (
      e.key === 'Escape' ||
      ((e.ctrlKey || e.metaKey) &&
        ['z', 'y', 'x', 'c', 'v', 's', 'n', 'o', 'a', 'l'].includes(e.key.toLowerCase())) ||
      e.key === 'Delete' ||
      e.key === 'Backspace' ||
      e.key === '/' ||
      ['+', '-', '=', 'Home', 'F1', 'F2', 'F3', 'F7', 'F8', 'F9', 'F12'].includes(e.key)
    ) {
      e.preventDefault();
    }

    if (e.key === 'F1') {
      helpVisible = true;
      return;
    }

    if (e.key === '/' && !isTextInputFocused()) {
      cmdLine?.focus();
      return;
    }

    // Forward unhandled alphanumeric to command line
    if (/^[a-zA-Z0-9.,@]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't forward if the shell just started a tool from this key
      if (shell.mode === 'TOOL_ACTIVE' && modeBeforeKey === 'IDLE') {
        e.preventDefault();
        return;
      }
      // Forward to command line for typing
      e.preventDefault();
      cmdLine?.focusWithKey(e.key);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();

    // F-2: Shift+RClick → AutoCAD OSNAP override menu (one-shot snap mode for
    // the next pick). Plain right-click still falls through to the existing
    // selection context menu below.
    if (e.shiftKey) {
      osnapMenu = { visible: true, x: e.clientX, y: e.clientY };
      return;
    }

    if (shell.mode === 'TOOL_ACTIVE') {
      shell.handleInput({
        type: 'POINTER_DOWN',
        point: { x: 0, y: 0 },
        worldX: 0,
        worldY: 0,
        button: 'right',
        shiftKey: false,
        ctrlKey: false,
      });
      return;
    }

    if (shell.selection.isEmpty() && app.renderer) {
      const hitId = app.renderer.hitTest(app.cursorX, app.cursorY);
      if (hitId) shell.selection.toggle(hitId);
    }
    ctxMenu = { visible: true, x: e.clientX, y: e.clientY };
  }

  function isExplodable(): boolean {
    if (!app.kernel) return false;
    const ids = shell.selection.getIds();
    for (const id of ids) {
      try {
        const json = app.kernel.get_entity_json(id);
        if (json.includes('Polyline') || json.includes('Rectangle') || json.includes('BlockRef'))
          return true;
      } catch {
        /* entity may not exist */
      }
    }
    return false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app">
  {#if !mobileNoticeDismissed}
    <div class="mobile-notice" role="status" data-testid="mobile-banner">
      <span>NEXUS CAD works best on a computer</span>
      <button
        class="mobile-notice-close"
        onclick={dismissMobileNotice}
        aria-label="Dismiss"
        title="Dismiss">&times;</button
      >
    </div>
  {/if}
  <QuickAccessToolbar />
  <Ribbon
    onBrowse={() => {
      if (app.authService?.isAuthenticated) {
        cloudBrowserVisible = true;
      } else {
        browserVisible = true;
      }
    }}
    onSignOut={() => {
      showLogin = true;
    }}
  />
  <DrawingTabs />
  <div class="main-area">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="workspace-wrapper" oncontextmenu={handleContextMenu}>
      <Workspace />
    </div>
    {#if app.chatPanelOpen}
      <div class="chat-sidebar">
        <ChatPanel />
      </div>
    {/if}
  </div>
  <LayoutTabs />
  <CommandLine
    bind:this={cmdLine}
    onCommand={handleCommand}
    onRepeatLast={() => {
      if (lastCommand) handleCommand(lastCommand);
    }}
    statusText={shell.prompt}
    {commandAliases}
    {layerNames}
    {blockNames}
    activeToolId={shell.activeToolId ?? ''}
    onLayerSelect={handleLayerSelect}
    onBlockSelect={handleBlockSelect}
  />
  <StatusBar />
</div>

<ContextMenu
  x={ctxMenu.x}
  y={ctxMenu.y}
  visible={ctxMenu.visible}
  {lastCommand}
  canUndo={app.canUndo}
  canRedo={app.canRedo}
  hasSelection={shell.selection.count > 0}
  canExplode={isExplodable()}
  hasClipboard={app.clipboard.length > 0}
  recentCommands={app.commandHistory.slice(-5).reverse()}
  onClose={() => (ctxMenu.visible = false)}
  onRepeatLast={() => {
    if (lastCommand) handleCommand(lastCommand);
  }}
  onUndo={() => app.undo()}
  onRedo={() => app.redo()}
  onDelete={() => {
    const ids = shell.selection.getIds();
    for (const id of ids) app.executeCommand({ type: 'DeleteEntity', id });
    shell.selection.clear();
  }}
  onSelectAll={() => shell.selection.selectAll()}
  onZoomExtents={() => app.renderer?.zoomExtents()}
  onMove={() => shell.setTool('move')}
  onCopy={() => shell.setTool('copy')}
  onRotate={() => shell.setTool('rotate')}
  onMirror={() => shell.setTool('mirror')}
  onScale={() => shell.setTool('scale')}
  onExplode={() => shell.setTool('explode')}
  onProperties={() => {
    app.propertiesPanelOpen = true;
  }}
  onCut={() => app.cutSelected()}
  onClipboardCopy={() => app.copySelected()}
  onPaste={() => app.pasteClipboard()}
  onRecentCommand={(cmd) => handleCommand(cmd)}
/>

<OsnapOverrideMenu
  x={osnapMenu.x}
  y={osnapMenu.y}
  visible={osnapMenu.visible}
  onClose={() => (osnapMenu.visible = false)}
  onOverride={(mode: string) => {
    if (app.renderer?.snapEngine) {
      app.renderer.snapEngine.oneShotOverride =
        mode as typeof app.renderer.snapEngine.oneShotOverride;
    }
  }}
  onOpenSettings={() => handleCommand('osnap')}
/>

<ProjectBrowser bind:visible={browserVisible} />
<CloudProjectBrowser bind:visible={cloudBrowserVisible} />
<SaveDialog bind:visible={saveDialogVisible} />
<WelcomeScreen bind:visible={welcomeVisible} />
<UnitsDialog bind:visible={app.unitsDialogOpen} />
<QuickSelectDialog bind:visible={app.quickSelectDialogOpen} />

<HelpOverlay visible={helpVisible} onClose={() => (helpVisible = false)} />
<ToastNotification />

{#if app.actionRecorderOpen}
  <div class="action-recorder-overlay">
    <ActionRecorder />
  </div>
{/if}

{#if showLogin && app.authService && !app.authService.loading}
  <LoginPage authService={app.authService} onGuest={chooseGuest} />
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh; /* fallback for browsers without dynamic viewport units */
    height: 100dvh; /* keeps the command line + status bar above mobile browser chrome */
    width: 100%;
    user-select: none;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  /* Only shown below 600px; hidden on desktop regardless of dismissal state. */
  .mobile-notice {
    display: none;
  }

  @media (max-width: 600px) {
    .mobile-notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      flex-shrink: 0;
      padding: var(--space-xs) var(--space-md);
      background: var(--color-bg-tertiary);
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-size: var(--font-size-xs);
    }
  }

  .mobile-notice-close {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 1rem;
    line-height: 1;
    min-width: 32px;
    min-height: 28px;
    cursor: pointer;
  }

  .main-area {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .workspace-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .chat-sidebar {
    width: 340px;
    min-width: 280px;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .action-recorder-overlay {
    position: fixed;
    top: 60px;
    left: 16px;
    z-index: 50;
  }
</style>
