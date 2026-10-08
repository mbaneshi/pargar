/**
 * DXF HEADER round-trip helpers for the kernel sysvar registry.
 *
 * Encoding (per AutoCAD DXF reference, simplified to what the kernel uses):
 *   Int      → group code 70   (e.g. $OSMODE 70 4133)
 *   Float    → group code 40   (e.g. $FILLETRAD 40 0.5)
 *   String   → group code 1    (e.g. $CLAYER 1 0)
 *   Point2d  → group codes 10, 20 (e.g. $GRIDUNIT 10 0.5 20 0.5)
 *
 * The parser is intentionally lenient — DWGPROPS names (TITLE, AUTHOR, …)
 * are deferred to parseDwgProps; unknown / unsupported group codes are
 * skipped silently per AutoCAD-spec behaviour.
 */

export type SysvarValue =
  | { Int: number }
  | { Float: number }
  | { String: string }
  | { Point2d: { x: number; y: number } };

const DWGPROPS_NAMES: ReadonlySet<string> = new Set([
  'TITLE',
  'SUBJECT',
  'AUTHOR',
  'KEYWORDS',
  'COMMENTS',
  'HYPERLINKBASE',
  'LASTSAVEDBY',
]);

const FORMAT_NAMES: ReadonlySet<string> = new Set(['ACADVER', 'DWGCODEPAGE']);

export function serializeSysvarsToHeaderLines(sysvarsJson: string): string[] {
  if (!sysvarsJson) return [];
  let parsed: Record<string, SysvarValue>;
  try {
    parsed = JSON.parse(sysvarsJson) as Record<string, SysvarValue>;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const lines: string[] = [];
  const names = Object.keys(parsed).sort();
  for (const name of names) {
    const value = parsed[name];
    if (!value || typeof value !== 'object') continue;
    if ('Int' in value) {
      lines.push('9', `$${name}`, '70', String(value.Int));
    } else if ('Float' in value) {
      lines.push('9', `$${name}`, '40', String(value.Float));
    } else if ('String' in value) {
      lines.push('9', `$${name}`, '1', String(value.String));
    } else if ('Point2d' in value && value.Point2d) {
      lines.push('9', `$${name}`, '10', String(value.Point2d.x), '20', String(value.Point2d.y));
    }
  }
  return lines;
}

export function parseSysvarsFromDxf(dxfString: string): Record<string, SysvarValue> {
  const result: Record<string, SysvarValue> = {};
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());

  let inHeader = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'HEADER') {
        inHeader = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inHeader) break;
    if (!inHeader) continue;
    if (lines[i] !== '9') continue;

    const varName = (lines[i + 1] ?? '').replace(/^\$/, '');
    if (!varName) continue;
    if (DWGPROPS_NAMES.has(varName) || FORMAT_NAMES.has(varName)) continue;
    if (i + 3 >= lines.length) break;

    const groupCode = lines[i + 2];
    const valueLine = lines[i + 3];

    if (groupCode === '70' || groupCode === '90' || groupCode === '71') {
      const n = Number(valueLine);
      if (!Number.isNaN(n)) result[varName] = { Int: n };
    } else if (groupCode === '40') {
      const n = Number(valueLine);
      if (!Number.isNaN(n)) result[varName] = { Float: n };
    } else if (groupCode === '1') {
      result[varName] = { String: valueLine };
    } else if (groupCode === '10' && i + 5 < lines.length && lines[i + 4] === '20') {
      const x = Number(valueLine);
      const y = Number(lines[i + 5]);
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        result[varName] = { Point2d: { x, y } };
      }
    }
    // Anything else: skip silently (forward-compat with future group codes).
  }

  return result;
}
