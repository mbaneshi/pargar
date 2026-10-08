import { defineConfig } from '@playwright/test';

// Dev-server config: target an already-running pnpm dev on :5174 instead of
// the production sirv build at :4173. Lets us TDD without rebuilding.
// Port :5174 (not the SvelteKit default :5173) leaves :5173 free for a
// parallel worker's dev server.
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
