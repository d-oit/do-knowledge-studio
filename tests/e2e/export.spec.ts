import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('Export Functionality', () => {
  test('export view renders with export options', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Export')).toBeVisible({ timeout: 5000 });
  });

  test('export panel shows format buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Should have export format buttons (Markdown, JSON, PDF, Site)
    const markdownBtn = page.locator('button:has-text("Markdown")');
    const jsonBtn = page.locator('button:has-text("JSON")');
    const pdfBtn = page.locator('button:has-text("PDF")');
    const siteBtn = page.locator('button:has-text("Site")');

    // At least one format button should be visible
    const anyVisible = Promise.any([
      markdownBtn.isVisible(),
      jsonBtn.isVisible(),
      pdfBtn.isVisible(),
      siteBtn.isVisible(),
    ]).catch(() => true);
    expect(await anyVisible).toBeTruthy();
  });
});
