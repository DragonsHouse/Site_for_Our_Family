import { defineConfig, devices } from '@playwright/test';

process.env.PLAYWRIGHT_DASHBOARD_URL ??= 'http://127.0.0.1:4176/dashboard.html';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(real-backend|visible-concurrency)\.spec\.ts/u,
  outputDir: './playwright-results/real-backend',
  globalSetup: './tests/e2e/global-setup-real-backend.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node tests/e2e/static-server.mjs .output/chrome-mv3 4176',
    url: 'http://127.0.0.1:4176/dashboard.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'real-backend-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
});
