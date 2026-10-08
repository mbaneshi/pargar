export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  commandId: string;
}

export interface KeyEvent {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export class KeymapResolver {
  private bindings: KeyBinding[] = [];

  constructor(bindings: KeyBinding[] = []) {
    this.bindings = bindings;
  }

  addBinding(binding: KeyBinding): void {
    this.bindings.push(binding);
  }

  addBindings(bindings: KeyBinding[]): void {
    this.bindings.push(...bindings);
  }

  resolve(event: KeyEvent): string | null {
    const key = event.key.toLowerCase();
    const hasModifier = event.ctrlKey || event.metaKey;

    // Check modifier combos first (more specific)
    for (const b of this.bindings) {
      if (b.key.toLowerCase() !== key) continue;
      const wantCtrl = b.ctrl ?? false;
      const wantShift = b.shift ?? false;
      const wantAlt = b.alt ?? false;
      if (wantCtrl !== hasModifier) continue;
      if (wantShift !== event.shiftKey) continue;
      if (wantAlt !== event.altKey) continue;
      return b.commandId;
    }
    return null;
  }

  getBindingForCommand(commandId: string): KeyBinding | undefined {
    return this.bindings.find((b) => b.commandId === commandId);
  }

  getAllBindings(): KeyBinding[] {
    return [...this.bindings];
  }
}

export function formatBinding(b: KeyBinding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push('Ctrl');
  if (b.shift) parts.push('Shift');
  if (b.alt) parts.push('Alt');
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join('+');
}
