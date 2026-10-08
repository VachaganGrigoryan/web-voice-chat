import { defineConfig, devices } from '@playwright/test';

/**
 * Documentation screenshots, kept apart from the e2e suite so `npm run test:e2e`
 * is unaffected. Needs a backend on :8002 backed by a fresh database, plus an
 * email worker and MailHog; see docs/screenshots/README.md.
 */
const webPort = '3100';
const apiUrl = process.env.SCREENSHOT_API_URL || 'http://127.0.0.1:8002';

export default defineConfig({
  testDir: './screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${webPort}`,
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `npm run dev -- --port ${webPort}`,
    url: `http://localhost:${webPort}`,
    // Never reuse: a server on this port may be pointed at a different API.
    reuseExistingServer: false,
    env: { VITE_API_URL: apiUrl, VITE_SOCKET_URL: apiUrl },
  },
});
