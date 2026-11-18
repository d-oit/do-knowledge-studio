import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady, navClick } from './helpers/navigation';

/**
 * Settings → Origin storage panel (issue #1156).
 *
 * Verifies the storage-health UI end to end in a real Chromium: the estimate
 * rows render from `navigator.storage.estimate()`, the persistent-storage
 * status renders from `navigator.storage.persisted()`, and the request action
 * either gets granted or is declined by the browser — the panel must render
 * the outcome either way, never crash, and never claim persistence is a
 * backup.
 */
test.describe('Settings origin storage health', () => {
  const openSettings = async (page: Page) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navClick(page, /settings/i);
    await expect(page.getByRole('heading', { name: 'Origin storage' })).toBeVisible();
    await expect(
      page.getByText(
        /Estimated usage|does not expose origin storage diagnostics|did not return usable storage measurements/i,
      ),
    ).toBeVisible();
  };

  test('renders storage diagnostics or the browser-supported fallback', async ({ page }) => {
    await openSettings(page);

    const estimate = page.getByText(/Estimated usage/i);
    if ((await estimate.count()) > 0) {
      await expect(estimate).toBeVisible();
      await expect(page.getByText(/Estimated quota/i)).toBeVisible();
      // Estimates are labeled as estimates, never exact disk usage.
      await expect(page.getByText(/browser estimates, not exact disk usage/i)).toBeVisible();
      // The panel is explicit that this is one aggregate browser estimate, not
      // per-store byte accounting.
      await expect(page.getByText(/everything this site stores here/i)).toBeVisible();
    } else {
      await expect(
        page.getByText(/does not expose origin storage diagnostics|did not return usable storage measurements/i),
      ).toBeVisible();
    }
    // This is visible even when storage diagnostics are unsupported.
    await expect(page.getByText(/not a backup/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /back up your library/i })).toBeVisible();
  });

  test('allows requesting persistent storage and renders the outcome', async ({ page }) => {
    await openSettings(page);

    const requestButton = page.getByRole('button', { name: /request persistent storage/i });
    if ((await requestButton.count()) > 0) {
      // Not protected yet: ask the browser for persistence. The browser either
      // grants or declines; the panel must explain either outcome and keep
      // working — never crash, never claim a backup was made.
      await requestButton.click();
      await expect(
        page.getByText(/persistent storage granted|declined persistent storage/i),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Origin storage' })).toBeVisible();
      await expect(
        page.locator('span').filter({ hasText: /Not granted|Granted/ }),
      ).toBeVisible();
    } else if ((await page.getByText(/^Granted/).count()) > 0) {
      // Already protected: the request control is gone and the status says so.
      await expect(page.getByText(/^Granted/)).toBeVisible();
    } else {
      // The browser may lack persistence support or all origin storage diagnostics.
      await expect(
        page.getByText(/cannot request persistent storage|does not expose origin storage diagnostics/i),
      ).toBeVisible();
    }
  });
});
