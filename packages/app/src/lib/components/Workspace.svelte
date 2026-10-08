<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import { Splitpanes, Pane } from 'svelte-splitpanes';
  import CanvasViewport from './CanvasViewport.svelte';
  import LayerManager from './LayerManager.svelte';
  import TextStyleManager from './TextStyleManager.svelte';
  import DimStyleManager from './DimStyleManager.svelte';
  import MLeaderStyleManager from './MLeaderStyleManager.svelte';
  import TableStyleManager from './TableStyleManager.svelte';
  import DrawingPropertiesDialog from './DrawingPropertiesDialog.svelte';
  import DesignCenter from './DesignCenter.svelte';
  import PropertiesPanel from '$lib/PropertiesPanel.svelte';
  import AgentPanel from './AgentPanel.svelte';
  import ToolPalette from './ToolPalette.svelte';
  import XrefManager from './XrefManager.svelte';
  import PluginManager from './PluginManager.svelte';
  import CollabPanel from './CollabPanel.svelte';

  const app = getContext<AppState>('app');

  let isMobile = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    if (isMobile) app.propertiesPanelOpen = false;
    function onChange(e: MediaQueryListEvent) {
      isMobile = e.matches;
      if (isMobile) app.propertiesPanelOpen = false;
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  let propertiesVisible = $derived(app.propertiesPanelOpen);
  let toolPaletteVisible = $derived(app.toolPaletteOpen);

  function handlePropertyUpdate(id: string, geometryJson: string) {
    app.executeCommand({ type: 'ModifyGeometry', id, geometry_json: geometryJson });
    app.selection.refreshEntity(id);
    app.statusText = 'Properties updated';
  }

  function handleChangeLayer(entityId: string, layerId: string) {
    app.executeCommand({ type: 'SetEntityLayer', entity_id: entityId, layer_id: layerId });
    app.selection.refreshEntity(entityId);
  }
</script>

<main class="workspace">
  <Splitpanes class="default-theme" style="height: 100%;">
    <Pane minSize={30}>
      <div class="viewport-area">
        <CanvasViewport />
        {#if app.layerManagerOpen}
          <div class="layer-manager-overlay">
            <LayerManager />
          </div>
        {/if}
        {#if app.textStyleManagerOpen}
          <div class="layer-manager-overlay">
            <TextStyleManager />
          </div>
        {/if}
        {#if app.dimStyleManagerOpen}
          <div class="layer-manager-overlay">
            <DimStyleManager />
          </div>
        {/if}
        {#if app.mleaderStyleManagerOpen}
          <div class="layer-manager-overlay">
            <MLeaderStyleManager />
          </div>
        {/if}
        {#if app.tableStyleManagerOpen}
          <div class="layer-manager-overlay">
            <TableStyleManager />
          </div>
        {/if}
        {#if app.drawingPropertiesOpen}
          <div class="layer-manager-overlay">
            <DrawingPropertiesDialog />
          </div>
        {/if}
        {#if app.designCenterOpen}
          <div class="layer-manager-overlay">
            <DesignCenter />
          </div>
        {/if}
        {#if app.xrefManagerOpen}
          <div class="layer-manager-overlay">
            <XrefManager />
          </div>
        {/if}
        {#if app.agentPanelOpen}
          <AgentPanel />
        {/if}
        <PluginManager />
        <CollabPanel />
      </div>
    </Pane>
    {#if propertiesVisible}
      <Pane size={20} minSize={10} maxSize={40}>
        <div class="properties-pane">
          <PropertiesPanel
            entity={app.selection.selectedEntity}
            layers={app.getLayerNames()}
            onUpdate={handlePropertyUpdate}
            onChangeLayer={handleChangeLayer}
            onCollapse={() => (app.propertiesPanelOpen = false)}
          />
        </div>
      </Pane>
    {/if}
    {#if toolPaletteVisible}
      <Pane size={15} minSize={10} maxSize={30}>
        <div class="tool-palette-pane">
          <ToolPalette onCollapse={() => (app.toolPaletteOpen = false)} />
        </div>
      </Pane>
    {/if}
  </Splitpanes>
  {#if !propertiesVisible && !isMobile}
    <button
      class="expand-properties-btn"
      onclick={() => (app.propertiesPanelOpen = true)}
      title="Show Properties"
    >
      &#9776;
    </button>
  {/if}
</main>

<style>
  .workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .viewport-area {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
  }

  .layer-manager-overlay {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 5;
  }

  .properties-pane {
    height: 100%;
    overflow-y: auto;
  }

  .tool-palette-pane {
    height: 100%;
    overflow-y: auto;
  }

  .expand-properties-btn {
    position: absolute;
    right: var(--space-md);
    top: var(--space-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-lg);
    cursor: pointer;
    z-index: var(--z-crosshair);
  }

  .expand-properties-btn:hover {
    background: var(--color-bg-input);
  }

  :global(.workspace .splitpanes__splitter) {
    background: var(--color-border) !important;
    min-width: 4px !important;
  }

  :global(.workspace .splitpanes__splitter:hover) {
    background: var(--color-accent-blue) !important;
  }

  @media (max-width: 1024px) {
    .layer-manager-overlay {
      width: 280px;
      max-width: 100%;
    }
  }

  @media (max-width: 768px) {
    .properties-pane {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 240px;
      z-index: 20;
      background: var(--color-bg-secondary);
      border-left: 1px solid var(--color-border);
    }
  }
</style>
