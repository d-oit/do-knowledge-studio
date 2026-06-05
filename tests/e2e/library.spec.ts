import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Library View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to be ready
    await expect(page.locator('.brand')).toContainText('Knowledge Studio');

    // Create some test data via Editor
    await ensureNavVisible(page);
    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('input[placeholder="Entity Name (e.g. TRIZ)"]', 'Library Test Entity');
    await page.selectOption('select', 'concept');
    // Wait for tiptap editor to fully initialize (useEditor hook returns non-null)
    await expect(page.locator('.tiptap-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });
  });

  test('should navigate to Library and show entities', async ({ page }) => {
    await ensureNavVisible(page);
    const libBtn = page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first();
    await libBtn.click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=Library Test Entity')).toBeVisible();
    await expect(page.locator('.type-badge:has-text("concept")')).toBeVisible();
  });

  test('should filter entities by type', async ({ page }) => {
    await ensureNavVisible(page);
    const libBtn = page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first();
    await libBtn.click();

    // Filter by 'Person' - should be empty
    await page.click('.filter-chip:has-text("Person")');
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();
    await expect(page.locator('text=No entities found matching your filters.')).toBeVisible();

    // Filter by 'Concept' - should show our entity
    await page.click('.filter-chip:has-text("Concept")');
    await expect(page.locator('text=Library Test Entity')).toBeVisible();
  });

  test('should search for entities', async ({ page }) => {
    await ensureNavVisible(page);
    const libBtn = page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first();
    await libBtn.click();

    await page.fill('input[placeholder="Search library..."]', 'Library Test');
    await expect(page.locator('text=Library Test Entity')).toBeVisible();

    await page.fill('input[placeholder="Search library..."]', 'Non-existent');
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();
  });

  // TODO: Fix navigation from Library to Editor - clicking entity doesn't trigger view switch
  test.skip('should navigate to editor when clicking an entity', async ({ page }) => {
    await ensureNavVisible(page);
    const libBtn = page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first();
    await libBtn.click();
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();

    // Click the entity row (click on the entity name text within the virtualized list)
    await page.locator('.entity-name-text', { hasText: 'Library Test Entity' }).click();

    // Should be in Editor now
    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    // Verify the editing indicator appears
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });
});
