import type { InputEvent } from './InputEvent';

export interface InputHandler {
  id: string;
  priority: number;
  handle(event: InputEvent): boolean;
}

export class InputRouter {
  private handlers: InputHandler[] = [];
  private sorted = true;

  register(handler: InputHandler): () => void {
    this.handlers.push(handler);
    this.sorted = false;
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  dispatch(event: InputEvent): boolean {
    if (!this.sorted) {
      this.handlers.sort((a, b) => b.priority - a.priority);
      this.sorted = true;
    }
    for (const handler of this.handlers) {
      if (handler.handle(event)) return true;
    }
    return false;
  }

  has(id: string): boolean {
    return this.handlers.some((h) => h.id === id);
  }

  clear(): void {
    this.handlers.length = 0;
  }
}
