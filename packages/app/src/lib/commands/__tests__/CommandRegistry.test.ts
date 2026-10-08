import { describe, it, expect } from 'vitest';
import { CommandRegistry, type CommandDef } from '../CommandRegistry';

function makeDef(overrides: Partial<CommandDef> & { id: string }): CommandDef {
  return {
    label: overrides.id,
    aliases: [],
    category: 'draw',
    execute: () => ({ success: true, created_ids: [] }),
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  it('registers and retrieves by id', () => {
    const reg = new CommandRegistry();
    const def = makeDef({ id: 'line', aliases: ['l'] });
    reg.register(def);
    expect(reg.get('line')).toBe(def);
  });

  it('retrieves by alias (case-insensitive)', () => {
    const reg = new CommandRegistry();
    const def = makeDef({ id: 'line', aliases: ['l', 'ln'] });
    reg.register(def);
    expect(reg.get('L')).toBe(def);
    expect(reg.get('LN')).toBe(def);
  });

  it('returns undefined for unknown', () => {
    const reg = new CommandRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('resolves with trimming', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'circle', aliases: ['c'] }));
    expect(reg.resolve(' circle ')?.id).toBe('circle');
    expect(reg.resolve('C')?.id).toBe('circle');
  });

  it('resolve returns undefined for unknown', () => {
    const reg = new CommandRegistry();
    expect(reg.resolve('nothing')).toBeUndefined();
  });

  it('getByCategory filters', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'line', category: 'draw' }));
    reg.register(makeDef({ id: 'move', category: 'modify' }));
    reg.register(makeDef({ id: 'circle', category: 'draw' }));
    expect(reg.getByCategory('draw')).toHaveLength(2);
    expect(reg.getByCategory('modify')).toHaveLength(1);
    expect(reg.getByCategory('view')).toHaveLength(0);
  });

  it('getAll returns all', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'line' }));
    reg.register(makeDef({ id: 'circle' }));
    expect(reg.getAll()).toHaveLength(2);
  });

  it('canonicalAlias returns longest', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'line', aliases: ['l', 'ln', 'line'] }));
    expect(reg.canonicalAlias('l')).toBe('line');
  });

  it('canonicalAlias returns input if not found', () => {
    const reg = new CommandRegistry();
    expect(reg.canonicalAlias('unknown')).toBe('unknown');
  });

  it('getShortcutLabel returns shortest uppercased', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'line', aliases: ['l', 'ln', 'line'] }));
    expect(reg.getShortcutLabel('line')).toBe('L');
  });

  it('getShortcutLabel returns empty for unknown', () => {
    const reg = new CommandRegistry();
    expect(reg.getShortcutLabel('nonexistent')).toBe('');
  });

  it('getAllAliases includes ids and aliases', () => {
    const reg = new CommandRegistry();
    reg.register(makeDef({ id: 'line', aliases: ['l', 'ln'] }));
    reg.register(makeDef({ id: 'circle', aliases: ['c'] }));
    const all = reg.getAllAliases();
    expect(all).toContain('line');
    expect(all).toContain('l');
    expect(all).toContain('circle');
    expect(all).toContain('c');
  });
});
