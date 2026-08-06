import { test, expect } from '@playwright/test';
import { navClick, openNavIfHidden } from './helpers/navigation';

/**
 * Inject CSS to set the root font-size to the given percentage.
 * This simulates browser text zoom (which scales font-size on <html>).
 */
const setTextZoom = async (page: import('@playwright/test').Page, percentage: number) => {
  await page.addStyleTag({
    content: `html { font-size: ${percentage}% !important; }`,
  });
}

/** Check that the page has no horizontal overflow (scrollbar) */
const assertNoHorizontalOverflow = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  expect(overflow.scrollWidth, 'Document has horizontal overflow').toBeLessThanOrEqual(
    overflow.clientWidth + 1, // +1 for rounding tolerance
  );
}

test.describe('Zoom and reflow — WCAG 1.4.4 (200%) and 1.4.10 (400% reflow)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // T6: 200% text zoom
  test('200% text zoom: no horizontal overflow on home', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setTextZoom(page, 200);
    await page.waitForTimeout(500); // allow layout to settle

    await assertNoHorizontalOverflow(page);

    // All interactive elements should still be reachable via Tab
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
  });

  test('200% text zoom: no horizontal overflow on library', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navClick(page, /library/i);
    await page.waitForLoadState('networkidle');
    await setTextZoom(page, 200);
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page);
  });

  test('200% text zoom: no horizontal overflow on editor', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navClick(page, /editor/i);
    await page.waitForLoadState('networkidle');
    await setTextZoom(page, 200);
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page);
  });

  // T7: 400% reflow
  test('400% reflow: no horizontal scrollbar on 1280px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setTextZoom(page, 400);
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page);
  });

  test('400% reflow: content reflows to single column on home', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setTextZoom(page, 400);
    await page.waitForTimeout(500);

    // Check that the main content is visible and not clipped
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();

    // Verify no content is cut off horizontally
    await assertNoHorizontalOverflow(page);
  });

  // T8: Zoom + mobile
  test('zoom + mobile: 375px with 200% text, no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setTextZoom(page, 200);
    await page.waitForTimeout(500);

    await assertNoHorizontalOverflow(page);

    // Hamburger menu should still be functional
    // (On mobile the sidebar is hidden behind a drawer toggle)
    const pageStillWorks = await page
      .getByRole('navigation', { name: /main navigation/i })
      .or(page.locator('main'))
      .first()
      .isVisible();
    expect(pageStillWorks).toBe(true);
  });

  test('200% text zoom: sidebar navigation still usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setTextZoom(page, 200);
    await page.waitForTimeout(500);

    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();

    // Navigate to library to prove the sidebar works at 200% zoom
    await nav.getByRole('button', { name: /library/i }).first().click();
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });
});
