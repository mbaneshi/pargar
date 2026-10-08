import type { ParityKind } from './parser';
import type { Implemented } from './cross-walk';

export interface MatrixRow {
  kind: ParityKind;
  name: string;
  category: string;
  autocad_doc_url: string;
  nexus_implemented: Implemented;
  nexus_source: string;
  notes: string;
}

export const CSV_HEADER = [
  'kind',
  'name',
  'category',
  'autocad_doc_url',
  'nexus_implemented',
  'nexus_source',
  'notes',
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const KIND_ORDER: Record<ParityKind, number> = { command: 0, sysvar: 1 };

export function emitCsv(rows: MatrixRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.name.localeCompare(b.name);
  });
  const lines: string[] = [CSV_HEADER.join(',')];
  for (const row of sorted) {
    lines.push(
      [
        row.kind,
        row.name,
        row.category,
        row.autocad_doc_url,
        row.nexus_implemented,
        row.nexus_source,
        row.notes,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
