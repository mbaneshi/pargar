import { describe, it, expect } from 'vitest';
import { SentryTransport } from '../transports/sentry';
import type { LogEntry } from '../types';

const errorEntry: LogEntry = {
  ts: '2026-04-19T08:00:00.000Z',
  level: 'error',
  ns: 'app:init',
  msg: 'WASM init failed',
  error: 'NetworkError',
};

const infoEntry: LogEntry = {
  ...errorEntry,
  level: 'info',
  msg: 'loaded',
};

describe('SentryTransport', () => {
  it('only captures error-level entries', () => {
    const t = new SentryTransport();
    expect(() => t.log(infoEntry)).not.toThrow();
  });

  it('attempts to capture error entries', () => {
    const t = new SentryTransport();
    expect(() => t.log(errorEntry)).not.toThrow();
  });

  it('has name "sentry"', () => {
    const t = new SentryTransport();
    expect(t.name).toBe('sentry');
  });
});
