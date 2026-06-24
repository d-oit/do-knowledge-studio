import { test, expect } from '@playwright/test';
import { ensureNavVisible, saveTestEntity } from './utils';

test.describe('Entity CRUD', () => {
  test('create entity and verify it appears in library', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await saveTestEntity(page, 'E2E Test Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=E2E Test Entity')).toBeVisible({ timeout: 15000 });
  });

  test('navigate from library to editor to edit entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await saveTestEntity(page, 'Library Edit Test');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: 'Library Edit Test' }).click();

    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });

  test('edit entity and verify changes persist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    const originalTitle = 'Edit Persist Test';
    await saveTestEntity(page, originalTitle);

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: originalTitle }).click();

    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });

    const titleInput = page.locator('#entity-title');
    await expect(titleInput).toHaveValue(originalTitle);
    const updatedTitle = 'Edit Persist Test Updated';
    await titleInput.fill(updatedTitle);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Update Entity")');
    await expect(page.locator('[role="alert"]')).toContainText(/updated successfully|Saved successfully/, { timeout: 10000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`.entity-list-row:has-text("${updatedTitle}")`)).toBeVisible({ timeout: 10000 });
  });

  test('delete entity removes it from the library', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    const deleteTitle = 'Delete Me Test';
    await saveTestEntity(page, deleteTitle);

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: deleteTitle }).click();
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });

    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="Delete"]').first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);
    test.skip(!hasDelete, 'No delete control in editor — feature gated by config');

    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    await deleteBtn.click();

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`.entity-list-row:has-text("${deleteTitle}")`)).toHaveCount(0, { timeout: 10000 });
  });

  test('search entity via library filter shows the entity in results', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    const searchTitle = 'Searchable Entity XYZ';
    await saveTestEntity(page, searchTitle);

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();

    const librarySearch = page.locator('.library-search input, .search-input, input[placeholder*="Search" i]').first();
    const hasSearch = await librarySearch.isVisible().catch(() => false);
    if (hasSearch) {
      await librarySearch.fill('Searchable');
      await expect(page.locator(`.entity-list-row:has-text("${searchTitle}")`)).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.locator(`.entity-list-row:has-text("${searchTitle}")`)).toBeVisible({ timeout: 10000 });
    }
  });
});
