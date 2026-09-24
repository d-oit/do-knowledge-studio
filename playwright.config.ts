import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  // `list` is the console summary. CI additionally writes the HTML report the
  // workflow uploads, because the list reporter alone creates no
  // `playwright-report/` directory for that step to pick up (plans/153).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
    },
    {
      name: 'desktop-xl',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    // Readiness is a real HTTP response, not a bound port: `port` is satisfied as
    // soon as `next dev` binds, while it is still compiling. On 2026-09-24 a PR run
    // started 149 tests against a server that could not serve yet and 140 failed on
    // their readiness waits (plans/153). `url` also turns a server that never
    // becomes healthy into one clear timeout instead of a wall of test failures.
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    // Pipe the dev server's own output into the job log: with the default the
    // server is invisible, which is what made that failure undiagnosable.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
