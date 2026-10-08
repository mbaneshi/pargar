<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  interface DwgProps {
    title: string;
    subject: string;
    author: string;
    keywords: string;
    comments: string;
    hyperlink_base: string;
    last_saved_by: string;
  }

  function loadProps(): DwgProps {
    const empty: DwgProps = {
      title: '',
      subject: '',
      author: '',
      keywords: '',
      comments: '',
      hyperlink_base: '',
      last_saved_by: '',
    };
    if (!app.kernel) return empty;
    try {
      return { ...empty, ...JSON.parse(app.kernel.get_dwg_props_json()) };
    } catch {
      return empty;
    }
  }

  let props = $state<DwgProps>(loadProps());

  function handleSave() {
    const cmd = {
      type: 'SetDwgProps',
      title: props.title,
      subject: props.subject,
      author: props.author,
      keywords: props.keywords,
      comments: props.comments,
      hyperlink_base: props.hyperlink_base,
      last_saved_by: props.last_saved_by,
    };
    const result = app.executeCommand(cmd);
    if (!result.success) {
      app.statusText = result.error ?? 'Failed to save drawing properties';
      return;
    }
    app.statusText = 'Drawing properties saved';
    app.drawingPropertiesOpen = false;
  }

  function handleCancel() {
    app.drawingPropertiesOpen = false;
  }
</script>

<aside class="dwg-props-dialog">
  <div class="header">
    <span class="title">Drawing Properties</span>
    <button class="close-btn" onclick={() => (app.drawingPropertiesOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="form">
    <div class="form-row">
      <label for="dp-title">Title</label>
      <input id="dp-title" type="text" bind:value={props.title} class="form-input" />
    </div>
    <div class="form-row">
      <label for="dp-subject">Subject</label>
      <input id="dp-subject" type="text" bind:value={props.subject} class="form-input" />
    </div>
    <div class="form-row">
      <label for="dp-author">Author</label>
      <input id="dp-author" type="text" bind:value={props.author} class="form-input" />
    </div>
    <div class="form-row">
      <label for="dp-keywords">Keywords</label>
      <input
        id="dp-keywords"
        type="text"
        bind:value={props.keywords}
        placeholder="comma-separated"
        class="form-input"
      />
    </div>
    <div class="form-row">
      <label for="dp-comments">Comments</label>
      <textarea
        id="dp-comments"
        bind:value={props.comments}
        rows="4"
        class="form-input form-textarea"
      ></textarea>
    </div>
    <div class="form-row">
      <label for="dp-hyperlink">Hyperlink base</label>
      <input
        id="dp-hyperlink"
        type="text"
        bind:value={props.hyperlink_base}
        placeholder="https:// or path/"
        class="form-input"
      />
    </div>
    <div class="form-row">
      <label for="dp-saved-by">Last saved by</label>
      <input id="dp-saved-by" type="text" bind:value={props.last_saved_by} class="form-input" />
    </div>

    <div class="form-actions">
      <button class="action-btn primary" onclick={handleSave}>Save</button>
      <button class="action-btn cancel" onclick={handleCancel}>Cancel</button>
    </div>
  </div>
</aside>

<style>
  .dwg-props-dialog {
    position: absolute;
    top: 52px;
    right: 0;
    width: 420px;
    background: #252526;
    border-left: 1px solid #3c3c3c;
    color: #cccccc;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 52px - 28px);
    z-index: 20;
    font-size: 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #3c3c3c;
  }
  .title {
    font-weight: 600;
    font-size: 13px;
  }
  .close-btn {
    background: none;
    border: none;
    color: #ccc;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }
  .close-btn:hover {
    color: #fff;
  }
  .form {
    padding: 12px;
    overflow-y: auto;
    flex: 1;
  }
  .form-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .form-row label {
    min-width: 120px;
    font-size: 11px;
    color: #999;
    padding-top: 4px;
  }
  .form-input {
    flex: 1;
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    color: #ccc;
    padding: 4px 6px;
    border-radius: 2px;
    font-size: 12px;
    font-family: inherit;
  }
  .form-textarea {
    resize: vertical;
    min-height: 60px;
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
  }
  .action-btn {
    padding: 5px 14px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  .action-btn.primary {
    background: #0e639c;
    color: white;
  }
  .action-btn.primary:hover {
    background: #1177bb;
  }
  .action-btn.cancel {
    background: #555;
    color: #ddd;
  }
  .action-btn.cancel:hover {
    background: #666;
  }
</style>
