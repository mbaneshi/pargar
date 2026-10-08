/**
 * Chat store — holds messages + loading state.
 * No logic. No AI calls. Just data.
 */

export type MessageRole = 'user' | 'assistant' | 'tool_call' | 'tool_result';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolSuccess?: boolean;
  timestamp: number;
}

export class ChatStore {
  messages = $state<ChatMessage[]>([]);
  isRunning = $state(false);
  error = $state<string | null>(null);

  addUser(content: string) {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
  }

  addAssistant(content: string) {
    this.messages.push({ role: 'assistant', content, timestamp: Date.now() });
  }

  addToolCall(name: string, args: Record<string, unknown>) {
    this.messages.push({
      role: 'tool_call',
      content: `${name}(${JSON.stringify(args)})`,
      toolName: name,
      toolArgs: args,
      timestamp: Date.now(),
    });
  }

  addToolResult(success: boolean, message: string) {
    this.messages.push({
      role: 'tool_result',
      content: message,
      toolSuccess: success,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.messages = [];
    this.error = null;
  }
}
