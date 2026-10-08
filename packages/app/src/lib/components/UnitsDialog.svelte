<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { DrawingUnits, LinearUnit, AngularUnit } from '$lib/types/kernel';

  const app = getContext<AppState>('app');

  let { visible = $bindable(false) } = $props();

  const linearTypes: { value: LinearUnit; label: string }[] = [
    { value: 'Decimal', label: 'Decimal' },
    { value: 'Engineering', label: 'Engineering' },
    { value: 'Architectural', label: 'Architectural' },
    { value: 'Fractional', label: 'Fractional' },
    { value: 'Scientific', label: 'Scientific' },
  ];

  const angularTypes: { value: AngularUnit; label: string }[] = [
    { value: 'DecimalDegrees', label: 'Decimal Degrees' },
    { value: 'DMS', label: 'Deg/Min/Sec' },
    { value: 'Grads', label: 'Grads' },
    { value: 'Radians', label: 'Radians' },
  ];

  const precisionOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  let linearType = $state<LinearUnit>('Decimal');
  let linearPrecision = $state(4);
  let angularType = $state<AngularUnit>('DecimalDegrees');
  let angularPrecision = $state(2);
  let insertionScale = $state(1.0);

  let linearPreview = $derived(app.kernel ? app.kernel.format_linear(123.456789) : '123.4568');
  let angularPreview = $derived(
    app.kernel ? app.kernel.format_angular(Math.PI / 6) : '30.00\u00B0',
  );

  function loadFromKernel() {
    if (!app.kernel) return;
    try {
      const units: DrawingUnits = JSON.parse(app.kernel.get_units_json());
      linearType = units.linear_type;
      linearPrecision = units.linear_precision;
      angularType = units.angular_type;
      angularPrecision = units.angular_precision;
      insertionScale = units.insertion_scale;
    } catch {
      /* use defaults */
    }
  }

  function applyToKernel() {
    if (!app.kernel) return;
    const units: DrawingUnits = {
      linear_type: linearType,
      linear_precision: linearPrecision,
      angular_type: angularType,
      angular_precision: angularPrecision,
      insertion_scale: insertionScale,
    };
    app.kernel.set_units_json(JSON.stringify(units));
  }

  $effect(() => {
    if (visible) {
      loadFromKernel();
    }
  });

  $effect(() => {
    // Live-update kernel for preview when settings change
    if (visible && app.kernel) {
      applyToKernel();
    }
  });

  function handleOk() {
    applyToKernel();
    app.statusText = `Units: ${linearType}, precision ${linearPrecision}`;
    visible = false;
  }

  function handleCancel() {
    loadFromKernel();
    visible = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter') handleOk();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={handleCancel}></div>
    <div class="dialog" role="dialog" aria-label="Drawing Units">
      <div class="dialog-header">Drawing Units</div>

      <div class="dialog-body">
        <fieldset>
          <legend>Linear</legend>
          <div class="field-row">
            <label for="linear-type">Type</label>
            <select id="linear-type" bind:value={linearType}>
              {#each linearTypes as lt (lt.value)}
                <option value={lt.value}>{lt.label}</option>
              {/each}
            </select>
          </div>
          <div class="field-row">
            <label for="linear-prec">Precision</label>
            <select id="linear-prec" bind:value={linearPrecision}>
              {#each precisionOptions as p (p)}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </div>
          <div class="preview">
            <span class="preview-label">Preview:</span>
            <span class="preview-value">{linearPreview}</span>
          </div>
        </fieldset>

        <fieldset>
          <legend>Angular</legend>
          <div class="field-row">
            <label for="angular-type">Type</label>
            <select id="angular-type" bind:value={angularType}>
              {#each angularTypes as at (at.value)}
                <option value={at.value}>{at.label}</option>
              {/each}
            </select>
          </div>
          <div class="field-row">
            <label for="angular-prec">Precision</label>
            <select id="angular-prec" bind:value={angularPrecision}>
              {#each precisionOptions as p (p)}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </div>
          <div class="preview">
            <span class="preview-label">Preview:</span>
            <span class="preview-value">{angularPreview}</span>
          </div>
        </fieldset>

        <fieldset>
          <legend>Insertion Scale</legend>
          <div class="field-row">
            <label for="ins-scale">Scale factor</label>
            <input
              id="ins-scale"
              type="number"
              step="0.01"
              min="0.001"
              bind:value={insertionScale}
            />
          </div>
        </fieldset>
      </div>

      <div class="dialog-footer">
        <button class="btn-cancel" onclick={handleCancel}>Cancel</button>
        <button class="btn-ok" onclick={handleOk}>OK</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .dialog {
    position: relative;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    width: 360px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .dialog-header {
    padding: var(--space-md) var(--space-lg);
    font-weight: 600;
    font-size: var(--font-size-lg, 14px);
    color: var(--color-text-heading);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;
  }

  .dialog-body {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  fieldset {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 4px);
    padding: var(--space-md);
    margin: 0;
  }

  legend {
    padding: 0 var(--space-sm);
    font-weight: 600;
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-secondary);
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .field-row label {
    width: 80px;
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-secondary);
    text-align: right;
    flex-shrink: 0;
  }

  .field-row select,
  .field-row input {
    flex: 1;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: var(--space-xs) var(--space-sm);
    font-family: inherit;
    font-size: var(--font-size-md, 13px);
    border-radius: var(--radius-sm, 4px);
  }

  .field-row select:hover,
  .field-row input:hover {
    background: var(--color-bg-hover, var(--color-bg-input));
  }

  .field-row input:focus,
  .field-row select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .preview {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
    padding: var(--space-xs) 0;
  }

  .preview-label {
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-muted);
    width: 80px;
    text-align: right;
    flex-shrink: 0;
    padding-right: var(--space-md);
  }

  .preview-value {
    font-family: var(--font-mono);
    font-size: var(--font-size-md, 13px);
    color: var(--color-computed, var(--color-accent));
    font-style: italic;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
  }

  .dialog-footer button {
    padding: var(--space-xs) var(--space-lg);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-sm, 12px);
    font-family: inherit;
    cursor: pointer;
    border: 1px solid var(--color-border);
  }

  .btn-cancel {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .btn-cancel:hover {
    background: var(--color-bg-hover, var(--color-bg-input));
  }

  .btn-ok {
    background: var(--color-accent);
    color: #000;
    border-color: var(--color-accent);
    font-weight: 600;
  }

  .btn-ok:hover {
    opacity: 0.9;
  }
</style>
