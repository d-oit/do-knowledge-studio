import { expect, test } from '@playwright/test';
import { navClick, viewHeading, waitForAppReady } from './helpers/navigation';

declare global {
  interface Window {
    __viewNavMarker: string;
    __viewNavLoadCount: number;
  }
}

test.describe('URL-addressable views', () => {
  test('a deep link takes precedence over the persisted view', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(viewHeading(page, /library/i)).toBeVisible();

    await page.evaluate(() => {
      window.history.replaceState(null, '', '/#/graph')
    })
    await page.reload()
    await waitForAppReady(page);

    await expect(viewHeading(page, /graph/i)).toBeVisible();
    await expect(viewHeading(page, /library/i)).toHaveCount(0);
  });

  test('reload restores the view from its URL hash', async ({ page }) => {
    await page.goto('/#/mindmap');
    await waitForAppReady(page);
    await expect(viewHeading(page, /mind map/i)).toBeVisible();

    await page.reload();
    await waitForAppReady(page);

    await expect(viewHeading(page, /mind map/i)).toBeVisible();
    await expect(page).toHaveURL(/#\/mindmap$/);
  });

  test('unknown view hashes resolve to home', async ({ page }) => {
    await page.goto('/#/not-a-view');
    await waitForAppReady(page);

    await expect(page.getByRole('heading', { name: /recent work/i })).toBeVisible();
    await expect(page).toHaveURL(/#\/home$/);
  });

  test('Back and Forward traverse views without reloading the document', async ({ page }) => {
    await page.addInitScript(() => {
      const loadKey = 'view-url-document-load-count';
      const loadCount = Number(sessionStorage.getItem(loadKey) ?? '0') + 1;
      sessionStorage.setItem(loadKey, String(loadCount));
      window.__viewNavMarker = 'kept';
      window.__viewNavLoadCount = loadCount;
    });
    await page.goto('/');
    await waitForAppReady(page);

    await navClick(page, /library/i);
    await expect(page).toHaveURL(/#\/library$/);
    await navClick(page, /graph/i);
    await expect(page).toHaveURL(/#\/graph$/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/library$/);
    await expect(viewHeading(page, /library/i)).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/#\/graph$/);
    await expect(viewHeading(page, /graph/i)).toBeVisible();

    const marker = await page.evaluate(() => ({
      value: window.__viewNavMarker,
      loadCount: window.__viewNavLoadCount,
    }));
    expect(marker).toEqual({ value: 'kept', loadCount: 1 });
  });
});
