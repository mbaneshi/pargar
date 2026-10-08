/**
 * Agent Loop — runs the tool-calling loop client-side.
 *
 * Why client-side: The kernel lives in the browser. Tool execution
 * needs the kernel. Running the loop here avoids round-tripping
 * tool calls between server and client.
 *
 * Ollama runs locally, so CORS isn't an issue in dev.
 */

import type { AppState } from '$lib/stores/AppState.svelte';
import type { ChatStore } from '$lib/stores/chat.svelte';
import { executeTool } from './tool-executor';
import { buildContext } from './context-builder';
import { buildSystemPrompt } from './system-prompt';
import { TOOL_SCHEMAS } from './tool-schemas';

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434/api/chat';
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'gemma4';
const MAX_STEPS = 5;

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

export async function runAgentLoop(
  userMessage: string,
  app: AppState,
  chat: ChatStore,
): Promise<void> {
  if (chat.isRunning) return;
  chat.isRunning = true;
  chat.error = null;

  try {
    chat.addUser(userMessage);

    // Build fresh context from current drawing state
    const ctx = buildContext(app);
    const systemPrompt = buildSystemPrompt(ctx);

    // Build message history (only user/assistant, not tool_call/tool_result display messages)
    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await callOllama(ollamaMessages);
      const msg = response.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        ollamaMessages.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.tool_calls,
        });

        // Execute each tool call
        for (const tc of msg.tool_calls) {
          const { name, arguments: args } = tc.function;

          // Display in chat
          chat.addToolCall(name, args);

          // Execute against kernel
          const result = executeTool(app, { name, arguments: args });

          // Display result
          chat.addToolResult(result.success, result.message);

          // Feed back to model
          ollamaMessages.push({
            role: 'tool',
            content: JSON.stringify(result),
          });

          // Log for debugging
          console.log(
            `[agent] ${name}(${JSON.stringify(args)}) → ${result.success ? 'OK' : 'FAIL'}: ${result.message}`,
          );
        }

        continue;
      }

      // Text response — done
      const text = msg.content || '';
      if (text) {
        chat.addAssistant(text);
      }
      console.log(`[agent] done in ${step + 1} step(s)`);
      return;
    }

    // Hit max steps
    chat.addAssistant(
      'I reached the maximum number of steps. Try a simpler request or break it into parts.',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    chat.error = message;
    chat.addAssistant(`Error: ${message}`);
    console.error('[agent] loop error:', err);
  } finally {
    chat.isRunning = false;
  }
}

async function callOllama(messages: OllamaMessage[]): Promise<{
  message: OllamaMessage;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOL_SCHEMAS,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama ${res.status}: ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
