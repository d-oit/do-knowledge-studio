import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const isProduction = process.env.PLAYWRIGHT_MODE === 'production';
const PORT = isProduction ? 4173 : 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* 4 workers on CI (GitHub Actions runners have 4 vCPUs) allows
   * fullyParallel to actually parallelize. Previously workers:1 serialized
   * all tests despite fullyParallel:true. */
  workers: process.env.CI ? 4 : undefined,
  /* CI: machine-readable output for GitHub Actions annotations + Codacy.
   * Locally: rich HTML report only. */
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'playwright-report/results.json' }], ['html', { open: 'never' }]]
    : [['html']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Global setup clears OPFS/IndexedDB state between full test runs to
   * prevent test pollution in the local-first SQLite environment. */
  globalSetup: './tests/e2e/global-setup.ts',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Firefox is included in CI to catch SQLite WASM SharedArrayBuffer
     * (COOP/COEP) compatibility issues that Chromium silently passes. */
    ...(process.env.CI ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'mobile',
        use: { ...devices['iPhone 13'] },
      },
      {
        name: 'tablet',
        use: { ...devices['iPad Pro 11'] },
      },
    ] : []),
  ],

  webServer: {
    command: isProduction ? 'npm run preview' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
