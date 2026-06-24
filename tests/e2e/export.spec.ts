import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('Export Functionality', () => {
  test('export view renders with export options', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.main-content >> text=Export').first()).toBeVisible({ timeout: 5000 });
  });

  test('export panel shows format buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();
    // Wait for the lazy-loaded export panel to fully render
    const markdownBtn = page.locator('button:has-text("Export as Markdown")');
    await expect(markdownBtn).toBeVisible({ timeout: 15000 });
  });
});
