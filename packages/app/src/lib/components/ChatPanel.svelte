<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import { ChatStore } from '$lib/stores/chat.svelte';
  import { runAgentLoop } from '$lib/ai/agent-loop';

  const app = getContext<AppState>('app');
  const chat = new ChatStore();

  let inputText = $state('');
  let messagesDiv: HTMLDivElement;

  function handleSubmit(e: Event) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || chat.isRunning) return;
    inputText = '';
    runAgentLoop(text, app, chat);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  // Auto-scroll on new messages
  $effect(() => {
    if (chat.messages.length && messagesDiv) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });
</script>

<div class="chat-panel">
  <div class="chat-header">
    <span>AI Assistant</span>
    <span class="model-tag">gemma4</span>
    {#if chat.messages.length > 0}
      <button class="clear-btn" onclick={() => chat.clear()}>Clear</button>
    {/if}
  </div>

  <div class="chat-messages" bind:this={messagesDiv}>
    {#if chat.messages.length === 0}
      <div class="empty-state">Ask me to draw, modify, or explain geometry.</div>
    {/if}

    {#each chat.messages as msg, i (i)}
      <div class="msg msg-{msg.role}">
        {#if msg.role === 'user'}
          <div class="msg-label">You</div>
          <div class="msg-content">{msg.content}</div>
        {:else if msg.role === 'assistant'}
          <div class="msg-label">AI</div>
          <div class="msg-content">{msg.content}</div>
        {:else if msg.role === 'tool_call'}
          <div class="msg-tool">
            <span class="tool-icon">⚡</span>
            <code>{msg.content}</code>
          </div>
        {:else if msg.role === 'tool_result'}
          <div
            class="msg-tool-result"
            class:success={msg.toolSuccess}
            class:fail={!msg.toolSuccess}
          >
            <span>{msg.toolSuccess ? '✓' : '✗'}</span>
            <span>{msg.content}</span>
          </div>
        {/if}
      </div>
    {/each}

    {#if chat.isRunning}
      <div class="msg msg-assistant">
        <div class="msg-label">AI</div>
        <div class="msg-content thinking">Thinking...</div>
      </div>
    {/if}
  </div>

  <form class="chat-input" onsubmit={handleSubmit}>
    <input
      type="text"
      bind:value={inputText}
      placeholder={chat.isRunning ? 'Waiting...' : 'Ask the AI...'}
      disabled={chat.isRunning}
      onkeydown={handleKeydown}
    />
    <button type="submit" disabled={chat.isRunning || !inputText.trim()}>Send</button>
  </form>
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a1a;
    border-left: 1px solid #333;
    font-size: 13px;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid #333;
    font-weight: 600;
    color: #e0e0e0;
  }

  .model-tag {
    font-size: 11px;
    padding: 1px 6px;
    background: #2a4a2a;
    color: #6f6;
    border-radius: 3px;
    font-weight: 400;
  }

  .clear-btn {
    margin-left: auto;
    font-size: 11px;
    padding: 2px 8px;
    background: none;
    border: 1px solid #444;
    color: #888;
    border-radius: 3px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: #ccc;
    border-color: #666;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-state {
    color: #666;
    text-align: center;
    padding: 40px 20px;
    font-style: italic;
  }

  .msg {
    margin-bottom: 8px;
  }

  .msg-label {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .msg-user .msg-label {
    color: #8af;
  }
  .msg-assistant .msg-label {
    color: #6f6;
  }

  .msg-content {
    color: #ddd;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .thinking {
    color: #888;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .msg-tool {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    background: #1e2a3a;
    border-radius: 3px;
    font-size: 12px;
  }
  .msg-tool code {
    color: #8cf;
    font-size: 11px;
  }
  .tool-icon {
    font-size: 10px;
  }

  .msg-tool-result {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    font-size: 12px;
    margin-left: 16px;
  }
  .msg-tool-result.success {
    color: #6d6;
  }
  .msg-tool-result.fail {
    color: #f66;
  }

  .chat-input {
    display: flex;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid #333;
  }

  .chat-input input {
    flex: 1;
    padding: 6px 10px;
    background: #252525;
    border: 1px solid #444;
    border-radius: 4px;
    color: #ddd;
    font-size: 13px;
    outline: none;
  }
  .chat-input input:focus {
    border-color: #666;
  }
  .chat-input input:disabled {
    opacity: 0.5;
  }

  .chat-input button {
    padding: 6px 14px;
    background: #2a5a2a;
    border: none;
    border-radius: 4px;
    color: #ccc;
    cursor: pointer;
    font-size: 13px;
  }
  .chat-input button:hover:not(:disabled) {
    background: #3a7a3a;
  }
  .chat-input button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
