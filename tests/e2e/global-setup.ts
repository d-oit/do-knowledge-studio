/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * For the local-first SQLite WASM / OPFS environment we cannot clear
 * Origin Private File System state from Node.js (it lives in the browser
 * context). Instead we set an env flag that page fixtures can read to
 * perform in-browser cleanup before each spec if needed.
 *
 * Extend this file to:
 *  - Seed a known-good fixture database via the CLI
 *  - Verify the dev / preview server is healthy before tests start
 *  - Export shared auth state once (when auth is added)
 */
export default async function globalSetup() {
  // Signal to test fixtures that a fresh run is starting.
  process.env.PLAYWRIGHT_FRESH_RUN = '1';

  // Future: await seedFixtureDatabase();
}
