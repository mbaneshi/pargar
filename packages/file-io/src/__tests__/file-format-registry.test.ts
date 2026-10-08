import { describe, it, expect } from 'vitest';
import { FileFormatRegistry } from '../FileFormatRegistry.js';
import type { FileFormatAdapter } from '@nexus/core';

function makeAdapter(overrides: Partial<FileFormatAdapter> = {}): FileFormatAdapter {
  return {
    id: 'test',
    name: 'Test Format',
    extensions: ['tst'],
    mimeType: 'application/test',
    capabilities: { import: false, export: false },
    ...overrides,
  };
}

describe('FileFormatRegistry', () => {
  it('registers and retrieves an adapter by id', () => {
    const registry = new FileFormatRegistry();
    const adapter = makeAdapter();
    registry.register(adapter);
    expect(registry.get('test')).toBe(adapter);
  });

  it('throws on duplicate registration', () => {
    const registry = new FileFormatRegistry();
    registry.register(makeAdapter());
    expect(() => registry.register(makeAdapter())).toThrow('Adapter already registered: test');
  });

  it('returns undefined for unknown id', () => {
    const registry = new FileFormatRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });

  it('looks up adapter by extension', () => {
    const registry = new FileFormatRegistry();
    const adapter = makeAdapter({ extensions: ['dxf'] });
    registry.register(adapter);
    expect(registry.getByExtension('dxf')).toBe(adapter);
    expect(registry.getByExtension('.dxf')).toBe(adapter);
    expect(registry.getByExtension('.DXF')).toBe(adapter);
  });

  it('returns undefined for unknown extension', () => {
    const registry = new FileFormatRegistry();
    expect(registry.getByExtension('.xyz')).toBeUndefined();
  });

  it('lists all adapters', () => {
    const registry = new FileFormatRegistry();
    registry.register(makeAdapter({ id: 'a' }));
    registry.register(makeAdapter({ id: 'b' }));
    expect(registry.list()).toHaveLength(2);
  });

  it('filters importers and exporters', () => {
    const registry = new FileFormatRegistry();
    registry.register(makeAdapter({ id: 'imp', capabilities: { import: true, export: false } }));
    registry.register(makeAdapter({ id: 'exp', capabilities: { import: false, export: true } }));
    registry.register(makeAdapter({ id: 'both', capabilities: { import: true, export: true } }));

    expect(registry.listImporters().map((a) => a.id)).toEqual(['imp', 'both']);
    expect(registry.listExporters().map((a) => a.id)).toEqual(['exp', 'both']);
  });

  it('unregisters an adapter', () => {
    const registry = new FileFormatRegistry();
    registry.register(makeAdapter());
    expect(registry.unregister('test')).toBe(true);
    expect(registry.get('test')).toBeUndefined();
    expect(registry.unregister('test')).toBe(false);
  });
});
