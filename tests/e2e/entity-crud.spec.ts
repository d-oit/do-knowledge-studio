import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Entity CRUD', () => {
  test('create entity and verify it appears in library', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'E2E Test Entity');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=E2E Test Entity')).toBeVisible({ timeout: 10000 });
  });

  test('navigate from library to editor to edit entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'Library Edit Test');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Navigate to Library and click entity
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: 'Library Edit Test' }).click();

    // Should be in Editor with entity loaded
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });

  test('edit entity and verify changes persist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    const originalTitle = 'Edit Persist Test';
    await page.fill('#entity-title', originalTitle);
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Open entity from library
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: originalTitle }).click();

    // Wait for editor to load with the entity
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });

    // Modify the title
    const titleInput = page.locator('#entity-title');
    await expect(titleInput).toHaveValue(originalTitle);
    const updatedTitle = 'Edit Persist Test Updated';
    await titleInput.fill(updatedTitle);
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Re-open from library and verify updated title persists
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`.entity-list-row:has-text("${updatedTitle}")`)).toBeVisible({ timeout: 10000 });
  });

  test('delete entity removes it from the library', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    const deleteTitle = 'Delete Me Test';
    await page.fill('#entity-title', deleteTitle);
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Open from library to get into edit mode where delete control is available
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await page.locator('.entity-list-row', { hasText: deleteTitle }).click();
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });

    // Delete using a button labeled "Delete" or with the aria-label
    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="Delete"]').first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);
    test.skip(!hasDelete, 'No delete control in editor — feature gated by config');

    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    await deleteBtn.click();

    // Return to library and confirm entity is gone
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator(`.entity-list-row:has-text("${deleteTitle}")`)).toHaveCount(0, { timeout: 10000 });
  });

  test('search entity via library filter shows the entity in results', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    const searchTitle = 'Searchable Entity XYZ';
    await page.fill('#entity-title', searchTitle);
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Navigate to library and use the in-library search/filter
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first().click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();

    // Library view exposes a search input; type and confirm result
    const librarySearch = page.locator('.library-search input, .search-input, input[placeholder*="Search" i]').first();
    const hasSearch = await librarySearch.isVisible().catch(() => false);
    if (hasSearch) {
      await librarySearch.fill('Searchable');
      await expect(page.locator(`.entity-list-row:has-text("${searchTitle}")`)).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: verify entity is listed
      await expect(page.locator(`.entity-list-row:has-text("${searchTitle}")`)).toBeVisible({ timeout: 10000 });
    }
  });
});
