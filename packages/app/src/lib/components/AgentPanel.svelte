<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { CommandExecutedEvent } from '$lib/protocol/EventTypes';

  const app = getContext<AppState>('app');

  type FilterMode = 'all' | 'human' | 'agent';

  let entries = $state<CommandExecutedEvent[]>([]);
  let filter = $state<FilterMode>('all');
  let logEl: HTMLDivElement | undefined = $state(undefined);

  const filtered = $derived(
    filter === 'all' ? entries : entries.filter((e) => e.source.type === filter),
  );

  function addEntry(event: CommandExecutedEvent) {
    if (entries.length >= 100) {
      entries = [...entries.slice(1), event];
    } else {
      entries = [...entries, event];
    }
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function sourceBadge(source: CommandExecutedEvent['source']): string {
    return source.type.toUpperCase();
  }

  $effect(() => {
    if (filtered && logEl) {
      requestAnimationFrame(() => {
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
      });
    }
  });

  onMount(() => {
    const unsub = app.bus.on('command.executed', addEntry);
    return unsub;
  });
</script>

<aside class="agent-panel" data-testid="agent-panel">
  <div class="panel-header">
    <span class="panel-title">Agent Log</span>
    <div class="filter-group">
      <button class:active={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
      <button class:active={filter === 'human'} onclick={() => (filter = 'human')}>Human</button>
      <button class:active={filter === 'agent'} onclick={() => (filter = 'agent')}>Agent</button>
    </div>
    <button class="close-btn" onclick={() => (app.agentPanelOpen = false)} title="Close"
      >&times;</button
    >
  </div>
  <div class="log-entries" bind:this={logEl}>
    {#if filtered.length === 0}
      <div class="empty">No commands recorded</div>
    {:else}
      {#each filtered as entry (entry.timestamp + entry.commandId)}
        <div class="entry" class:fail={!entry.result.success}>
          <span class="time">{formatTime(entry.timestamp)}</span>
          <span class="badge badge-{entry.source.type}">{sourceBadge(entry.source)}</span>
          <span class="label">{entry.label || entry.commandId}</span>
          <span class="result">{entry.result.success ? 'OK' : 'FAIL'}</span>
        </div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .agent-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    z-index: var(--z-crosshair);
    font-size: var(--font-size-sm);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .panel-title {
    font-weight: 600;
    color: var(--color-text-heading);
    margin-right: auto;
  }

  .filter-group {
    display: flex;
    gap: var(--space-xs);
  }

  .filter-group button {
    background: none;
    border: 1px solid transparent;
    color: var(--color-text-dim);
    font-size: var(--font-size-xs);
    padding: 1px 5px;
    cursor: pointer;
    font-family: inherit;
    border-radius: var(--radius-sm);
  }

  .filter-group button.active {
    color: var(--color-text-accent);
    border-color: var(--color-text-accent);
  }

  .filter-group button:hover {
    color: var(--color-text-secondary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-dim);
    font-size: var(--font-size-lg);
    cursor: pointer;
    padding: 0 var(--space-sm);
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .log-entries {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm) var(--space-md);
  }

  .empty {
    color: var(--color-text-dim);
    text-align: center;
    padding: var(--space-xl);
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xs) 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .entry.fail {
    color: var(--color-danger);
  }

  .time {
    font-family: var(--font-mono);
    color: var(--color-text-dim);
    flex-shrink: 0;
    font-size: var(--font-size-xs);
  }

  .badge {
    font-size: var(--font-size-2xs);
    padding: 0 var(--space-sm);
    border-radius: var(--radius-sm);
    font-weight: 600;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .badge-human {
    background: var(--color-accent-blue);
    color: var(--color-text-bright);
  }

  .badge-agent {
    background: var(--color-warning);
    color: #1e1e1e;
  }

  .badge-system {
    background: var(--color-text-dim);
    color: var(--color-text-bright);
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .result {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    flex-shrink: 0;
  }

  .entry:not(.fail) .result {
    color: var(--color-success);
  }
</style>
