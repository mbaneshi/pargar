import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  parseSearchResults,
  type ParityEntry,
  type ParityKind,
  type SearchApiResponse,
} from './parser';

const USER_AGENT =
  'Mozilla/5.0 (compatible; nexus-parity-bot/0.1; +https://github.com/mbaneshi/pargar)';
const DEFAULT_RATE_LIMIT_MS = 1100;
const PAGE_SIZE = 150;
const SEARCH_BASE =
  'https://beehive.autodesk.com/community/service/rest/cloudhelp/resource/cloudhelpchannel/search/';

export interface CacheEntry {
  url: string;
  fetchedAt: string;
  lastModified: string | null;
  etag: string | null;
  body: string;
}

export interface ScraperOptions {
  cacheDir: string;
  rateLimitMs?: number;
  refresh?: boolean;
}

function urlToCacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class PoliteFetcher {
  private lastFetchAt = 0;
  public hits = 0;
  public misses = 0;

  constructor(private readonly opts: ScraperOptions) {}

  private async waitForRateLimit(): Promise<void> {
    const limit = this.opts.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
    const elapsed = Date.now() - this.lastFetchAt;
    if (elapsed < limit) {
      await new Promise((r) => setTimeout(r, limit - elapsed));
    }
    this.lastFetchAt = Date.now();
  }

  private cachePath(url: string): string {
    return resolve(this.opts.cacheDir, `${urlToCacheKey(url)}.json`);
  }

  private async readCached(url: string): Promise<CacheEntry | null> {
    const path = this.cachePath(url);
    if (!(await fileExists(path))) return null;
    try {
      return JSON.parse(await readFile(path, 'utf-8')) as CacheEntry;
    } catch {
      return null;
    }
  }

  async fetchText(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ body: string; fromCache: boolean }> {
    if (!this.opts.refresh) {
      const cached = await this.readCached(url);
      if (cached) {
        this.hits++;
        return { body: cached.body, fromCache: true };
      }
    }

    await this.waitForRateLimit();
    const cached = !this.opts.refresh ? await this.readCached(url) : null;
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/html;q=0.9, */*;q=0.5',
      ...extraHeaders,
    };
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

    const response = await fetch(url, { headers, redirect: 'follow' });
    if (response.status === 304 && cached) {
      this.hits++;
      return { body: cached.body, fromCache: true };
    }
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} for ${url}: ${response.statusText}`,
      );
    }

    const body = await response.text();
    const entry: CacheEntry = {
      url,
      fetchedAt: new Date().toISOString(),
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      body,
    };
    const path = this.cachePath(url);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(entry), 'utf-8');
    this.misses++;
    return { body, fromCache: false };
  }
}

function buildSearchUrl(kind: ParityKind, start: number): string {
  const subType = kind === 'command' ? 'command' : 'sysvar';
  const params = new URLSearchParams({
    origin: 'upi',
    source: 'all',
    p: 'ACD',
    v: '2026',
    l: 'ENU',
    sort: 'PublishDate desc,title_sort asc',
    q: 'title_sort:*',
    maxresults: String(PAGE_SIZE),
    start: String(start),
    subType,
  });
  return `${SEARCH_BASE}?${params.toString()}`;
}

const REFERER: Record<ParityKind, string> = {
  command: 'https://help.autodesk.com/view/ACD/2026/ENU/?page=commands&q=*',
  sysvar: 'https://help.autodesk.com/view/ACD/2026/ENU/?page=sysvars&q=*',
};

export async function fetchAllForKind(
  fetcher: PoliteFetcher,
  kind: ParityKind,
  log: (msg: string) => void = () => {},
): Promise<ParityEntry[]> {
  const all: ParityEntry[] = [];
  const seenGuids = new Set<string>();
  let start = 0;
  let total: number | null = null;

  while (true) {
    const url = buildSearchUrl(kind, start);
    const { body, fromCache } = await fetcher.fetchText(url, {
      Origin: 'https://help.autodesk.com',
      Referer: REFERER[kind],
    });
    const payload = JSON.parse(body) as SearchApiResponse;
    if (payload.status && payload.status !== 'Completed') {
      throw new Error(
        `Search API returned status=${payload.status} for ${url}`,
      );
    }
    if (total === null) total = Number(payload.totalResult ?? '0');

    const page = parseSearchResults(payload, kind);
    let newOnPage = 0;
    for (const entry of page) {
      if (seenGuids.has(entry.guid)) continue;
      seenGuids.add(entry.guid);
      all.push(entry);
      newOnPage++;
    }
    log(
      `  start=${start}: +${newOnPage} new (total ${all.length}/${total ?? '?'})${fromCache ? ' [cached]' : ''}`,
    );
    const rawCount = payload.entries?.item?.length ?? 0;
    if (rawCount === 0 || start + PAGE_SIZE >= (total ?? 0)) break;
    start += PAGE_SIZE;
  }
  return all;
}
