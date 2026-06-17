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
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global timeout per test */
  timeout: 60_000,
  /* Expect timeout for assertions */
  expect: {
    timeout: process.env.CI ? 10_000 : 5_000,
  },
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* Explicit viewport to prevent headed vs headless drift */
    viewport: { width: 1280, height: 720 },
    /* Action timeout to prevent slow CI clicks from timing out */
    actionTimeout: process.env.CI ? 10_000 : 5_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Mobile/tablet projects only run in CI where WebKit dependencies are installed */
    ...(process.env.CI ? [
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

  /* Run your local dev server before starting the tests */
  webServer: {
    command: isProduction ? 'npm run preview' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
