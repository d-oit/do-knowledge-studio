import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('View Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.layout-container', { timeout: 15000 });
  });

  test('Editor view renders on initial load', async ({ page }) => {
    // Editor should be visible on initial load
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('Graph view renders when navigated', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Graph")').first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('Mind Map view renders when navigated', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Mind Map")').first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('Chat view renders when navigated', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Chat")').first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('Export view renders when navigated', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Export")').first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('Search view renders when navigated', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.click('button[aria-label="Open search"]');
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible({ timeout: 10000 });
    } else {
      await ensureNavVisible(page);
      await page.locator('.nav-button:visible:has-text("Search")').first().click();
      await expect(page.locator('.search-sidebar')).toBeVisible({ timeout: 10000 });
    }
  });
});
