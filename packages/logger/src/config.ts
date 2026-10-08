import type { LoggerConfig, LogLevel, LogFormat } from './types';

const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const VALID_FORMATS: LogFormat[] = ['pretty', 'json'];

function env(key: string): string | undefined {
  const metaEnv = (import.meta as any).env;
  if (metaEnv && key in metaEnv) {
    const val = metaEnv[key];
    return typeof val === 'string' ? val : undefined;
  }
  try {
    return process?.env?.[key] ?? undefined;
  } catch {
    return undefined;
  }
}

export function parseConfig(): LoggerConfig {
  const rawLevel = env('VITE_LOG_LEVEL') ?? '';
  const rawFormat = env('VITE_LOG_FORMAT') ?? '';
  const rawTargets = env('VITE_LOG_TARGETS') ?? '';
  const rawFilter = env('VITE_LOG_FILTER') ?? '';
  const rawBuffer = env('VITE_LOG_BUFFER') ?? '';

  return {
    level: VALID_LEVELS.includes(rawLevel as LogLevel) ? (rawLevel as LogLevel) : 'info',
    format: VALID_FORMATS.includes(rawFormat as LogFormat) ? (rawFormat as LogFormat) : 'pretty',
    targets: rawTargets ? rawTargets.split(',').map((t) => t.trim()) : ['console'],
    filter: rawFilter || '*',
    buffer: rawBuffer === 'true',
  };
}
