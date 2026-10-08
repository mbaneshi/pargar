<script lang="ts">
  import { getContext } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { InteractionShell } from '$lib/shell/InteractionShell.svelte';
  import FileMenu from '$lib/FileMenu.svelte';
  import UserMenu from '$lib/components/UserMenu.svelte';
  import { RIBBON_LAYOUT } from '$lib/protocol/ribbon-layout';
  import { WORKSPACES } from '$lib/protocol/workspaces';
  import { commandRegistry } from '$lib/commands/CommandRegistry';
  import SplitButton from '$lib/components/SplitButton.svelte';
  import {
    loadRibbonCustomization,
    saveRibbonCustomization,
    filterHiddenTabs,
    filterVisiblePanels,
  } from '$lib/protocol/ribbon-customization';

  let { onBrowse, onSignOut } = $props<{ onBrowse: () => void; onSignOut: () => void }>();

  const app = getContext<AppState>('app');
  const shell = getContext<InteractionShell>('shell');

  let activeTabId = $state('home');

  const initialCustomization = loadRibbonCustomization();
  const hiddenTabIds = new SvelteSet<string>(initialCustomization.hiddenTabs);
  let hiddenPanelsByTab = $state<Record<string, string[]>>(initialCustomization.hiddenPanels);

  let contextMenuVisible = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);

  let workspaceTabs = $derived(() => {
    const ws = WORKSPACES.find((w) => w.id === app.activeWorkspace);
    if (!ws) return RIBBON_LAYOUT;
    return RIBBON_LAYOUT.filter((t) => ws.visibleTabs.includes(t.id));
  });

  let effectiveVisibleTabs = $derived(() => filterHiddenTabs(workspaceTabs(), hiddenTabIds));

  let activeTab = $derived(
    effectiveVisibleTabs().find((t) => t.id === activeTabId) ?? effectiveVisibleTabs()[0],
  );

  let visiblePanels = $derived(() =>
    activeTab ? filterVisiblePanels(activeTab.panels, hiddenPanelsByTab[activeTab.id] ?? []) : [],
  );

  function persistRibbonCustomization() {
    saveRibbonCustomization({ hiddenTabs: [...hiddenTabIds], hiddenPanels: hiddenPanelsByTab });
  }

  function openRibbonMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuVisible = true;
  }

  function closeRibbonMenu() {
    contextMenuVisible = false;
  }

  function toggleTabHidden(tabId: string) {
    if (hiddenTabIds.has(tabId)) {
      hiddenTabIds.delete(tabId);
    } else {
      hiddenTabIds.add(tabId);
    }
    persistRibbonCustomization();
  }

  function togglePanelHidden(tabId: string, panelLabel: string) {
    const current = hiddenPanelsByTab[tabId] ?? [];
    const next = current.includes(panelLabel)
      ? current.filter((label) => label !== panelLabel)
      : [...current, panelLabel];
    hiddenPanelsByTab = { ...hiddenPanelsByTab, [tabId]: next };
    persistRibbonCustomization();
  }

  function resetRibbonCustomization() {
    hiddenTabIds.clear();
    hiddenPanelsByTab = {};
    persistRibbonCustomization();
    closeRibbonMenu();
  }

  function handleToolClick(commandId: string) {
    const def = commandRegistry.get(commandId);
    if (!def) return;
    if (def.invoke) {
      const alias = commandRegistry.canonicalAlias(commandId);
      shell.setTool(alias);
    } else {
      const ids = shell.selection.getIds();
      def.execute({ entity_id: ids[0], entity_a: ids[0], entity_b: ids[1], ids });
    }
  }

  function handleAction(action: string) {
    switch (action) {
      case 'undo':
        app.undo();
        break;
      case 'redo':
        app.redo();
        break;
      case 'delete-selected':
        for (const id of shell.selection.getIds()) app.executeCommand({ type: 'DeleteEntity', id });
        shell.selection.clear();
        break;
      case 'zoom-extents':
        app.renderer?.zoomExtents();
        break;
      case 'save-view': {
        const name = prompt('View name:');
        if (name) app.saveNamedView(name);
        break;
      }
      case 'restore-view': {
        const names = Array.from(app.namedViews.keys());
        if (names.length === 0) {
          app.statusText = 'No saved views. Use Save View first.';
        } else {
          const name = prompt(`Restore view (${names.join(', ')}):`);
          if (name) app.restoreNamedView(name);
        }
        break;
      }
    }
  }

  function getShortcut(commandId: string): string {
    return shell.getShortcutDisplay(commandId);
  }

  function isToolActive(commandId: string): boolean {
    const def = commandRegistry.get(commandId);
    if (!def) return false;
    const alias = commandRegistry.canonicalAlias(commandId);
    return shell.activeToolId === alias;
  }

  function isActionDisabled(action: string): boolean {
    if (action === 'undo') return !app.canUndo;
    if (action === 'redo') return !app.canRedo;
    return false;
  }

  let allLayers = $derived(app.getLayers());
  let activeLayer = $derived(allLayers.find((l) => l.id === app.activeLayerId));
