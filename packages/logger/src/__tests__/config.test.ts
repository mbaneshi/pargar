import { describe, it, expect, afterEach } from 'vitest';
import { parseConfig } from '../config';

describe('parseConfig', () => {
  afterEach(() => {
    Object.keys(import.meta.env).forEach((key) => {
      if (key.startsWith('VITE_LOG_')) {
        delete (import.meta.env as Record<string, unknown>)[key];
      }
    });
  });

  it('returns defaults when no env vars set', () => {
    const config = parseConfig();
    expect(config.level).toBe('info');
    expect(config.format).toBe('pretty');
    expect(config.targets).toEqual(['console']);
    expect(config.filter).toBe('*');
    expect(config.buffer).toBe(false);
  });

  it('reads VITE_LOG_LEVEL', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = 'debug';
    const config = parseConfig();
    expect(config.level).toBe('debug');
  });

  it('reads VITE_LOG_FORMAT', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_FORMAT = 'json';
    const config = parseConfig();
    expect(config.format).toBe('json');
  });

  it('reads VITE_LOG_TARGETS as comma-separated', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_TARGETS = 'console,sentry';
    const config = parseConfig();
    expect(config.targets).toEqual(['console', 'sentry']);
  });

  it('reads VITE_LOG_FILTER', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_FILTER = 'renderer:*,kernel:*';
    const config = parseConfig();
    expect(config.filter).toBe('renderer:*,kernel:*');
  });

  it('reads VITE_LOG_BUFFER', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_BUFFER = 'true';
    const config = parseConfig();
    expect(config.buffer).toBe(true);
  });

  it('ignores invalid log level', () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = 'verbose';
    const config = parseConfig();
    expect(config.level).toBe('info');
  });
});
