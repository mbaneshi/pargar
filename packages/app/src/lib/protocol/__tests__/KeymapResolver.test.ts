import { describe, it, expect } from 'vitest';
import { KeymapResolver } from '../KeymapResolver';
import { DEFAULT_KEYMAP } from '../default-keymap';

describe('KeymapResolver', () => {
  it('should resolve Ctrl+Z to undo', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'z',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBe('undo');
  });

  it('should resolve Ctrl+Shift+Z to redo', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBe('redo');
  });

  it('should resolve F8 to toggle-ortho', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'F8',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBe('toggle-ortho');
  });

  it('should resolve Escape to cancel', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'Escape',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBe('cancel');
  });

  it('should return null for unknown key', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'q',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBeNull();
  });

  it('should treat metaKey same as ctrlKey', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 'z',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: true,
    });
    expect(result).toBe('undo');
  });

  it('should not match Ctrl+S without Ctrl pressed', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const result = resolver.resolve({
      key: 's',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBeNull();
  });

  it('should find binding for command', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    const binding = resolver.getBindingForCommand('undo');
    expect(binding).toBeDefined();
    expect(binding!.key).toBe('z');
    expect(binding!.ctrl).toBe(true);
  });

  it('should support adding custom bindings', () => {
    const resolver = new KeymapResolver(DEFAULT_KEYMAP);
    resolver.addBinding({ key: 'p', commandId: 'tool:polyline' });
    const result = resolver.resolve({
      key: 'p',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(result).toBe('tool:polyline');
  });
});
