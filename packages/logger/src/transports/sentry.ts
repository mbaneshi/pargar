import type { LogEntry, Transport } from '../types';

export class SentryTransport implements Transport {
  name = 'sentry';

  log(entry: LogEntry): void {
    if (entry.level !== 'error') return;
    if (typeof window === 'undefined') return;

    const { ts: _ts, level: _level, ns, msg, ...context } = entry;
    import('@sentry/browser')
      .then((Sentry) => {
        Sentry.captureMessage(msg, { level: 'error', extra: { ns, ...context } });
      })
      .catch(() => {
        // Sentry not available — silent fail
      });
  }
}
