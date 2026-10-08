<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import {
    getRecentProjects,
    formatRelativeDate,
    type RecentProject,
  } from '$lib/utils/recentProjects';
  import { BUILT_IN_TEMPLATES, type DrawingTemplate } from '$lib/templates/templates';

  let { visible = $bindable(true) } = $props<{ visible: boolean }>();

  const app = getContext<AppState>('app');
  let templateMenuOpen = $state(false);

  let recentProjects = $state<RecentProject[]>([]);

  onMount(() => {
    loadRecentProjects();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && visible) {
        visible = false;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function loadRecentProjects() {
    recentProjects = await getRecentProjects(8);
  }

  async function openRecentProject(name: string) {
    try {
      const { loadProject, deserializeProject } = await import('@nexus/file-io');
      const data = await loadProject(name);
      if (!data || !app.kernel) return;
      const project = deserializeProject(data);
      if (!project) {
        app.statusText = `Failed to parse project: ${name}`;
        return;
      }

      const wasmModule = await import('@nexus/kernel');
      app.setKernel(new wasmModule.Kernel());
      for (const ent of project.entities) {
        (app as any).importEntity(ent.geometry, ent.layer_id || 'default');
      }
      app.projectName = name;
      app.syncView();
      app.renderer?.zoomExtents();
      app.statusText = `Opened: ${name}`;
      visible = false;
    } catch (e) {
      app.statusText = `Open failed: ${e}`;
    }
  }

  async function newDrawing() {
    await app.handleNew();
    try {
      const { deleteProject } = await import('@nexus/file-io');
      await deleteProject(app.projectName);
    } catch {
      // OPFS clear is best-effort
    }
    visible = false;
  }

  async function newFromTemplate(template: DrawingTemplate) {
    await app.applyTemplate(template);
    templateMenuOpen = false;
    visible = false;
  }

  async function openSample() {
    if (!app.kernel) return;
    await app.handleNew();

    const cmds: object[] = [
      { type: 'CreateLine', x1: 0, y1: 0, x2: 20, y2: 0, layer_id: 'default' },
      { type: 'CreateLine', x1: 20, y1: 0, x2: 20, y2: 15, layer_id: 'default' },
      { type: 'CreateLine', x1: 20, y1: 15, x2: 0, y2: 15, layer_id: 'default' },
      { type: 'CreateLine', x1: 0, y1: 15, x2: 0, y2: 0, layer_id: 'default' },
      { type: 'CreateLine', x1: 10, y1: 0, x2: 10, y2: 7, layer_id: 'default' },
      { type: 'CreateLine', x1: 10, y1: 8.5, x2: 10, y2: 15, layer_id: 'default' },
      { type: 'CreateLine', x1: 0, y1: 7.5, x2: 4, y2: 7.5, layer_id: 'default' },
      { type: 'CreateLine', x1: 5.5, y1: 7.5, x2: 10, y2: 7.5, layer_id: 'default' },
      { type: 'CreateLine', x1: 10, y1: 7.5, x2: 14, y2: 7.5, layer_id: 'default' },
      { type: 'CreateLine', x1: 15.5, y1: 7.5, x2: 20, y2: 7.5, layer_id: 'default' },
      {
        type: 'CreateArc',
        cx: 10,
        cy: 7,
        radius: 1.5,
        start_angle: 0,
        end_angle: 1.5708,
        layer_id: 'default',
      },
      {
        type: 'CreateArc',
        cx: 4,
        cy: 7.5,
        radius: 1.5,
        start_angle: 4.7124,
        end_angle: 6.2832,
        layer_id: 'default',
      },
      {
        type: 'CreateArc',
        cx: 15.5,
        cy: 7.5,
        radius: 1.5,
        start_angle: 3.1416,
        end_angle: 4.7124,
        layer_id: 'default',
      },
      {
        type: 'CreateArc',
        cx: 8,
        cy: 0,
        radius: 1.5,
        start_angle: 0,
        end_angle: 1.5708,
        layer_id: 'default',
      },
      {
        type: 'CreateText',
        x: 3,
        y: 11,
        content: 'Living Room',
        height: 0.8,
        rotation: 0,
        layer_id: 'default',
      },
      {
        type: 'CreateText',
        x: 13,
        y: 11,
        content: 'Bedroom',
        height: 0.8,
        rotation: 0,
        layer_id: 'default',
      },
      {
        type: 'CreateText',
        x: 3.5,
        y: 3.5,
        content: 'Kitchen',
        height: 0.8,
        rotation: 0,
        layer_id: 'default',
      },
      {
        type: 'CreateText',
        x: 13.5,
        y: 3.5,
        content: 'Bathroom',
        height: 0.8,
        rotation: 0,
        layer_id: 'default',
      },
      { type: 'CreateDimension', x1: 0, y1: 0, x2: 20, y2: 0, offset: -1.5, layer_id: 'default' },
      { type: 'CreateDimension', x1: 20, y1: 0, x2: 20, y2: 15, offset: 1.5, layer_id: 'default' },
    ];

    for (const cmd of cmds) {
      app.executeCommand(cmd);
    }

    app.projectName = 'Sample Floor Plan';
    app.statusText = 'Sample floor plan loaded';
    visible = false;
    // Delay zoomExtents to let canvas resize after panels close
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        app.renderer?.zoomExtents();
      });
    });
  }
