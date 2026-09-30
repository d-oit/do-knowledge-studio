import { defineConfig, devices } from '@playwright/test';

/**
 * Production mode: serve the built app instead of `next dev`.
 *
 * A development server chunks the app differently on every request, so its
 * asset URLs can never match the committed precache manifest. Any test that
 * asserts real offline behavior therefore needs `pnpm run build` output and
 * `pnpm run start`, gated behind an explicit env flag so the default
 * `pnpm run test:e2e` keeps its fast development loop.
 */
const isProductionRun = process.env.PLAYWRIGHT_PRODUCTION === '1';

/**
 * Specs that only make sense against a production build.
 *
 * Excluded from the default (development) run and from every non-Chromium
 * project — the offline navigation contract is asserted through Chromium's
 * CDP cache control and browser-context offline mode, which WebKit and the
 * emulated mobile devices do not provide. Mobile viewport behavior of the same
 * views is covered by the production Chromium smoke run instead.
 */
const PRODUCTION_ONLY_SPECS = ['**/offline-views.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  testIgnore: isProductionRun ? [] : PRODUCTION_ONLY_SPECS,
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
      testIgnore: PRODUCTION_ONLY_SPECS,
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      testIgnore: PRODUCTION_ONLY_SPECS,
    },
    {
      name: 'desktop-xl',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testIgnore: PRODUCTION_ONLY_SPECS,
    },
  ],
  webServer: {
    command: isProductionRun ? 'pnpm run start' : 'pnpm run dev',
    // Readiness is a real HTTP response, not a bound port: `port` is satisfied as
    // soon as `next dev` binds, while it is still compiling. On 2026-09-24 a PR run
    // started 149 tests against a server that could not serve yet and 140 failed on
    // their readiness waits (plans/153). `url` also turns a server that never
    // becomes healthy into one clear timeout instead of a wall of test failures.
    url: 'http://localhost:3000',
    timeout: 120000,
    // Production runs must never adopt a stray server on the port: a dev server
    // there serves different chunks than the ones the precache manifest lists.
    reuseExistingServer: !isProductionRun && !process.env.CI,
    // Pipe the dev server's own output into the job log: with the default the
    // server is invisible, which is what made that failure undiagnosable.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
