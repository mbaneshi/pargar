<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  interface TableStyle {
    name: string;
    text_style_name: string;
    data_text_height: number;
    header_text_height: number;
    title_text_height: number;
    has_title: boolean;
    has_header: boolean;
    cell_margin: number;
    border_color?: string | null;
    title_fill_color?: string | null;
    header_fill_color?: string | null;
  }

  let version = $state(0);
  let editingStyle = $state<TableStyle | null>(null);
  let isNew = $state(false);

  let styles = $derived.by(() => {
    void version;
    if (!app.kernel) return [];
    try {
      return JSON.parse(app.kernel.get_table_styles_json()) as TableStyle[];
    } catch {
      return [];
    }
  });

  let currentStyleName = $derived.by(() => {
    void version;
    if (!app.kernel) return 'Standard';
    return app.kernel.get_current_table_style();
  });

  let textStyleNames = $derived.by(() => {
    void version;
    if (!app.kernel) return ['Standard'];
    try {
      const ts = JSON.parse(app.kernel.get_text_styles_json()) as Array<{ name: string }>;
      return ts.map((s) => s.name);
    } catch {
      return ['Standard'];
    }
  });

  function handleCreate() {
    editingStyle = {
      name: '',
      text_style_name: 'Standard',
      data_text_height: 2.5,
      header_text_height: 4.0,
      title_text_height: 6.0,
      has_title: true,
      has_header: true,
      cell_margin: 0.5,
      border_color: null,
      title_fill_color: null,
      header_fill_color: null,
    };
    isNew = true;
  }

  function handleEdit(style: TableStyle) {
    editingStyle = { ...style };
    isNew = false;
  }

  function handleSave() {
    if (!editingStyle || !editingStyle.name.trim()) return;
    const cmd = {
      type: isNew ? 'CreateTableStyle' : 'ModifyTableStyle',
      name: editingStyle.name.trim(),
      text_style_name: editingStyle.text_style_name,
      data_text_height: editingStyle.data_text_height,
      header_text_height: editingStyle.header_text_height,
      title_text_height: editingStyle.title_text_height,
      has_title: editingStyle.has_title,
      has_header: editingStyle.has_header,
      cell_margin: editingStyle.cell_margin,
      border_color: editingStyle.border_color || null,
      title_fill_color: editingStyle.title_fill_color || null,
      header_fill_color: editingStyle.header_fill_color || null,
    };
    const result = app.executeCommand(cmd);
    if (!result.success) {
      app.statusText = result.error ?? 'Failed to save table style';
      return;
    }
    editingStyle = null;
    version++;
  }

  function handleDelete(name: string) {
    const result = app.executeCommand({ type: 'DeleteTableStyle', name });
    if (!result.success) {
      app.statusText = result.error ?? 'Cannot delete style';
    }
    version++;
  }

  function handleSetCurrent(name: string) {
    app.executeCommand({ type: 'SetCurrentTableStyle', name });
    version++;
  }
</script>

<aside class="table-style-manager">
  <div class="header">
    <span class="title">Table Styles</span>
    <button class="close-btn" onclick={() => (app.tableStyleManagerOpen = false)} title="Close"
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

      <div class="form-section">Text</div>
      <div class="form-row">
        <label for="ts-tstyle">Text style</label>
        <select id="ts-tstyle" bind:value={editingStyle.text_style_name} class="form-input">
          {#each textStyleNames as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </div>
      <div class="form-row">
        <label for="ts-dataheight">Data text height</label>
        <input
          id="ts-dataheight"
          type="number"
          bind:value={editingStyle.data_text_height}
          step="0.5"
          min="0"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-headerheight">Header text height</label>
        <input
          id="ts-headerheight"
          type="number"
          bind:value={editingStyle.header_text_height}
          step="0.5"
          min="0"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-titleheight">Title text height</label>
        <input
          id="ts-titleheight"
          type="number"
          bind:value={editingStyle.title_text_height}
          step="0.5"
          min="0"
          class="form-input"
        />
      </div>

      <div class="form-section">Structure</div>
      <div class="form-row">
        <label>
          <input type="checkbox" bind:checked={editingStyle.has_title} />
          Has title row
        </label>
      </div>
      <div class="form-row">
        <label>
          <input type="checkbox" bind:checked={editingStyle.has_header} />
          Has header row
        </label>
      </div>
      <div class="form-row">
        <label for="ts-margin">Cell margin</label>
        <input
          id="ts-margin"
          type="number"
          bind:value={editingStyle.cell_margin}
          step="0.1"
          min="0"
          class="form-input"
        />
      </div>

      <div class="form-section">Colors (blank = ByBlock)</div>
      <div class="form-row">
        <label for="ts-border">Border color</label>
        <input
          id="ts-border"
          type="text"
          bind:value={editingStyle.border_color}
          placeholder="#rrggbb"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-titlefill">Title fill</label>
        <input
          id="ts-titlefill"
          type="text"
          bind:value={editingStyle.title_fill_color}
          placeholder="#rrggbb"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ts-headerfill">Header fill</label>
        <input
          id="ts-headerfill"
          type="text"
          bind:value={editingStyle.header_fill_color}
          placeholder="#rrggbb"
          class="form-input"
        />
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
      <span class="col-data">Data</span>
      <span class="col-header">Header</span>
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
        <span class="col-data">{style.data_text_height}</span>
        <span class="col-header">{style.header_text_height}</span>
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
  .table-style-manager {
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
  .edit-form {
    padding: 8px 12px;
    border-bottom: 1px solid #3c3c3c;
    overflow-y: auto;
    max-height: 60%;
  }
  .form-section {
    color: #888;
    font-size: 10px;
    text-transform: uppercase;
    margin-top: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid #2d2d2d;
    padding-bottom: 2px;
  }
  .form-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .form-row label {
    min-width: 100px;
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
  .col-data,
  .col-header {
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