</script>

{#if visible}
  <div class="overlay" data-testid="welcome-screen">
    <div class="card">
      <div class="logo">NEXUS</div>
      <h1>Welcome to NEXUS CAD</h1>
      <p>Browser-native 2D drafting — draw, dimension, export DXF.</p>

      <div class="buttons">
        <button class="primary" onclick={newDrawing}>New Drawing</button>
        <button class="secondary" onclick={openSample}>Open Sample</button>
      </div>

      <div class="template-section">
        <div class="template-trigger-wrap">
          <button class="template-trigger" onclick={() => (templateMenuOpen = !templateMenuOpen)}>
            From Template {templateMenuOpen ? '\u25B4' : '\u25BE'}
          </button>
          {#if templateMenuOpen}
            <div class="template-dropdown">
              {#each BUILT_IN_TEMPLATES as template (template.id)}
                <button class="template-item" onclick={() => newFromTemplate(template)}>
                  <span class="template-name">{template.name}</span>
                  <span class="template-desc">{template.description}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      {#if recentProjects.length > 0}
        <div class="recent-projects">
          <h3>Recent Projects</h3>
          <ul>
            {#each recentProjects as project (project.name)}
              <li>
                <button class="project-link" onclick={() => openRecentProject(project.name)}>
                  <span class="project-name">{project.name}</span>
                  <span class="project-date">{formatRelativeDate(project.lastModified)}</span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="quick-start">
        <h3>Quick Start</h3>
        <ol>
          <li>
            <strong>Draw:</strong> Press <kbd>L</kbd> for Line, <kbd>C</kbd> for Circle,
            <kbd>R</kbd> for Rectangle — click to place points
          </li>
          <li>
            <strong>Select:</strong> Click an entity to select it, or drag a window to select multiple
          </li>
          <li>
            <strong>Edit:</strong> Press <kbd>M</kbd> to Move, <kbd>CO</kbd> to Copy, <kbd>RO</kbd> to
            Rotate selected entities
          </li>
          <li><strong>Undo:</strong> <kbd>Ctrl+Z</kbd> to undo, <kbd>Ctrl+Shift+Z</kbd> to redo</li>
          <li>
            <strong>Command line:</strong> Press <kbd>/</kbd> or type any command name at the bottom
          </li>
          <li>
            <strong>Coordinates:</strong> Type <code>10,20</code> for absolute, <code>@5,3</code> for
            relative
          </li>
          <li><strong>Export:</strong> File menu → Export DXF to open in AutoCAD</li>
        </ol>
      </div>

      <div class="shortcuts">
        <span>Esc — Cancel</span>
        <span>F3 — Snap</span>
        <span>F8 — Ortho</span>
        <span>F1 — Help</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-welcome);
  }

  .card {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-3xl);
    padding: var(--space-4xl) 56px;
    text-align: center;
    max-width: 520px;
    box-shadow: var(--shadow-card);
  }

  .logo {
    font-weight: 700;
    font-size: 2rem;
    color: var(--color-accent);
    letter-spacing: 4px;
    margin-bottom: var(--space-md);
  }

  h1 {
    margin: 0 0 var(--space-md);
    font-size: 1.2rem;
    color: var(--color-text-heading);
    font-weight: 500;
  }

  p {
    margin: 0 0 var(--space-3xl);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .buttons {
    display: flex;
    gap: var(--space-lg);
    justify-content: center;
    margin-bottom: var(--space-3xl);
  }

  .buttons button {
    padding: 10px 28px;
    border-radius: var(--radius-xl);
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-text-bright);
  }
  .primary:hover {
    background: var(--color-accent-hover);
  }

  .secondary {
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-menu) !important;
  }
  .secondary:hover {
    background: var(--color-bg-hover);
  }

  .template-section {
    display: flex;
    justify-content: center;
    margin-bottom: var(--space-2xl);
  }

  .template-trigger-wrap {
    position: relative;
  }

  .template-trigger {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.78rem;
    padding: var(--space-xs) var(--space-md);
  }

  .template-trigger:hover {
    color: var(--color-text-primary);
  }

  .template-dropdown {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: var(--space-xs);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-menu);
    border-radius: var(--radius-lg);
    min-width: 260px;
    z-index: 10;
    box-shadow: var(--shadow-menu);
    overflow: hidden;
  }

  .template-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: none;
    padding: var(--space-md) var(--space-xl);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .template-item:hover {
    background: var(--color-bg-active);
  }

  .template-name {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .template-desc {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 2px;
  }

  .recent-projects {
    text-align: left;
    margin-bottom: var(--space-2xl);
    padding: var(--space-lg) var(--space-xl);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-bg-input);
  }

  .recent-projects h3 {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 var(--space-md);
  }

  .recent-projects ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recent-projects li {
    border-bottom: 1px solid var(--color-bg-input);
  }

  .recent-projects li:last-child {
    border-bottom: none;
  }

  .project-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-sm) var(--space-sm);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .project-link:hover {
    background: var(--color-bg-hover);
  }

  .project-name {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--color-text-label);
  }

  .project-date {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-lg);
  }

  .quick-start {
    text-align: left;
    margin-bottom: var(--space-2xl);
    padding: var(--space-lg) var(--space-xl);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-bg-input);
  }
  .quick-start h3 {
    font-size: 0.75rem;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 var(--space-md);
  }
  .quick-start ol {
    margin: 0;
    padding-left: var(--space-xl);
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    line-height: 1.8;
  }
  .quick-start li {
    margin-bottom: var(--space-xs);
  }
  .quick-start strong {
    color: var(--color-text-label);
  }
  .quick-start kbd {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-sm);
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--color-success);
  }
  .quick-start code {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 0 var(--space-sm);
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--color-warning);
  }

  .shortcuts {
    display: flex;
    gap: var(--space-xl);
    justify-content: center;
    flex-wrap: wrap;
    color: var(--color-text-dim);
    font-size: 0.72rem;
  }

  .shortcuts span {
    background: var(--color-bg-tertiary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-bg-input);
  }

  @media (max-width: 480px) {
    .card {
      margin: var(--space-md);
      padding: var(--space-3xl) var(--space-xl);
      max-width: none;
      width: calc(100% - var(--space-xl));
      border-radius: var(--radius-2xl);
    }
    .logo {
      font-size: 1.5rem;
    }
    h1 {
      font-size: 1rem;
    }
    .buttons {
      flex-direction: column;
      gap: var(--space-md);
    }
    .buttons button {
      width: 100%;
      padding: 12px 20px;
    }
    .shortcuts {
      gap: var(--space-md);
    }
  }
</style>
