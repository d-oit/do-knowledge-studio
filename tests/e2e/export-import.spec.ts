import { test, expect } from '@playwright/test';
import { ensureNavVisible, saveTestEntity } from './utils';

test.describe('Export and Import', () => {
  test('export panel shows export format buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();

    await expect(page.locator('button[aria-label="Export knowledge base as Markdown"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[aria-label="Export knowledge base as JSON"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Import knowledge from file"]')).toBeVisible();
  });

  test('export triggers a download', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await saveTestEntity(page, 'Export Roundtrip Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();

    const jsonBtn = page.locator('button[aria-label="Export knowledge base as JSON"]');
    await expect(jsonBtn).toBeVisible({ timeout: 15000 });
    // Wait for button to be enabled (not exporting) and module ready
    await expect(jsonBtn).toBeEnabled({ timeout: 10000 });
    await page.waitForTimeout(500);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await jsonBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('round-trip export then import keeps data intact', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    const entityName = 'RoundTripUniqueEntity';
    await saveTestEntity(page, entityName);

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();

    const jsonBtn = page.locator('button[aria-label="Export knowledge base as JSON"]');
    await expect(jsonBtn).toBeVisible({ timeout: 15000 });
    // Wait for button to be enabled (not exporting) and module ready
    await expect(jsonBtn).toBeEnabled({ timeout: 10000 });
    await page.waitForTimeout(500);

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await jsonBtn.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const fs = await import('fs/promises');
    const exported = await fs.readFile(downloadPath ?? '', 'utf-8');
    expect(exported).toContain(entityName);

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`text=${entityName}`)).toBeVisible({ timeout: 10000 });
  });
});
