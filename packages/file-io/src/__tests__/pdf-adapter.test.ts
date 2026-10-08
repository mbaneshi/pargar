import { describe, it, expect } from 'vitest';
import { pdfAdapter } from '../pdf-adapter.js';

describe('pdfAdapter', () => {
  it('has correct metadata', () => {
    expect(pdfAdapter.id).toBe('pdf');
    expect(pdfAdapter.extensions).toEqual(['pdf']);
    expect(pdfAdapter.mimeType).toBe('application/pdf');
    expect(pdfAdapter.capabilities.import).toBe(false);
    expect(pdfAdapter.capabilities.export).toBe(true);
  });

  it('does not have an import method', () => {
    expect(pdfAdapter.import).toBeUndefined();
  });

  it('exports entities to Uint8Array', () => {
    const entities = [
      {
        id: '1',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } } },
        layer_id: '0',
      },
    ];
    const layers = [{ id: '0', name: '0', color: '#ffffff' }];
    const result = pdfAdapter.export!(entities, layers);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
