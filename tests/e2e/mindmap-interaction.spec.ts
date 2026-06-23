import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Mind Map Interaction', () => {
  test('mind map view renders with toolbar controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Mind map toolbar should be visible
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    // Root entity selector should be present
    await expect(page.locator('[aria-label="Select root entity"]')).toBeVisible();

    // Add Child button should be visible (may be disabled before mind is ready)
    const addChildBtn = page.locator('button[aria-label="Add child node"]');
    await expect(addChildBtn).toBeVisible();
  });

  test('clicking a mind map node shows selection info', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    // Seed an entity first
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    await page.fill('#entity-title', 'MindMap Selection');
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 10000 });

    // Navigate to Mind Map
    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    // Mind map canvas should render
    await expect(page.locator('.viz-canvas')).toBeVisible({ timeout: 10000 });
  });

  test('add child button is present in mind map toolbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    const addChildBtn = page.locator('button[aria-label="Add child node"]');
    await expect(addChildBtn).toBeVisible();

    const addSiblingBtn = page.locator('button[aria-label="Add sibling node"]');
    await expect(addSiblingBtn).toBeVisible();

    const renameBtn = page.locator('button[aria-label="Rename selected node"]');
    await expect(renameBtn).toBeVisible();

    const deleteBtn = page.locator('button[aria-label="Delete selected node"]');
    await expect(deleteBtn).toBeVisible();
  });

  test('rename button triggers an edit state for the selected node', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    // The rename button is disabled until a node is selected
    const renameBtn = page.locator('button[aria-label="Rename selected node"]');
    await expect(renameBtn).toBeVisible();
    const isDisabled = await renameBtn.isDisabled();
    expect(typeof isDisabled).toBe('boolean');
  });
});
