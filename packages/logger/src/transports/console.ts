import type { LogEntry, LogFormat, Transport } from '../types';

const LEVEL_COLORS: Record<string, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export class ConsoleTransport implements Transport {
  name = 'console';

  constructor(private format: LogFormat) {}

  log(entry: LogEntry): void {
    const output = this.format === 'json' ? JSON.stringify(entry) : this.pretty(entry);

    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      // eslint-disable-next-line no-console
      console.log(output);
    }
  }

  private pretty(entry: LogEntry): string {
    const color = LEVEL_COLORS[entry.level] ?? '';
    const { ts: _ts, level, ns, msg, ...rest } = entry;
    const ctx = Object.keys(rest).length > 0 ? ' ' + JSON.stringify(rest) : '';
    return `${color}[${level.toUpperCase()}]${RESET} ${ns} ${msg}${ctx}`;
  }
}