</script>

<header class="ribbon" data-testid="ribbon">
  <div class="tab-bar" oncontextmenu={openRibbonMenu}>
    <span class="logo">NEXUS</span>

    <FileMenu
      projectName={app.projectName}
      autoSaveStatus={app.autoSaveStatus}
      onNew={() => app.handleNew()}
      onOpen={() => app.handleOpen()}
      onSave={() => app.handleSave()}
      onSaveAs={() => app.handleSaveAs()}
      onExportDxf={() => app.handleExportDxf()}
      onImportDxf={() => app.handleOpen()}
      onPurge={() => {
        const def = commandRegistry.get('purge');
        if (def) def.execute({});
      }}
      {onBrowse}
    />

    <nav class="tabs">
      {#each effectiveVisibleTabs() as tab (tab.id)}
        <button
          class="tab-btn"
          class:active={activeTabId === tab.id}
          onclick={() => (activeTabId = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    <span class="spacer"></span>

    <div class="tab-bar-right">
      <button
        class="layers-btn"
        class:active={app.layerManagerOpen}
        onclick={() => (app.layerManagerOpen = !app.layerManagerOpen)}
        title="Layer Manager (Ctrl+L)"
      >
        Layers
      </button>

      <div class="layer-dropdown-wrapper">
        {#if activeLayer}
          <span class="layer-swatch" style="background: {activeLayer.color}"></span>
        {/if}
        <select
          class="layer-dropdown"
          bind:value={app.activeLayerId}
          title="Active layer for new entities"
        >
          {#each allLayers as layer (layer.id)}
            <option value={layer.id}>{layer.name}</option>
          {/each}
        </select>
      </div>

      {#if app.authService}
        {#if app.authService.user}
          <UserMenu authService={app.authService} {onSignOut} />
        {:else if !app.guestMode}
          <button class="sign-in-btn" onclick={onSignOut} title="Sign In">Sign In</button>
        {/if}
      {/if}

      <span class="entity-count"
        >{app.entityCount} {app.entityCount === 1 ? 'entity' : 'entities'}</span
      >
    </div>
  </div>

  <div class="panel-area">
    {#each visiblePanels() as panel, i (panel.label)}
      {#if panel.items.length > 0}
        {#if i > 0}
          <div class="panel-divider"></div>
        {/if}
        <div class="ribbon-panel">
          <div class="panel-buttons">
            {#each panel.items as item (item.label)}
              {#if item.type === 'split-tool'}
                <SplitButton
                  commandId={item.commandId}
                  label={item.label}
                  variants={item.variants}
                  active={isToolActive(item.commandId)}
                  onactivate={() => handleToolClick(item.commandId)}
                />
              {:else if item.type === 'tool'}
                {@const sc = getShortcut(item.commandId)}
                <button
                  class="ribbon-btn"
                  class:active={isToolActive(item.commandId)}
                  onclick={() => handleToolClick(item.commandId)}
                  title="{item.label}{sc ? ` (${sc})` : ''}"
                >
                  {item.label}
                </button>
              {:else}
                {@const sc = getShortcut(item.action)}
                <button
                  class="ribbon-btn"
                  onclick={() => handleAction(item.action)}
                  disabled={isActionDisabled(item.action)}
                  title="{item.label}{sc ? ` (${sc})` : ''}"
                >
                  {item.label}
                </button>
              {/if}
            {/each}
          </div>
          <span class="panel-label">{panel.label}</span>
        </div>
      {/if}
    {/each}
  </div>
</header>

<svelte:window
  onkeydown={(e) => {
    if (contextMenuVisible && e.key === 'Escape') closeRibbonMenu();
  }}
/>

{#if contextMenuVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ribbon-menu-backdrop"
    onclick={closeRibbonMenu}
    oncontextmenu={(e) => {
      e.preventDefault();
      closeRibbonMenu();
    }}
  ></div>
  <div
    class="ribbon-context-menu"
    data-testid="ribbon-context-menu"
    style="left: {contextMenuX}px; top: {contextMenuY}px"
  >
    <div class="menu-section-label">Tabs</div>
    {#each workspaceTabs() as tab (tab.id)}
      <label class="menu-checkbox-row">
        <input
          type="checkbox"
          checked={!hiddenTabIds.has(tab.id)}
          onchange={() => toggleTabHidden(tab.id)}
        />
        {tab.label}
      </label>
    {/each}
    {#if activeTab}
      <div class="menu-separator"></div>
      <div class="menu-section-label">Panels ({activeTab.label})</div>
      {#each activeTab.panels as panel (panel.label)}
        <label class="menu-checkbox-row">
          <input
            type="checkbox"
            checked={!(hiddenPanelsByTab[activeTab.id] ?? []).includes(panel.label)}
            onchange={() => togglePanelHidden(activeTab.id, panel.label)}
          />
          {panel.label}
        </label>
      {/each}
    {/if}
    <div class="menu-separator"></div>
    <button class="reset-btn" onclick={resetRibbonCustomization}>Reset Ribbon to Default</button>
  </div>
{/if}

<style>
  .ribbon {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  /* --- Tab bar (row 1) --- */
  .tab-bar {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    gap: var(--space-sm);
  }

  .logo {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-accent);
    letter-spacing: 2px;
    margin-right: var(--space-sm);
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 0;
    align-items: stretch;
    height: 100%;
  }

  .tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary);
    padding: 0 var(--space-lg);
    font-family: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
    white-space: nowrap;
    height: 100%;
    display: flex;
    align-items: center;
    transition:
      color 100ms ease,
      border-color 100ms ease;
  }

  .tab-btn:hover {
    color: var(--color-text-primary);
  }

  .tab-btn.active {
    color: var(--color-text-bright);
    border-bottom-color: var(--color-accent);
  }

  .spacer {
    flex: 1;
  }

  .tab-bar-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-shrink: 0;
  }

  .layers-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-sm);
  }

  .layers-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .layers-btn.active {
    color: var(--color-accent);
    background: var(--color-bg-active);
  }

  .layer-dropdown-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .layer-swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .layer-dropdown {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
    max-width: 110px;
  }

  .layer-dropdown:hover {
    background: var(--color-bg-hover);
  }

  .sign-in-btn {
    background: var(--color-accent);
    border: none;
    color: #fff;
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-xs);
    flex-shrink: 0;
  }

  .sign-in-btn:hover {
    background: var(--color-accent-hover);
  }

  .entity-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  /* --- Panel area (row 2) --- */
  .panel-area {
    display: flex;
    align-items: stretch;
    padding: var(--space-xs) var(--space-md);
    min-height: 42px;
    background: var(--color-bg-tertiary);
    gap: 0;
  }

  .panel-divider {
    width: 1px;
    background: var(--color-border);
    margin: var(--space-xs) var(--space-sm);
    align-self: stretch;
  }

  .ribbon-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .panel-buttons {
    display: flex;
    gap: 1px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .panel-label {
    font-size: 11px;
    color: var(--color-ribbon-label);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  .ribbon-btn {
    background: var(--color-bg-tertiary);
    border: 1px solid transparent;
    border-bottom: 2px solid transparent;
    color: var(--color-text-primary);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--font-size-sm);
    white-space: nowrap;
    transition:
      background-color 100ms ease,
      border-color 100ms ease,
      color 100ms ease;
  }

  .ribbon-btn:hover {
    background: var(--color-bg-hover);
  }

  .ribbon-btn:active {
    background: var(--color-bg-active);
  }

  .ribbon-btn.active {
    border-bottom-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-bg-active);
    animation: tool-activate 150ms ease-out;
  }

  @keyframes tool-activate {
    0% {
      background: var(--color-accent);
    }
    100% {
      background: var(--color-bg-active);
    }
  }

  .ribbon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* --- Responsive --- */
  @media (max-width: 1024px) {
    .panel-label {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .tab-bar {
      height: 24px;
      padding: 0 var(--space-sm);
    }
    .tab-btn {
      padding: 0 var(--space-md);
      font-size: var(--font-size-xs);
    }
    .panel-area {
      min-height: 32px;
      padding: var(--space-xs) var(--space-sm);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .panel-area::-webkit-scrollbar {
      display: none;
    }
    .panel-label {
      display: none;
    }
    .ribbon-btn {
      padding: var(--space-xs) var(--space-sm);
      font-size: var(--font-size-xs);
      min-height: 24px;
    }
    .entity-count {
      display: none;
    }
    .layer-dropdown-wrapper {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .tab-bar {
      height: 22px;
      padding: 0 var(--space-xs);
    }
    .tab-btn {
      padding: 0 var(--space-sm);
      font-size: 9px;
    }
    .panel-area {
      min-height: 28px;
      padding: var(--space-xs) var(--space-xs);
    }
    .ribbon-btn {
      padding: 2px 4px;
      font-size: 9px;
      min-height: 20px;
    }
  }

  /* Phone widths (#6): pin the File menu + Sign In / user menu and let the
     tab row scroll horizontally instead of pushing them off-screen. */
  @media (max-width: 600px) {
    .logo {
      display: none;
    }
    .tabs {
      flex: 1 1 auto;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .tabs::-webkit-scrollbar {
      display: none;
    }
    .spacer {
      display: none;
    }
    .tab-bar-right {
      gap: var(--space-sm);
    }
    /* One scrollable row of tool groups (panel-area already has
       overflow-x:auto below 768px) instead of wrapping into a tall block. */
    .panel-buttons {
      flex-wrap: nowrap;
    }
  }

  /* Bigger tap targets on touch screens only — no change for mouse users. */
  @media (pointer: coarse) {
    .tab-bar {
      height: 32px;
    }
    .ribbon-btn {
      min-height: 32px;
    }
    .sign-in-btn,
    .layers-btn {
      min-height: 28px;
    }
  }

  .ribbon-menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-context-backdrop);
  }

  .ribbon-context-menu {
    position: fixed;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    padding: var(--space-sm) 0;
    min-width: 200px;
    z-index: var(--z-context-menu);
    box-shadow: var(--shadow-menu);
  }

  .menu-section-label {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: var(--space-xs) var(--space-lg);
  }

  .menu-checkbox-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-xs) var(--space-lg);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .menu-checkbox-row:hover {
    background: var(--color-bg-active);
  }

  .menu-separator {
    height: 1px;
    background: var(--color-border-input);
    margin: var(--space-sm) 0;
  }

  .reset-btn {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-lg);
    font-family: inherit;
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
  }

  .reset-btn:hover {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }
</style>
