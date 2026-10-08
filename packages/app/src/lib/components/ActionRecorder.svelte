<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import { actionRecorder } from '$lib/stores/actionRecorderStore.svelte';

  const app = getContext<AppState>('app');

  let status = $derived(
    actionRecorder.isPlaying ? 'Playing...' : actionRecorder.isRecording ? 'Recording...' : 'Ready',
  );

  function handleRecord() {
    actionRecorder.startRecording();
    app.statusText = 'Action Recorder: Recording started';
  }

  function handleStop() {
    actionRecorder.stopRecording();
    app.statusText = `Action Recorder: Stopped (${actionRecorder.recordedActions.length} actions)`;
  }

  function handlePlay() {
    actionRecorder.playback(app);
    app.statusText = 'Action Recorder: Playback complete';
  }
</script>

<aside class="action-recorder">
  <div class="header">
    <span class="title">Action Recorder</span>
    <button class="close-btn" onclick={() => (app.actionRecorderOpen = false)} title="Close"
      >&times;</button
    >
  </div>

  <div class="controls">
    <button
      class="ctrl-btn record"
      onclick={handleRecord}
      disabled={actionRecorder.isRecording || actionRecorder.isPlaying}
      title="Record"
    >
      <svg width="14" height="14" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="currentColor" />
      </svg>
    </button>
    <button
      class="ctrl-btn stop"
      onclick={handleStop}
      disabled={!actionRecorder.isRecording}
      title="Stop"
    >
      <svg width="14" height="14" viewBox="0 0 16 16">
        <rect x="3" y="3" width="10" height="10" fill="currentColor" />
      </svg>
    </button>
    <button
      class="ctrl-btn play"
      onclick={handlePlay}
      disabled={actionRecorder.isRecording ||
        actionRecorder.isPlaying ||
        actionRecorder.recordedActions.length === 0}
      title="Play"
    >
      <svg width="14" height="14" viewBox="0 0 16 16">
        <polygon points="4,2 14,8 4,14" fill="currentColor" />
      </svg>
    </button>
  </div>

  <div class="status-text">{status}</div>

  <div class="action-list">
    {#if actionRecorder.recordedActions.length === 0}
      <div class="empty">No recorded actions</div>
    {:else}
      {#each actionRecorder.recordedActions as action, i (i)}
        <div class="action-item">{action.commandType}</div>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .action-recorder {
    width: 200px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
  }

  .title {
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.3px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0 var(--space-sm);
    line-height: 1;
  }
  .close-btn:hover {
    color: var(--color-accent);
  }

  .controls {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    justify-content: center;
    border-bottom: 1px solid var(--color-border);
  }

  .ctrl-btn {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    color: var(--color-text-primary);
    padding: var(--space-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }
  .ctrl-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }
  .ctrl-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ctrl-btn.record:not(:disabled) {
    color: #e74c3c;
  }
  .ctrl-btn.play:not(:disabled) {
    color: #2ecc71;
  }

  .status-text {
    padding: var(--space-sm) var(--space-md);
    text-align: center;
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  .action-list {
    flex: 1;
    overflow-y: auto;
    max-height: 200px;
  }

  .empty {
    padding: var(--space-md);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.7rem;
  }

  .action-item {
    padding: 2px var(--space-md);
    font-size: 0.68rem;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-light);
    font-family: var(--font-mono, monospace);
  }
</style>
