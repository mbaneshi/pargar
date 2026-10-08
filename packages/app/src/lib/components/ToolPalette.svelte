<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { InteractionShell } from '$lib/shell/InteractionShell.svelte';

  const app = getContext<AppState>('app');
  const shell = getContext<InteractionShell>('shell');

  let { onCollapse }: { onCollapse?: () => void } = $props();

  type PaletteTab = 'draw' | 'blocks' | 'hatches';
  let activeTab = $state<PaletteTab>('draw');

  const drawTools = [
    { id: 'line', name: 'Line', icon: '\u2571' },
    { id: 'circle', name: 'Circle', icon: '\u25CB' },
    { id: 'rectangle', name: 'Rectangle', icon: '\u25AD' },
    { id: 'arc', name: 'Arc', icon: '\u25DC' },
    { id: 'polyline', name: 'Polyline', icon: '\u299A' },
    { id: 'ellipse', name: 'Ellipse', icon: '\u2B2D' },
    { id: 'spline', name: 'Spline', icon: '\u223F' },
    { id: 'point', name: 'Point', icon: '\u2022' },
    { id: 'text', name: 'Text', icon: 'A' },
    { id: 'dimension', name: 'Dimension', icon: '\u2194' },
    { id: 'construction_line', name: 'Construction Line', icon: '\u2508' },
    { id: 'revision_cloud', name: 'Revision Cloud', icon: '\u2601' },
  ];

  const hatchPatterns = [
    { name: 'SOLID', description: 'Solid fill' },
    { name: 'ANSI31', description: 'Iron, brick, stone' },
    { name: 'ANSI32', description: 'Steel' },
    { name: 'ANSI33', description: 'Bronze, brass' },
    { name: 'CROSS', description: 'Cross pattern' },
    { name: 'DOTS', description: 'Dot pattern' },
  ];

  function getBlockDefs(): Array<{ id: string; name: string }> {
    if (!app.kernel) return [];
    try {
      const defs: Array<{ id: string; name: string }> = JSON.parse(
        app.kernel.get_block_defs_json(),
      );
      return defs;
    } catch {
      return [];
    }
  }

  let blockDefs = $derived(getBlockDefs());

  function activateTool(toolId: string) {
    shell.setTool(toolId);
  }

  function insertBlock(_blockName: string) {
    shell.setTool('insert');
  }

  function activateHatch(_patternName: string) {
    shell.setTool('hatch');
  }
</script>

<aside class="tool-palette">
  <div class="panel-header">
    <span>Tool Palettes</span>
    {#if onCollapse}
      <button onclick={onCollapse} title="Close">&times;</button>
    {/if}
  </div>

  <div class="tab-bar">
    <button
      class="tab-btn"
      class:active={activeTab === 'draw'}
      onclick={() => (activeTab = 'draw')}
    >
      Draw
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'blocks'}
      onclick={() => (activeTab = 'blocks')}
    >
      Blocks
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'hatches'}
      onclick={() => (activeTab = 'hatches')}
    >
      Hatches
    </button>
  </div>

  <div class="palette-content">
    {#if activeTab === 'draw'}
      <div class="tool-list">
        {#each drawTools as tool (tool.id)}
          <button
            class="tool-item"
            class:active={shell.activeToolId === tool.id}
            onclick={() => activateTool(tool.id)}
            title={tool.name}
          >
            <span class="tool-icon">{tool.icon}</span>
            <span class="tool-name">{tool.name}</span>
          </button>
        {/each}
      </div>
    {:else if activeTab === 'blocks'}
      <div class="tool-list">
        {#if blockDefs.length === 0}
          <div class="empty-state">No blocks defined</div>
        {:else}
          {#each blockDefs as block (block.id)}
            <button
              class="tool-item"
              onclick={() => insertBlock(block.name)}
              title="Insert block: {block.name}"
            >
              <span class="tool-icon">&#x25A3;</span>
              <span class="tool-name">{block.name}</span>
            </button>
          {/each}
        {/if}
      </div>
    {:else if activeTab === 'hatches'}
      <div class="tool-list">
        {#each hatchPatterns as pattern (pattern.name)}
          <button
            class="tool-item"
            onclick={() => activateHatch(pattern.name)}
            title={pattern.description}
          >
            <span class="tool-icon">&#x2592;</span>
            <span class="tool-name">{pattern.name}</span>
            <span class="tool-desc">{pattern.description}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</aside>

<style>
  .tool-palette {
    width: 100%;
    height: 100%;
    background: var(--color-bg-secondary);
    border-left: 1px solid var(--color-border);
    padding: 0;
    overflow-y: auto;
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-bg-tertiary);
    font-weight: 600;
    color: var(--color-text-heading);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .panel-header button {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1rem;
    padding: 0 var(--space-xs);
    line-height: 1;
  }
  .panel-header button:hover {
    color: var(--color-accent);
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-tertiary);
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 100ms ease,
      border-color 100ms ease;
  }

  .tab-btn:hover {
    background: var(--color-bg-input);
  }

  .tab-btn.active {
    color: var(--color-text-accent);
    border-bottom-color: var(--color-accent-blue);
    background: var(--color-bg-secondary);
  }

  .palette-content {
    flex: 1;
    overflow-y: auto;
  }

  .tool-list {
    display: flex;
    flex-direction: column;
    padding: var(--space-sm) 0;
  }

  .tool-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 100ms ease;
    min-height: 28px;
  }

  .tool-item:hover {
    background: var(--color-bg-input);
  }

  .tool-item.active {
    background: var(--color-bg-hover);
    color: var(--color-text-accent);
  }

  .tool-icon {
    width: 20px;
    text-align: center;
    font-size: var(--font-size-md);
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .tool-item.active .tool-icon {
    color: var(--color-text-accent);
  }

  .tool-name {
    flex: 1;
  }

  .tool-desc {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    margin-left: auto;
  }

  .empty-state {
    padding: var(--space-xl) var(--space-lg);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }
</style>
