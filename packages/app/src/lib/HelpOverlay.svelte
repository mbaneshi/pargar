<script lang="ts">
  let { visible = false, onClose }: { visible: boolean; onClose: () => void } = $props();
</script>

{#if visible}
  <div class="overlay" onclick={onClose}>
    <div class="help-modal" onclick={(e) => e.stopPropagation()}>
      <div class="help-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={onClose}>&times;</button>
      </div>
      <div class="help-body">
        <div class="help-section">
          <h3>Drawing</h3>
          <div class="shortcut"><kbd>L</kbd> Line</div>
          <div class="shortcut"><kbd>C</kbd> Circle</div>
          <div class="shortcut"><kbd>A</kbd> Arc</div>
          <div class="shortcut"><kbd>PL</kbd> Polyline</div>
          <div class="shortcut"><kbd>REC</kbd> Rectangle</div>
          <div class="shortcut"><kbd>DT</kbd> Text</div>
          <div class="shortcut"><kbd>DIM</kbd> Dimension</div>
        </div>
        <div class="help-section">
          <h3>Editing</h3>
          <div class="shortcut"><kbd>S</kbd> Select</div>
          <div class="shortcut"><kbd>M</kbd> Move</div>
          <div class="shortcut"><kbd>CO</kbd> Copy</div>
          <div class="shortcut"><kbd>RO</kbd> Rotate</div>
          <div class="shortcut"><kbd>SC</kbd> Scale</div>
          <div class="shortcut"><kbd>O</kbd> Offset</div>
          <div class="shortcut"><kbd>TR</kbd> Trim</div>
          <div class="shortcut"><kbd>MI</kbd> Mirror</div>
          <div class="shortcut"><kbd>E / DEL</kbd> Erase</div>
        </div>
        <div class="help-section">
          <h3>View & System</h3>
          <div class="shortcut"><kbd>Ctrl+Z</kbd> Undo</div>
          <div class="shortcut"><kbd>Ctrl+Shift+Z</kbd> Redo</div>
          <div class="shortcut"><kbd>Ctrl+S</kbd> Save</div>
          <div class="shortcut"><kbd>F2</kbd> Zoom Extents</div>
          <div class="shortcut"><kbd>F3</kbd> Toggle Snap</div>
          <div class="shortcut"><kbd>F8</kbd> Toggle Ortho</div>
          <div class="shortcut"><kbd>Esc</kbd> Cancel / Deselect</div>
          <div class="shortcut"><kbd>/</kbd> Focus command line</div>
          <div class="shortcut"><kbd>Enter</kbd> Repeat last command</div>
        </div>
        <div class="help-section">
          <h3>Coordinate Input</h3>
          <div class="shortcut"><code>10,20</code> Absolute</div>
          <div class="shortcut"><code>@5,3</code> Relative</div>
          <div class="shortcut"><code>@10&lt;45</code> Polar</div>
        </div>
        <div class="help-section">
          <h3>Mouse Controls</h3>
          <div class="shortcut"><kbd>Scroll</kbd> Zoom in/out</div>
          <div class="shortcut"><kbd>Middle drag</kbd> Pan</div>
          <div class="shortcut"><kbd>Left click</kbd> Select / Place point</div>
          <div class="shortcut"><kbd>Right click</kbd> Context menu / Confirm</div>
          <div class="shortcut"><kbd>Drag left→right</kbd> Window select</div>
          <div class="shortcut"><kbd>Drag right→left</kbd> Crossing select</div>
        </div>
        <div class="help-section">
          <h3>Workflow Tips</h3>
          <div class="shortcut">Type command names in the command line at bottom</div>
          <div class="shortcut">Press Enter with no text to repeat last command</div>
          <div class="shortcut">Status bar shows LMB/RMB hints for active tool</div>
          <div class="shortcut">Click <kbd>AI</kbd> in status bar for agent log</div>
          <div class="shortcut">Snap to endpoints, midpoints, centers automatically</div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: var(--z-help-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .help-modal {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-bg-active);
    border-radius: var(--radius-2xl);
    width: 780px;
    max-height: 80vh;
    overflow-y: auto;
  }
  .help-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--color-bg-active);
  }
  .help-header h2 {
    font-size: 1rem;
    color: var(--color-text-bright);
    margin: 0;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.2rem;
    cursor: pointer;
  }
  .close-btn:hover {
    color: var(--color-accent);
  }
  .help-body {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-xl);
    padding: var(--space-xl);
  }
  .help-section h3 {
    font-size: 0.75rem;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 var(--space-md);
  }
  .shortcut {
    font-size: 0.72rem;
    color: var(--color-text-primary);
    padding: var(--space-xs) 0;
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }
  kbd {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-md);
    padding: 1px var(--space-sm);
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--color-success);
    min-width: 24px;
    text-align: center;
  }
  code {
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    padding: 1px var(--space-sm);
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--color-warning);
  }
</style>
