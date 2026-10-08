import type { LogEntry, LogLevel, LoggerConfig, Transport } from './types';
import { ConsoleTransport } from './transports/console';
import { SentryTransport } from './transports/sentry';
import { CloudTransport } from './transports/cloud';
import { parseConfig } from './config';

const LEVEL_VALUES: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let config: LoggerConfig = parseConfig();
let transports: Transport[] = [];
let buffer: LogEntry[] = [];
let flushScheduled = false;

function buildTransports(cfg: LoggerConfig): Transport[] {
  const result: Transport[] = [];
  for (const target of cfg.targets) {
    if (target === 'console') result.push(new ConsoleTransport(cfg.format));
    if (target === 'sentry') result.push(new SentryTransport());
    if (target === 'cloud') result.push(new CloudTransport());
  }
  return result;
}

transports = buildTransports(config);

export function initLogger(cfg: LoggerConfig): void {
  config = cfg;
  transports = buildTransports(cfg);
  buffer = [];
}

function matchesFilter(ns: string, filter: string): boolean {
  if (filter === '*') return true;
  const patterns = filter.split(',').map((p) => p.trim());
  return patterns.some((pattern) => {
    if (pattern.endsWith(':*')) {
      return ns.startsWith(pattern.slice(0, -1));
    }
    return ns === pattern;
  });
}

function dispatch(entry: LogEntry): void {
  for (const t of transports) {
    t.log(entry);
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => flushBuffer(), { timeout: 500 });
  } else {
    setTimeout(() => flushBuffer(), 0);
  }
}

function flushBuffer(): void {
  flushScheduled = false;
  const entries = buffer.splice(0, buffer.length);
  for (const entry of entries) {
    dispatch(entry);
  }
}

export function flush(): void {
  flushBuffer();
}

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  span<T>(name: string, fn: () => T): T;
}

export function createLogger(ns: string): Logger {
  function log(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
    if (LEVEL_VALUES[level] < LEVEL_VALUES[config.level]) return;
    if (!matchesFilter(ns, config.filter)) return;

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      ns,
      msg,
      ...context,
    };

    if (config.buffer && level !== 'error') {
      buffer.push(entry);
      if (buffer.length >= 100) {
        flushBuffer();
      } else {
        scheduleFlush();
      }
    } else {
      dispatch(entry);
    }
  }

  return {
    debug: (msg, ctx?) => log('debug', msg, ctx),
    info: (msg, ctx?) => log('info', msg, ctx),
    warn: (msg, ctx?) => log('warn', msg, ctx),
    error: (msg, ctx?) => log('error', msg, ctx),
    span<T>(name: string, fn: () => T): T {
      const start = performance.now();
      const result = fn();
      const duration_ms = Math.round((performance.now() - start) * 100) / 100;
      log('info', name, { duration_ms });
      return result;
    },
  };
}
