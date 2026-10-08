import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, initLogger, flush } from '../index';

describe('createLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    initLogger({
      level: 'debug',
      format: 'json',
      targets: ['console'],
      filter: '*',
      buffer: false,
    });
  });

  it('creates a namespaced logger', () => {
    const log = createLogger('test:unit');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('hello');
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ns).toBe('test:unit');
    expect(parsed.msg).toBe('hello');
    expect(parsed.level).toBe('info');
    expect(parsed.ts).toBeDefined();
  });

  it('includes context in log entry', () => {
    const log = createLogger('test:ctx');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('point', { x: 10, y: 20 });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.x).toBe(10);
    expect(parsed.y).toBe(20);
  });

  it('filters by log level', () => {
    initLogger({ level: 'warn', format: 'json', targets: ['console'], filter: '*', buffer: false });
    const log = createLogger('test:level');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.info('should not appear');
    log.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    log.warn('should appear');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('filters by namespace', () => {
    initLogger({
      level: 'debug',
      format: 'json',
      targets: ['console'],
      filter: 'renderer:*',
      buffer: false,
    });
    const log1 = createLogger('renderer:snap');
    const log2 = createLogger('kernel:ecs');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log1.info('visible');
    log2.info('hidden');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('buffers entries when buffer=true and flushes', () => {
    initLogger({ level: 'debug', format: 'json', targets: ['console'], filter: '*', buffer: true });
    const log = createLogger('test:buf');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('buffered');
    expect(spy).not.toHaveBeenCalled();
    flush();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('error entries bypass buffer', () => {
    initLogger({ level: 'debug', format: 'json', targets: ['console'], filter: '*', buffer: true });
    const log = createLogger('test:err');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('critical');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('span() logs duration', () => {
    const log = createLogger('test:span');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = log.span('compute', () => 42);
    expect(result).toBe(42);
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.msg).toBe('compute');
    expect(parsed.duration_ms).toBeTypeOf('number');
  });
});
