import type { KeyBinding } from './KeymapResolver';

export const DEFAULT_KEYMAP: KeyBinding[] = [
  // Modifier combos (Ctrl/Cmd + key)
  { key: 'z', ctrl: true, commandId: 'undo' },
  { key: 'z', ctrl: true, shift: true, commandId: 'redo' },
  { key: 'y', ctrl: true, commandId: 'redo' },
  { key: 'a', ctrl: true, commandId: 'select-all' },
  { key: 'x', ctrl: true, commandId: 'cut' },
  { key: 'c', ctrl: true, commandId: 'copy' },
  { key: 'v', ctrl: true, commandId: 'paste' },
  { key: 'n', ctrl: true, commandId: 'new-project' },
  { key: 'o', ctrl: true, commandId: 'open-file' },
  { key: 's', ctrl: true, commandId: 'save' },
  { key: 's', ctrl: true, shift: true, commandId: 'save-as' },
  { key: 'l', ctrl: true, commandId: 'toggle-layer-manager' },

  // Function keys
  { key: 'F2', commandId: 'toggle-dynamic-input' },
  { key: 'F3', commandId: 'toggle-snap' },
  { key: 'F7', commandId: 'toggle-grid' },
  { key: 'F8', commandId: 'toggle-ortho' },
  { key: 'F9', commandId: 'toggle-grid-snap' },
  { key: 'F10', commandId: 'toggle-polar' },
  { key: 'F11', commandId: 'toggle-otrack' },
  { key: 'F12', commandId: 'toggle-dynamic-input' },

  // Navigation
  { key: 'Home', commandId: 'zoom-extents' },
  { key: '+', commandId: 'zoom-in' },
  { key: '=', commandId: 'zoom-in' },
  { key: '-', commandId: 'zoom-out' },

  // Edit
  { key: 'Delete', commandId: 'delete-selected' },
  { key: 'Backspace', commandId: 'delete-selected' },
  { key: 'Escape', commandId: 'cancel' },

  // Repeat
  { key: ' ', commandId: 'repeat-last-command' },
];
