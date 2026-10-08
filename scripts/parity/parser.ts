export type ParityKind = 'command' | 'sysvar';

export interface ParityEntry {
  kind: ParityKind;
  name: string;
  guid: string;
  description: string;
}

const KIND_SUFFIX: Record<ParityKind, string> = {
  command: '(Command)',
  sysvar: '(System Variable)',
};

export interface SearchApiEntry {
  url: string;
  title: string;
  shortDescription?: string;
  snippet?: string;
  topicId: string;
}

export interface SearchApiResponse {
  status?: string;
  totalResult?: string;
  entries?: { item?: SearchApiEntry[] };
}

export function parseSearchResults(
  payload: SearchApiResponse,
  kind: ParityKind,
): ParityEntry[] {
  const items = payload?.entries?.item ?? [];
  const suffix = KIND_SUFFIX[kind];
  const entries: ParityEntry[] = [];
  for (const item of items) {
    const title = (item.title ?? '').trim();
    if (!title.endsWith(suffix)) continue;
    const name = title.slice(0, -suffix.length).trim();
    const guid = (item.topicId ?? '').trim();
    if (!name || !guid) continue;
    entries.push({
      kind,
      name,
      guid,
      description: (item.shortDescription ?? item.snippet ?? '').trim(),
    });
  }
  return entries;
}
