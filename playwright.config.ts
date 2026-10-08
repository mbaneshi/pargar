import { defineConfig } from '@playwright/test';

// Preview-server port. Two self-hosted runners share one Mac, so CI gives each
// its own port (see .github/workflows/ci.yml) — otherwise one runner's
// cleanup-test-ports.sh kills the other's server mid-suite. Local default 4173.
const PORT = Number(process.env.PLAYWRIGHT_PORT || 4173);

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  retries: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: './test-results/playwright-junit.xml' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx sirv-cli packages/app/build --port ${PORT} --single`,
    port: PORT,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
