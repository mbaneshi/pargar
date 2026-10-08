import { describe, it, expect } from 'vitest';
import { CSV_HEADER, emitCsv, type MatrixRow } from '../parity/csv';

describe('emitCsv', () => {
  it('writes the canonical 7-column header followed by sorted rows', () => {
    const rows: MatrixRow[] = [
      {
        kind: 'sysvar',
        name: 'OSMODE',
        category: '',
        autocad_doc_url: 'https://help.autodesk.com/.../GUID-X.htm',
        nexus_implemented: 'no',
        nexus_source: '',
        notes: '',
      },
      {
        kind: 'command',
        name: 'LINE',
        category: 'Drawing Tools',
        autocad_doc_url: 'https://help.autodesk.com/.../GUID-Y.htm',
        nexus_implemented: 'yes',
        nexus_source: 'packages/kernel/src/commands.rs:30',
        notes: '',
      },
      {
        kind: 'command',
        name: 'ARC',
        category: 'Creating Lines and Curves',
        autocad_doc_url: 'https://help.autodesk.com/.../GUID-Z.htm',
        nexus_implemented: 'yes',
        nexus_source: 'packages/kernel/src/commands.rs:42',
        notes: '',
      },
    ];

    const csv = emitCsv(rows);
    const lines = csv.trimEnd().split('\n');

    expect(lines[0]).toBe(CSV_HEADER.join(','));
    // sorted by (kind, name): commands before sysvars; ARC < LINE
    expect(lines[1]).toContain(',ARC,');
    expect(lines[2]).toContain(',LINE,');
    expect(lines[3]).toContain(',OSMODE,');
  });

  it('quotes fields that contain commas, quotes, or newlines and doubles inner quotes (RFC 4180)', () => {
    const rows: MatrixRow[] = [
      {
        kind: 'command',
        name: 'CIRCLE',
        category: 'Creating Lines and Curves',
        autocad_doc_url: 'https://help.autodesk.com/.../GUID-A.htm',
        nexus_implemented: 'yes',
        nexus_source:
          'packages/kernel/src/commands.rs:37; packages/kernel/src/commands.rs:608',
        notes: 'Missing TTT mode; uses "tangent-tangent-radius" instead.',
      },
    ];

    const csv = emitCsv(rows);
    const dataLine = csv.trimEnd().split('\n')[1];

    // semicolon-separated nexus_source must NOT be quoted (no commas)
    expect(dataLine).toContain(
      'packages/kernel/src/commands.rs:37; packages/kernel/src/commands.rs:608',
    );
    // notes contains comma + double quote → must be quoted, with inner quotes doubled
    expect(dataLine).toContain(
      '"Missing TTT mode; uses ""tangent-tangent-radius"" instead."',
    );
  });

  it('ends with a single trailing newline and emits exactly one line per row plus header', () => {
    const rows: MatrixRow[] = [
      {
        kind: 'command',
        name: 'X',
        category: '',
        autocad_doc_url: '',
        nexus_implemented: 'no',
        nexus_source: '',
        notes: '',
      },
    ];
    const csv = emitCsv(rows);
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv.endsWith('\n\n')).toBe(false);
    expect(csv.match(/\n/g)?.length).toBe(2); // header + 1 row
  });
});
