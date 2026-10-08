import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleTransport } from '../transports/console';
import type { LogEntry } from '../types';

const entry: LogEntry = {
  ts: '2026-04-19T08:00:00.000Z',
  level: 'info',
  ns: 'test:unit',
  msg: 'hello world',
  extra: 42,
};

describe('ConsoleTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs JSON format as single-line JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const t = new ConsoleTransport('json');
    t.log(entry);
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ns).toBe('test:unit');
    expect(parsed.msg).toBe('hello world');
    expect(parsed.extra).toBe(42);
  });

  it('logs pretty format with level and namespace prefix', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const t = new ConsoleTransport('pretty');
    t.log(entry);
    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0].join(' ');
    expect(output).toContain('test:unit');
    expect(output).toContain('hello world');
  });

  it('routes error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = new ConsoleTransport('json');
    t.log({ ...entry, level: 'error' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('routes warn level to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = new ConsoleTransport('json');
    t.log({ ...entry, level: 'warn' });
    expect(spy).toHaveBeenCalledOnce();
  });
});
