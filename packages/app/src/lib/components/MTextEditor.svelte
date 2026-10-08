<script lang="ts">
  let {
    x,
    y,
    initialContent = '',
    width = 200,
    onSave,
    onCancel,
  }: {
    x: number;
    y: number;
    initialContent?: string;
    width?: number;
    onSave: (content: string) => void;
    onCancel: () => void;
  } = $props();

  let content = $state(initialContent);
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    textareaEl?.focus();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  }

  function handleSave() {
    const trimmed = content.trim();
    if (trimmed) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }
</script>

<div
  class="mtext-editor"
  style="left: {x}px; top: {y}px; width: {width}px;"
  onkeydown={handleKeydown}
  role="dialog"
  tabindex="-1"
>
  <div class="mtext-toolbar">
    <button class="fmt-btn" title="Bold" disabled>B</button>
    <button class="fmt-btn fmt-italic" title="Italic" disabled>I</button>
    <select class="fmt-select" title="Font size" disabled>
      <option>2.5</option>
      <option>5.0</option>
      <option>7.5</option>
      <option>10.0</option>
    </select>
  </div>
  <textarea
    bind:this={textareaEl}
    bind:value={content}
    class="mtext-textarea"
    rows="4"
    placeholder="Enter text..."
  ></textarea>
  <div class="mtext-actions">
    <button class="mtext-btn save" onclick={handleSave}>Save</button>
    <button class="mtext-btn cancel" onclick={onCancel}>Cancel</button>
  </div>
</div>

<style>
  .mtext-editor {
    position: absolute;
    z-index: 100;
    background: var(--color-bg-secondary, #1e1e1e);
    border: 1px solid var(--color-border-menu, #555);
    border-radius: var(--radius-md, 4px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .mtext-toolbar {
    display: flex;
    gap: 4px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--color-border, #444);
    align-items: center;
  }

  .fmt-btn {
    background: var(--color-bg-input, #2a2a2a);
    color: var(--color-text-secondary, #999);
    border: 1px solid var(--color-border, #444);
    border-radius: 2px;
    width: 24px;
    height: 24px;
    font-size: 12px;
    font-weight: bold;
    cursor: not-allowed;
    opacity: 0.5;
  }

  .fmt-italic {
    font-style: italic;
  }

  .fmt-select {
    background: var(--color-bg-input, #2a2a2a);
    color: var(--color-text-secondary, #999);
    border: 1px solid var(--color-border, #444);
    border-radius: 2px;
    height: 24px;
    font-size: 11px;
    cursor: not-allowed;
    opacity: 0.5;
  }

  .mtext-textarea {
    background: var(--color-bg-input, #1a1a1a);
    color: var(--color-text-primary, #e0e0e0);
    border: none;
    padding: 6px 8px;
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    resize: vertical;
    min-height: 60px;
    outline: none;
  }

  .mtext-textarea::placeholder {
    color: var(--color-text-secondary, #666);
  }

  .mtext-actions {
    display: flex;
    gap: 6px;
    padding: 4px 6px;
    border-top: 1px solid var(--color-border, #444);
    justify-content: flex-end;
  }

  .mtext-btn {
    padding: 3px 12px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--color-border, #444);
  }

  .mtext-btn.save {
    background: var(--color-accent-blue, #3b82f6);
    color: white;
    border-color: var(--color-accent-blue, #3b82f6);
  }

  .mtext-btn.save:hover {
    opacity: 0.9;
  }

  .mtext-btn.cancel {
    background: var(--color-bg-input, #2a2a2a);
    color: var(--color-text-secondary, #ccc);
  }

  .mtext-btn.cancel:hover {
    background: var(--color-bg-secondary, #333);
  }
</style>
