<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';

  const app = getContext<AppState>('app');

  interface DimStyle {
    name: string;
    dimscale: number;
    dimtxt: number;
    dimasz: number;
    dimexo: number;
    dimexe: number;
    dimgap: number;
    dimtad: number;
    dimclrt?: string | null;
    dimclrd?: string | null;
    dimclre?: string | null;
    dimtxsty: string;
  }

  let version = $state(0);
  let editingStyle = $state<DimStyle | null>(null);
  let isNew = $state(false);

  let styles = $derived.by(() => {
    void version;
    if (!app.kernel) return [];
    try {
      return JSON.parse(app.kernel.get_dim_styles_json()) as DimStyle[];
    } catch {
      return [];
    }
  });

  let currentStyleName = $derived.by(() => {
    void version;
    if (!app.kernel) return 'Standard';
    return app.kernel.get_current_dim_style();
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
      dimscale: 1.0,
      dimtxt: 2.5,
      dimasz: 2.5,
      dimexo: 0.625,
      dimexe: 1.25,
      dimgap: 0.625,
      dimtad: 1,
      dimclrt: null,
      dimclrd: null,
      dimclre: null,
      dimtxsty: 'Standard',
    };
    isNew = true;
  }

  function handleEdit(style: DimStyle) {
    editingStyle = { ...style };
    isNew = false;
  }

  function handleSave() {
    if (!editingStyle || !editingStyle.name.trim()) return;
    const cmd = {
      type: isNew ? 'CreateDimStyle' : 'ModifyDimStyle',
      name: editingStyle.name.trim(),
      dimscale: editingStyle.dimscale,
      dimtxt: editingStyle.dimtxt,
      dimasz: editingStyle.dimasz,
      dimexo: editingStyle.dimexo,
      dimexe: editingStyle.dimexe,
      dimgap: editingStyle.dimgap,
      dimtad: editingStyle.dimtad,
      dimclrt: editingStyle.dimclrt || null,
      dimclrd: editingStyle.dimclrd || null,
      dimclre: editingStyle.dimclre || null,
      dimtxsty: editingStyle.dimtxsty,
    };
    const result = app.executeCommand(cmd);
    if (!result.success) {
      app.statusText = result.error ?? 'Failed to save dim style';
      return;
    }
    editingStyle = null;
    version++;
  }

  function handleDelete(name: string) {
    const result = app.executeCommand({ type: 'DeleteDimStyle', name });
    if (!result.success) {
      app.statusText = result.error ?? 'Cannot delete style';
    }
    version++;
  }

  function handleSetCurrent(name: string) {
    app.executeCommand({ type: 'SetCurrentDimStyle', name });
    version++;
  }
</script>

<aside class="dim-style-manager">
  <div class="header">
    <span class="title">Dimension Styles</span>
    <button class="close-btn" onclick={() => (app.dimStyleManagerOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="actions">
    <button class="action-btn" onclick={handleCreate}>+ New Style</button>
  </div>

  {#if editingStyle}
    <div class="edit-form">
      <div class="form-row">
        <label for="ds-name">Name</label>
        <input
          id="ds-name"
          type="text"
          bind:value={editingStyle.name}
          disabled={!isNew}
          class="form-input"
        />
      </div>

      <div class="form-section">Scale & Text</div>
      <div class="form-row">
        <label for="ds-dimscale" title="DIMSCALE">Overall scale</label>
        <input
          id="ds-dimscale"
          type="number"
          bind:value={editingStyle.dimscale}
          step="0.1"
          min="0.001"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimtxt" title="DIMTXT">Text height</label>
        <input
          id="ds-dimtxt"
          type="number"
          bind:value={editingStyle.dimtxt}
          step="0.5"
          min="0.001"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimtxsty" title="DIMTXSTY">Text style</label>
        <select id="ds-dimtxsty" bind:value={editingStyle.dimtxsty} class="form-input">
          {#each textStyleNames as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </div>
      <div class="form-row">
        <label for="ds-dimtad" title="DIMTAD">Text vertical</label>
        <select id="ds-dimtad" bind:value={editingStyle.dimtad} class="form-input">
          <option value={0}>Centered</option>
          <option value={1}>Above dim line</option>
          <option value={2}>Below dim line</option>
        </select>
      </div>
      <div class="form-row">
        <label for="ds-dimgap" title="DIMGAP">Text gap</label>
        <input
          id="ds-dimgap"
          type="number"
          bind:value={editingStyle.dimgap}
          step="0.1"
          min="0"
          class="form-input"
        />
      </div>

      <div class="form-section">Arrows & Extension Lines</div>
      <div class="form-row">
        <label for="ds-dimasz" title="DIMASZ">Arrow size</label>
        <input
          id="ds-dimasz"
          type="number"
          bind:value={editingStyle.dimasz}
          step="0.5"
          min="0"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimexo" title="DIMEXO">Ext offset</label>
        <input
          id="ds-dimexo"
          type="number"
          bind:value={editingStyle.dimexo}
          step="0.1"
          min="0"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimexe" title="DIMEXE">Ext above dim</label>
        <input
          id="ds-dimexe"
          type="number"
          bind:value={editingStyle.dimexe}
          step="0.1"
          min="0"
          class="form-input"
        />
      </div>

      <div class="form-section">Colors (blank = ByBlock)</div>
      <div class="form-row">
        <label for="ds-dimclrt" title="DIMCLRT">Text color</label>
        <input
          id="ds-dimclrt"
          type="text"
          bind:value={editingStyle.dimclrt}
          placeholder="#rrggbb"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimclrd" title="DIMCLRD">Dim line color</label>
        <input
          id="ds-dimclrd"
          type="text"
          bind:value={editingStyle.dimclrd}
          placeholder="#rrggbb"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label for="ds-dimclre" title="DIMCLRE">Ext line color</label>
        <input
          id="ds-dimclre"
          type="text"
          bind:value={editingStyle.dimclre}
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
      <span class="col-scale">Scale</span>
      <span class="col-txt">Text</span>
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
        <span class="col-scale">{style.dimscale}</span>
        <span class="col-txt">{style.dimtxt}</span>
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
  .dim-style-manager {
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
  .col-scale {
    width: 50px;
    text-align: right;
    color: #999;
  }
  .col-txt {
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
