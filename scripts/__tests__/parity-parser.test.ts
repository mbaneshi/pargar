import { describe, it, expect } from 'vitest';
import {
  parseSearchResults,
  type SearchApiEntry,
  type SearchApiResponse,
} from '../parity/parser';

describe('parseSearchResults', () => {
  it('extracts commands from beehive search API JSON, dropping the (Command) suffix and skipping wrong-kind items', () => {
    const payload: SearchApiResponse = {
      status: 'Completed',
      totalResult: '983',
      entries: {
        item: [
          {
            url: 'https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-30ECFD30-A1D6-4D60-9DD1-B487603F6772.htm',
            title: 'ARC (Command)',
            shortDescription: 'Creates an arc.',
            topicId: 'GUID-30ECFD30-A1D6-4D60-9DD1-B487603F6772',
          },
          {
            url: 'https://help.autodesk.com/.../.htm',
            title: 'EXOFFSET (Express Tool)',
            shortDescription: 'Express tool — should be skipped when kind=command.',
            topicId: 'GUID-EXPRESS-TOOL-EXAMPLE',
          },
          {
            url: 'https://help.autodesk.com/.../.htm',
            title: 'OSMODE (System Variable)',
            shortDescription: 'Should be skipped when kind=command.',
            topicId: 'GUID-SYSVAR-EXAMPLE',
          },
        ],
      },
    };

    const result = parseSearchResults(payload, 'command');

    expect(result).toEqual([
      {
        kind: 'command',
        name: 'ARC',
        guid: 'GUID-30ECFD30-A1D6-4D60-9DD1-B487603F6772',
        description: 'Creates an arc.',
      },
    ]);
  });

  it('falls back to snippet when shortDescription is absent', () => {
    const payload: SearchApiResponse = {
      entries: {
        item: [
          {
            url: 'x',
            title: 'OSMODE (System Variable)',
            snippet: 'Sets running object snaps.',
            topicId: 'GUID-OSMODE',
          },
        ],
      },
    };

    expect(parseSearchResults(payload, 'sysvar')).toEqual([
      {
        kind: 'sysvar',
        name: 'OSMODE',
        guid: 'GUID-OSMODE',
        description: 'Sets running object snaps.',
      },
    ]);
  });

  it('returns empty array when entries are missing', () => {
    expect(parseSearchResults({}, 'command')).toEqual([]);
    expect(parseSearchResults({ entries: {} }, 'command')).toEqual([]);
  });

  it('skips items missing topicId or with empty title', () => {
    const payload: SearchApiResponse = {
      entries: {
        item: [
          {
            url: 'x',
            title: 'LINE (Command)',
            topicId: '',
          } as SearchApiEntry,
          {
            url: 'x',
            title: '',
            topicId: 'GUID-X',
          } as SearchApiEntry,
        ],
      },
    };
    expect(parseSearchResults(payload, 'command')).toEqual([]);
  });
});

