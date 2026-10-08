<script lang="ts">
  import { BUILT_IN_TEMPLATES, type DrawingTemplate } from '$lib/templates/templates';

  let {
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onExportDxf,
    onExportPdf,
    onImportDxf,
    onBrowse,
    onApplyTemplate,
    onPurge,
    projectName,
    autoSaveStatus,
  } = $props<{
    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
    onSaveAs: () => void;
    onExportDxf: () => void;
    onExportPdf: () => void;
    onImportDxf: () => void;
    onBrowse: () => void;
    onApplyTemplate: (template: DrawingTemplate) => void;
    onPurge?: () => void;
    projectName: string;
    autoSaveStatus: string;
  }>();

  let open = $state(false);
  let templateSubmenuOpen = $state(false);
  let triggerEl: HTMLButtonElement;
  let dropStyle = $state('');

  function handleAction(action: () => void) {
    action();
    open = false;
  }

  function toggleMenu() {
    open = !open;
    if (open && triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      dropStyle = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;`;
    }
  }
</script>

<div class="file-menu">
  <button class="menu-trigger" bind:this={triggerEl} onclick={toggleMenu}> File ▾ </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => (open = false)}></div>
    <div class="dropdown" style={dropStyle}>
      <button onclick={() => handleAction(onNew)}
        >New Project <span class="shortcut">Ctrl+N</span></button
      >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="submenu-wrap"
        onmouseenter={() => (templateSubmenuOpen = true)}
        onmouseleave={() => (templateSubmenuOpen = false)}
      >
        <button class="submenu-trigger"
          >New from Template <span class="arrow-right">&rsaquo;</span></button
        >
        {#if templateSubmenuOpen}
          <div class="submenu">
            {#each BUILT_IN_TEMPLATES as template (template.id)}
              <button onclick={() => handleAction(() => onApplyTemplate(template))}
                >{template.name}</button
              >
            {/each}
          </div>
        {/if}
      </div>
      <button onclick={() => handleAction(onOpen)}
        >Open File... <span class="shortcut">Ctrl+O</span></button
      >
      <button onclick={() => handleAction(onBrowse)}>Browse Projects...</button>
      <hr />
      <button onclick={() => handleAction(onSave)}>Save <span class="shortcut">Ctrl+S</span></button
      >
      <button onclick={() => handleAction(onSaveAs)}
        >Save As... <span class="shortcut">Ctrl+Shift+S</span></button
      >
      <hr />
      <button onclick={() => handleAction(onImportDxf)}>Import DXF...</button>
      <button onclick={() => handleAction(onExportDxf)}>Export DXF</button>
      <button onclick={() => handleAction(onExportPdf)}>Export PDF</button>
      <hr />
      {#if onPurge}
        <button onclick={() => handleAction(onPurge)}>Purge Unused</button>
        <hr />
      {/if}
      <div class="menu-info">
        <span class="label">Project:</span>
        {projectName || 'untitled'}
      </div>
      <div class="menu-info">
        <span class="label">Auto-save:</span>
        {autoSaveStatus}
      </div>
    </div>
  {/if}
</div>

<style>
  .file-menu {
    position: relative;
    flex-shrink: 0;
  }

  .menu-trigger {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
  }

  .menu-trigger:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border-menu);
  }

  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: var(--space-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    min-width: 220px;
    z-index: var(--z-dropdown);
    box-shadow: var(--shadow-menu);
  }

  .dropdown button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-md) var(--space-xl);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    text-align: left;
  }

  .dropdown button:hover {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }

  .shortcut {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  hr {
    border: none;
    border-top: 1px solid var(--color-border-input);
    margin: var(--space-xs) 0;
  }

  .menu-info {
    padding: var(--space-sm) var(--space-xl);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .menu-info .label {
    color: var(--color-text-secondary);
  }

  .submenu-wrap {
    position: relative;
  }

  .submenu-trigger {
    display: flex !important;
    justify-content: space-between !important;
  }

  .arrow-right {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .submenu {
    position: absolute;
    left: 100%;
    top: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    min-width: 180px;
    z-index: var(--z-dropdown);
    box-shadow: var(--shadow-menu);
  }

  .submenu button {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text-primary);
    padding: var(--space-md) var(--space-xl);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    text-align: left;
  }

  .submenu button:hover {
    background: var(--color-bg-active);
    color: var(--color-text-bright);
  }
</style>
