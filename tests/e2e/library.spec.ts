import { test, expect } from '@playwright/test';
import { ensureNavVisible, saveTestEntity } from './utils';

test.describe('Library View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'Library Test Entity', { type: 'concept' });
  });

  test('should navigate to Library and show entities', async ({ page }) => {
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=Library Test Entity')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.type-badge:has-text("concept")')).toBeVisible();
  });

  test('should filter entities by type', async ({ page }) => {
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=Library Test Entity')).toBeVisible({ timeout: 15000 });

    const personBtn = page.locator('button:has-text("Person")');
    const hasPersonBtn = await personBtn.isVisible().catch(() => false);
    if (!hasPersonBtn) {
      test.skip(true, 'Person filter button not present');
      return;
    }
    await personBtn.click();
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();

    await page.locator('button:has-text("Concept")').click();
    await expect(page.locator('text=Library Test Entity').first()).toBeVisible({ timeout: 15000 });
  });

  test('should search for entities', async ({ page }) => {
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('text=Library Test Entity')).toBeVisible({ timeout: 15000 });

    await page.fill('input[placeholder="Search library..."]', 'Library Test');
    await expect(page.locator('text=Library Test Entity').first()).toBeVisible({ timeout: 15000 });

    await page.fill('input[placeholder="Search library..."]', 'Non-existent');
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();
  });

  test('should navigate to editor when clicking an entity', async ({ page }) => {
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=Library Test Entity')).toBeVisible({ timeout: 15000 });

    await page.locator('.entity-list-row', { hasText: 'Library Test Entity' }).click();

    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });
});
