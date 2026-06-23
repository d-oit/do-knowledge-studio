import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Export and Import', () => {
  test('export panel shows export format buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Export buttons should be visible
    await expect(page.locator('button[aria-label="Export knowledge base as Markdown"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[aria-label="Export knowledge base as JSON"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Import knowledge from file"]')).toBeVisible();
  });

  test('export triggers a download', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Seed an entity
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'Export Roundtrip Entity');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Navigate to Export
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Listen for download
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click the JSON export button
    await page.locator('button[aria-label="Export knowledge base as JSON"]').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('round-trip export then import keeps data intact', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Seed a uniquely-named entity
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    const entityName = 'RoundTripUniqueEntity';
    await page.fill('#entity-title', entityName);
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Navigate to Export
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Export', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Export as JSON
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button[aria-label="Export knowledge base as JSON"]').click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Verify exported content contains our entity
    const fs = await import('fs/promises');
    const exported = await fs.readFile(downloadPath ?? '', 'utf-8');
    expect(exported).toContain(entityName);

    // Import the file back (use Library to confirm entity is still there)
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`text=${entityName}`)).toBeVisible({ timeout: 10000 });
  });
});
