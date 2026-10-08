import { describe, it, expect } from 'vitest';
import { serializeSysvarsToHeaderLines, parseSysvarsFromDxf } from '../dxf-sysvars.js';

describe('serializeSysvarsToHeaderLines', () => {
  it('emits group code 70 for Int sysvars', () => {
    const json = JSON.stringify({ OSMODE: { Int: 4133 } });
    expect(serializeSysvarsToHeaderLines(json)).toEqual(['9', '$OSMODE', '70', '4133']);
  });

  it('emits group code 40 for Float sysvars', () => {
    const json = JSON.stringify({ FILLETRAD: { Float: 0.5 } });
    expect(serializeSysvarsToHeaderLines(json)).toEqual(['9', '$FILLETRAD', '40', '0.5']);
  });

  it('emits group code 1 for String sysvars', () => {
    const json = JSON.stringify({ CLAYER: { String: '0' } });
    expect(serializeSysvarsToHeaderLines(json)).toEqual(['9', '$CLAYER', '1', '0']);
  });

  it('emits group codes 10/20 for Point2d sysvars', () => {
    const json = JSON.stringify({ GRIDUNIT: { Point2d: { x: 0.5, y: 0.5 } } });
    expect(serializeSysvarsToHeaderLines(json)).toEqual([
      '9',
      '$GRIDUNIT',
      '10',
      '0.5',
      '20',
      '0.5',
    ]);
  });

  it('emits sysvar names sorted alphabetically (deterministic output)', () => {
    const json = JSON.stringify({
      ZSYSVAR: { Int: 1 },
      AMODE: { Int: 2 },
      MMODE: { Int: 3 },
    });
    const lines = serializeSysvarsToHeaderLines(json);
    const names = lines.filter((l) => l.startsWith('$'));
    expect(names).toEqual(['$AMODE', '$MMODE', '$ZSYSVAR']);
  });

  it('returns empty array for empty / invalid JSON (no spurious HEADER lines)', () => {
    expect(serializeSysvarsToHeaderLines('')).toEqual([]);
    expect(serializeSysvarsToHeaderLines('{}')).toEqual([]);
    expect(serializeSysvarsToHeaderLines('not json')).toEqual([]);
  });
});

describe('parseSysvarsFromDxf', () => {
  function dxf(...headerLines: string[]): string {
    return ['0', 'SECTION', '2', 'HEADER', ...headerLines, '0', 'ENDSEC', '0', 'EOF'].join('\n');
  }

  it('parses Int sysvars (group 70 / 90)', () => {
    const s = dxf('9', '$OSMODE', '70', '4133');
    expect(parseSysvarsFromDxf(s)).toEqual({ OSMODE: { Int: 4133 } });
  });

  it('parses Float sysvars (group 40)', () => {
    const s = dxf('9', '$FILLETRAD', '40', '0.5');
    expect(parseSysvarsFromDxf(s)).toEqual({ FILLETRAD: { Float: 0.5 } });
  });

  it('parses String sysvars (group 1)', () => {
    const s = dxf('9', '$CLAYER', '1', 'Walls');
    expect(parseSysvarsFromDxf(s)).toEqual({ CLAYER: { String: 'Walls' } });
  });

  it('parses Point2d sysvars (groups 10 + 20)', () => {
    const s = dxf('9', '$GRIDUNIT', '10', '0.5', '20', '0.5');
    expect(parseSysvarsFromDxf(s)).toEqual({
      GRIDUNIT: { Point2d: { x: 0.5, y: 0.5 } },
    });
  });

  it('skips DWGPROPS-style names (TITLE / AUTHOR / ...) — those are handled by parseDwgProps', () => {
    const s = dxf('9', '$TITLE', '1', 'My Drawing', '9', '$OSMODE', '70', '4133');
    const r = parseSysvarsFromDxf(s);
    expect(r).not.toHaveProperty('TITLE');
    expect(r).toHaveProperty('OSMODE');
  });

  it('is lenient: unknown $NAMEs with unsupported group codes are skipped silently (not errored)', () => {
    const s = dxf('9', '$WEIRDVAR', '999', 'unknown');
    expect(parseSysvarsFromDxf(s)).toEqual({});
  });

  it('round-trips a representative cross-type set through serialize → parse identity', () => {
    const original = {
      OSMODE: { Int: 4133 },
      FILLETRAD: { Float: 0.5 },
      CLAYER: { String: '0' },
      GRIDUNIT: { Point2d: { x: 0.5, y: 0.5 } },
    };
    const lines = serializeSysvarsToHeaderLines(JSON.stringify(original));
    const dxfStr = dxf(...lines);
    expect(parseSysvarsFromDxf(dxfStr)).toEqual(original);
  });

  it('returns {} for a DXF with no HEADER section', () => {
    expect(parseSysvarsFromDxf('0\nEOF')).toEqual({});
  });
});
