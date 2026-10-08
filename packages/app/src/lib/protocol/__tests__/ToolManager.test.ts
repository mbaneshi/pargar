import { describe, it, expect } from 'vitest';
import { ToolManager } from '../ToolManager';

const mockCommands = new Map([
  [
    'draw_line',
    {
      id: 'draw_line',
      label: 'Line',
      aliases: ['l', 'line'],
      category: 'draw' as const,
      execute: async () => {},
    },
  ],
  [
    'draw_circle',
    {
      id: 'draw_circle',
      label: 'Circle',
      aliases: ['c', 'circle'],
      category: 'draw' as const,
      execute: async () => {},
    },
  ],
]);

function createManager() {
  return new ToolManager({
    getCommandDef: (id) => mockCommands.get(id),
    resolveAlias: (input) => {
      for (const [, def] of mockCommands) {
        if (def.id === input || def.aliases.includes(input)) return def;
      }
      return undefined;
    },
  });
}

describe('ToolManager', () => {
  it('should set active tool', () => {
    const tm = createManager();
    expect(tm.setTool('line')).toBe(true);
    expect(tm.activeToolId).toBe('line');
  });

  it('should return false for unknown tool', () => {
    const tm = createManager();
    expect(tm.setTool('nonexistent')).toBe(false);
    expect(tm.activeToolId).toBeNull();
  });

  it('should clear tool', () => {
    const tm = createManager();
    tm.setTool('line');
    tm.clearTool();
    expect(tm.activeToolId).toBeNull();
  });

  it('should check if tool is active', () => {
    const tm = createManager();
    tm.setTool('line');
    expect(tm.isToolActive('line')).toBe(true);
    expect(tm.isToolActive('circle')).toBe(false);
  });

  it('should get active command def', () => {
    const tm = createManager();
    tm.setTool('line');
    const def = tm.getActiveDef();
    expect(def?.id).toBe('draw_line');
  });

  it('should work with zero Svelte dependencies', () => {
    const tm = createManager();
    tm.setTool('circle');
    expect(tm.activeToolId).toBe('circle');
    tm.clearTool();
    expect(tm.activeToolId).toBeNull();
  });
});
