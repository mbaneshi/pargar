import type { EventMap } from './EventTypes';

type Handler<T> = (event: T) => void;

export class EventBus {
  private handlers: Map<string, Set<Handler<any>>> = new Map();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  clear(): void {
    this.handlers.clear();
  }
}
