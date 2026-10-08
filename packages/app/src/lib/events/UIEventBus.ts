export type UIChannel =
  | 'entities:created'
  | 'entities:modified'
  | 'entities:deleted'
  | 'layers:changed'
  | 'constraints:changed'
  | 'textstyles:changed'
  | 'selection:changed'
  | 'viewport:changed'
  | 'units:changed';

export type UIChannelListener = () => void;

export class UIEventBus {
  private listeners = new Map<UIChannel, Set<UIChannelListener>>();

  on(channel: UIChannel, listener: UIChannelListener): () => void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(channel);
    };
  }

  emit(channel: UIChannel): void {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      fn();
    }
  }

  emitMany(channels: UIChannel[]): void {
    const seen = new Set<UIChannel>();
    for (const ch of channels) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      this.emit(ch);
    }
  }

  listenerCount(channel: UIChannel): number {
    return this.listeners.get(channel)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
