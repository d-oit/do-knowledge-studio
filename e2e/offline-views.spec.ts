import { test, expect, type Page } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';

/**
 * First-use offline navigation into each lazily imported view.
 *
 * The app shell code-splits Graph, Mind Map, AI Harness, TRIZ, Export and Sync
 * (plans/158). The precache manifest is derived from the emitted HTML, which
 * only references the boot document's own chunks — so before the fix the
 * offline cache held the shell but not the view chunks, and the first
 * navigation to an unvisited view offline rejected its dynamic import instead
 * of rendering the view.
 *
 * Reproducing that requires a real production build: `next dev` re-chunks on
 * every request, so its asset URLs never match the committed manifest. Run via
 * `pnpm run build && pnpm run test:e2e:offline`.
 *
 * Isolation is deliberate and load-bearing:
 * - Each test gets a fresh browser context from Playwright, so `CacheStorage`
 *   and the service worker registration start empty and no earlier test can
 *   have prewarmed a chunk.
 * - The online visit exists only to let the worker install. That page is closed
 *   before the offline check so its in-memory modules cannot satisfy the import
 *   that we are trying to prove comes from the cache.
 * - The browser HTTP cache is cleared with CDP, because a chunk left there by
 *   the online visit would mask a missing precache entry.
 * - `CacheStorage` and `localStorage` are intentionally left intact: the worker
 *   cache is the mechanism under test.
 */

test.use({ serviceWorkers: 'allow' });

/** Heading the view error boundary renders when a dynamic import rejects. */
const LOAD_FAILURE_HEADING = /failed to load/i;

interface OfflineViewCase {
  /** View name, used for the test title. */
  readonly name: string;
  /** Sidebar button label, matched inside the main navigation. */
  readonly nav: RegExp;
  /**
   * Asserts a surface only the view's own chunk can render.
   *
   * Every case is scoped to the `main` landmark: the shell renders a topbar
   * `<h1>` carrying the current view's name, so an unscoped heading assertion
   * for "AI Harness" or "Sync" is satisfied by the chrome even when the lazy
   * import rejected and the view body is an error fallback.
   */
  readonly assertSurface: (page: Page) => Promise<void>;
}

const OFFLINE_VIEW_CASES: readonly OfflineViewCase[] = [
  {
    name: 'Graph',
    nav: /graph/i,
    assertSurface: async (page) => {
      await expect(
        page.getByRole('main').getByRole('img', { name: /knowledge graph/i }),
      ).toBeVisible();
    },
  },
  {
    name: 'Mind Map',
    nav: /mind map/i,
    assertSurface: async (page) => {
      await expect(
        page.getByRole('main').getByRole('tree', { name: 'Knowledge mind map' }),
      ).toBeVisible();
    },
  },
  {
    name: 'AI Harness',
    nav: /ai harness/i,
    assertSurface: async (page) => {
      // Setup surface only. No provider request and no model download: the
      // point is that the harness code executed, not that it can infer offline.
      await expect(
        page.getByRole('main').getByRole('heading', { name: 'AI Harness' }),
      ).toBeVisible();
    },
  },
  {
    name: 'TRIZ',
    nav: /triz/i,
    assertSurface: async (page) => {
      await expect(
        page.getByRole('main').getByRole('heading', { name: 'TRIZ Contradiction Matrix' }),
      ).toBeVisible();
    },
  },
  {
    name: 'Export',
    nav: /export/i,
    assertSurface: async (page) => {
      await expect(
        page.getByRole('main').getByRole('heading', { name: 'Export knowledge' }),
      ).toBeVisible();
    },
  },
  {
    name: 'Sync',
    nav: /sync/i,
    assertSurface: async (page) => {
      // Disconnected rendering is the expected offline surface; no room is
      // joined and no peer connection is attempted.
      await expect(
        page.getByRole('main').getByRole('heading', { name: 'Sync', exact: true }),
      ).toBeVisible();
    },
  },
];

/**
 * Resolves once the active worker also controls this document.
 *
 * `serviceWorker.ready` only guarantees an activated registration; a page that
 * loaded before activation is uncontrolled until `clients.claim()` lands.
 * Waiting on `controllerchange` rather than a sleep keeps the precondition
 * exact: without a controller, no request is intercepted and the test would
 * pass for the wrong reason.
 */
const waitForServiceWorkerControl = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
};

/**
 * Clears the browser HTTP cache for this context's storage partition.
 *
 * Chromium only; the spec is bound to the Chromium project in
 * `playwright.config.ts` for exactly this reason. The session is detached in
 * `finally` so a failed CDP command cannot leak a session into teardown.
 */
const clearBrowserHttpCache = async (page: Page): Promise<void> => {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Network.clearBrowserCache');
  } finally {
    await session.detach();
  }
};

/**
 * Installs the worker against a production build, then proves the view renders
 * on a first-ever offline navigation.
 */
const assertOfflineFirstVisit = async (page: Page, viewCase: OfflineViewCase): Promise<void> => {
  const context = page.context();

  await page.goto('/');
  await waitForAppReady(page);
  await waitForServiceWorkerControl(page);
  await page.close();

  const offlinePage = await context.newPage();
  await clearBrowserHttpCache(offlinePage);
  await context.setOffline(true);
  try {
    await offlinePage.goto('/');
    await waitForAppReady(offlinePage);

    await navClick(offlinePage, viewCase.nav);

    await viewCase.assertSurface(offlinePage);
    await expect(
      offlinePage.getByRole('main').getByRole('heading', { name: LOAD_FAILURE_HEADING }),
    ).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
};

for (const viewCase of OFFLINE_VIEW_CASES) {
  test(`${viewCase.name}: first offline navigation renders the view`, async ({ page }) => {
    await assertOfflineFirstVisit(page, viewCase);
  });
}
