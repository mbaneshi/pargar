<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  interface TextStyle {
    name: string;
    font_family: string;
    height: number;
    width_factor: number;
    oblique_angle: number;
    is_bold: boolean;
    is_italic: boolean;
  }

  let version = $state(0);
  let editingStyle = $state<TextStyle | null>(null);
  let isNew = $state(false);

  let styles = $derived.by(() => {
    void version;
    if (!app.kernel) return [];
    try {
      return JSON.parse(app.kernel.get_text_styles_json()) as TextStyle[];
    } catch {
      return [];
    }
  });

  let currentStyleName = $derived.by(() => {
    void version;
    if (!app.kernel) return 'Standard';
    return app.kernel.get_current_text_style();
  });

  function handleCreate() {
    editingStyle = {
      name: '',
      font_family: 'sans-serif',
      height: 2.5,
      width_factor: 1.0,
      oblique_angle: 0,
      is_bold: false,
      is_italic: false,
    };
    isNew = true;
  }

  function handleEdit(style: TextStyle) {
    editingStyle = { ...style };
    isNew = false;
  }

  function handleSave() {
    if (!editingStyle || !editingStyle.name.trim()) return;
    if (isNew) {
      app.executeCommand({
        type: 'CreateTextStyle',
        name: editingStyle.name.trim(),
        font_family: editingStyle.font_family,
        height: editingStyle.height,
        width_factor: editingStyle.width_factor,
        oblique_angle: editingStyle.oblique_angle,
        is_bold: editingStyle.is_bold,
        is_italic: editingStyle.is_italic,
      });
    } else {
      app.executeCommand({
        type: 'ModifyTextStyle',
        name: editingStyle.name,
        font_family: editingStyle.font_family,
        height: editingStyle.height,
        width_factor: editingStyle.width_factor,
        oblique_angle: editingStyle.oblique_angle,
        is_bold: editingStyle.is_bold,
        is_italic: editingStyle.is_italic,
      });
    }
    editingStyle = null;
    version++;
  }

  function handleDelete(name: string) {
    const result = app.executeCommand({ type: 'DeleteTextStyle', name });
    if (!result.success) {
      app.statusText = result.error ?? 'Cannot delete style';
    }
    version++;
  }

  function handleSetCurrent(name: string) {
    app.executeCommand({ type: 'SetCurrentTextStyle', name });
    version++;
  }
</script>

<aside class="text-style-manager">
  <div class="header">
    <span class="title">Text Styles</span>
    <button class="close-btn" onclick={() => (app.textStyleManagerOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="actions">
    <button class="action-btn" onclick={handleCreate}>+ New Style</button>
  </div>

  {#if editingStyle}
    <div class="edit-form">
      <div class="form-row">
        <label for="ts-name">Name</label>
        <input
          id="ts-name"
          type="text"
          bind:value={editingStyle.name}
          disabled={!isNew}
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-font">Font</label>
        <select id="ts-font" bind:value={editingStyle.font_family} class="form-input">
          <option value="sans-serif">Sans-serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
        </select>
      </div>
      <div class="form-row">
        <label for="ts-height">Height</label>
        <input
          id="ts-height"
          type="number"
          bind:value={editingStyle.height}
          step="0.5"
          min="0.1"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-width">Width Factor</label>
        <input
          id="ts-width"
          type="number"
          bind:value={editingStyle.width_factor}
          step="0.1"
          min="0.1"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-oblique">Oblique Angle</label>
        <input
          id="ts-oblique"
          type="number"
          bind:value={editingStyle.oblique_angle}
          step="5"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label>
          <input type="checkbox" bind:checked={editingStyle.is_bold} />
          Bold
        </label>
        <label>
          <input type="checkbox" bind:checked={editingStyle.is_italic} />
          Italic
        </label>
      </div>
      <div
        class="form-row preview"
        style="font-family: {editingStyle.font_family}; font-weight: {editingStyle.is_bold
          ? 'bold'
          : 'normal'}; font-style: {editingStyle.is_italic
          ? 'italic'
          : 'normal'}; transform: skewX({-editingStyle.oblique_angle}deg) scaleX({editingStyle.width_factor});"
      >
        AaBbCc 123
      </div>
      <div class="form-actions">
        <button class="action-btn" onclick={handleSave}>Save</button>
        <button class="action-btn cancel" onclick={() => (editingStyle = null)}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="style-list">
    <div class="style-header-row">
      <span class="col-active"></span>
      <span class="col-name">Name</span>
      <span class="col-font">Font</span>
      <span class="col-height">Height</span>
      <span class="col-actions"></span>
    </div>

    {#each styles as style (style.name)}
      <div class="style-row" class:active-style={currentStyleName === style.name}>
        <span class="col-active">
          {#if currentStyleName === style.name}
            <span class="active-indicator" title="Current style">&#9654;</span>
          {/if}
        </span>
        <span class="col-name">{style.name}</span>
        <span
          class="col-font"
          style="font-family: {style.font_family}; font-weight: {style.is_bold
            ? 'bold'
            : 'normal'}; font-style: {style.is_italic ? 'italic' : 'normal'};"
        >
          {style.font_family}
        </span>
        <span class="col-height">{style.height}</span>
        <span class="col-actions">
          <button class="icon-btn" onclick={() => handleSetCurrent(style.name)} title="Set current"
            >&#10003;</button
          >
          <button class="icon-btn" onclick={() => handleEdit(style)} title="Edit">&#9998;</button>
          {#if style.name !== 'Standard'}
            <button class="icon-btn" onclick={() => handleDelete(style.name)} title="Delete"
              >&times;</button
            >
          {/if}
        </span>
      </div>
    {/each}
  </div>
</aside>

<style>
  .text-style-manager {
    position: absolute;
    top: 52px;
    right: 0;
    width: 360px;
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
  .actions {
    padding: 6px 12px;
    border-bottom: 1px solid #3c3c3c;
  }
  .action-btn {
    background: #0e639c;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  .action-btn:hover {
    background: #1177bb;
  }
  .action-btn.cancel {
    background: #555;
  }
  .action-btn.cancel:hover {
    background: #666;
  }
  .edit-form {
    padding: 8px 12px;
    border-bottom: 1px solid #3c3c3c;
  }
  .form-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .form-row label {
    min-width: 80px;
    font-size: 11px;
    color: #999;
  }
  .form-input {
    flex: 1;
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    color: #ccc;
    padding: 3px 6px;
    border-radius: 2px;
    font-size: 12px;
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .preview {
    background: #1e1e1e;
    padding: 8px;
    color: #fff;
    font-size: 16px;
    text-align: center;
    border-radius: 3px;
    margin-top: 4px;
  }
  .style-list {
    overflow-y: auto;
    flex: 1;
  }
  .style-header-row,
  .style-row {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    gap: 4px;
  }
  .style-header-row {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    border-bottom: 1px solid #3c3c3c;
  }
  .style-row {
    border-bottom: 1px solid #2d2d2d;
    cursor: default;
  }
  .style-row:hover {
    background: #2a2d2e;
  }
  .active-style {
    background: #094771;
  }
  .col-active {
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }
  .active-indicator {
    color: #569cd6;
    font-size: 10px;
  }
  .col-name {
    flex: 1;
    min-width: 60px;
  }
  .col-font {
    flex: 1;
    min-width: 60px;
    color: #999;
  }
  .col-height {
    width: 50px;
    text-align: right;
    color: #999;
  }
  .col-actions {
    width: 70px;
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
  .icon-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 2px;
  }
  .icon-btn:hover {
    color: #fff;
    background: #3c3c3c;
  }
</style>
