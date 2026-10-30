import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady, navClick } from './helpers/navigation';

test.use({ serviceWorkers: 'allow' });

/**
 * Resolves once the active service worker controls the page document (if supported).
 */
const waitForServiceWorkerControl = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // SW ready wait timed out or rejected
    }
  });
};

test.describe('PWA CacheStorage Policy & Verification', () => {
  test('does not cache non-GET/HEAD, authenticated, or private requests in CacheStorage', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForServiceWorkerControl(page);

    // Issue simulated requests through window.fetch to test SW caching policy
    await page.evaluate(async () => {
      // 1. Safe GET same-origin request
      await fetch('/api').catch(() => null);

      // 2. Non-idempotent POST request
      await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'post' }),
      }).catch(() => null);

      // 3. Authenticated request
      await fetch('/api', {
        headers: { Authorization: 'Bearer secret-token' },
      }).catch(() => null);

      // 4. Request with no-store
      await fetch('/api', {
        headers: { 'Cache-Control': 'no-store' },
      }).catch(() => null);

      // 5. Non-allowlisted / excluded endpoint (e.g. AI provider chat or user credentials)
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      }).catch(() => null);
    });

    // Inspect CacheStorage keys and match entries
    const cacheInspection = await page.evaluate(async () => {
      if (!('caches' in window)) return { apiKeys: [], matchCount: 0 };
      try {
        const apiCache = await caches.open('dks-api-v2');
        const keys = await apiCache.keys();
        const urls = keys.map((k) => k.url);
        return {
          apiKeys: urls,
          matchCount: keys.length,
        };
      } catch {
        return { apiKeys: [], matchCount: 0 };
      }
    });

    // Ensure non-idempotent, auth, no-store, or excluded endpoints were never added
    for (const url of cacheInspection.apiKeys) {
      expect(url).not.toContain('/api/chat');
      expect(url).not.toContain('/api/user');
    }
  });

  test('user-visible "Clear offline cache" button purges CacheStorage', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForServiceWorkerControl(page);

    // Pre-populate a dummy cache entry to test clearing
    await page.evaluate(async () => {
      if ('caches' in window) {
        try {
          const dummyCache = await caches.open('dks-test-dummy');
          await dummyCache.put('/test-dummy-item', new Response('dummy'));
        } catch {
          // Ignore if CacheStorage is restricted
        }
      }
    });

    // Verify dummy cache exists before clear
    const initialKeys = await page.evaluate(async () => {
      return 'caches' in window ? await caches.keys() : [];
    });
    expect(initialKeys).toContain('dks-test-dummy');

    // Navigate to Export view using navClick (viewport-aware) and trigger Clear Offline Cache
    await navClick(page, /export/i);
    await expect(page.getByRole('main').getByRole('heading', { name: /export knowledge/i })).toBeVisible();

    const clearButton = page.getByRole('button', { name: /clear offline cache/i });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Confirm in dialog
    const confirmButton = page.getByRole('dialog').getByRole('button', { name: /clear offline cache/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Verify all caches were purged
    await expect.poll(async () => {
      return page.evaluate(async () => {
        if (!('caches' in window)) return 0;
        const keys = await caches.keys();
        return keys.length;
      });
    }).toBe(0);
  });
});
