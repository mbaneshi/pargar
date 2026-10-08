import * as Sentry from '@sentry/svelte';

if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.MODE,
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  });
}
