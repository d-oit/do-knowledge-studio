import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Search Navigation', () => {
  test('command palette search navigates to entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'Search Test Entity');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Open command palette and search
    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette-modal')).toBeVisible();
    await page.fill('.command-palette-header input', 'Search Test');
    await expect(page.locator('.command-item:has-text("Search Test Entity")')).toBeVisible({ timeout: 10000 });
    await page.locator('.command-item:has-text("Search Test Entity")').click();

    // Should navigate to editor
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });

  test('search sidebar shows entity results', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Create entity
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'Sidebar Search Test');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Search sidebar should show results
    const searchSidebar = page.locator('.search-sidebar');
    await expect(searchSidebar).toBeVisible();
    const searchInput = searchSidebar.locator('input[type="text"]');
    await searchInput.fill('Sidebar Search');
    await expect(searchSidebar.locator('text=Sidebar Search Test')).toBeVisible({ timeout: 10000 });
  });
});
