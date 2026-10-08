import { describe, it, expect } from 'vitest';
import { formatRegistry } from '../format-registry.js';

describe('formatRegistry (default instance)', () => {
  it('has dxf, pdf, and svg adapters registered', () => {
    expect(formatRegistry.get('dxf')).toBeDefined();
    expect(formatRegistry.get('pdf')).toBeDefined();
    expect(formatRegistry.get('svg')).toBeDefined();
  });

  it('looks up dxf by extension', () => {
    expect(formatRegistry.getByExtension('.dxf')?.id).toBe('dxf');
  });

  it('lists 3 adapters', () => {
    expect(formatRegistry.list()).toHaveLength(3);
  });

  it('lists dxf as the only importer', () => {
    const importers = formatRegistry.listImporters();
    expect(importers).toHaveLength(1);
    expect(importers[0].id).toBe('dxf');
  });

  it('lists all 3 as exporters', () => {
    expect(formatRegistry.listExporters()).toHaveLength(3);
  });
});
