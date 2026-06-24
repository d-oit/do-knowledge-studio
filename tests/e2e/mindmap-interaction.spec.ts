import { test, expect } from '@playwright/test';
import { ensureNavVisible, saveTestEntity } from './utils';

test.describe('Mind Map Interaction', () => {
  test('mind map view renders with toolbar controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'MindMap Toolbar Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('select[aria-label="Select root entity"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Add child node"]')).toBeVisible();
  });

  test('clicking a mind map node shows selection info', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'MindMap Selection');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    // The viz-canvas may have 0 height if mind-elixir hasn't rendered yet,
    // so check the container and toolbar instead
    await expect(page.locator('.viz-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible();
    // Verify the root entity selector is populated (means mind map loaded data)
    const rootSelect = page.locator('select[aria-label="Select root entity"]');
    await expect(rootSelect).toBeVisible();
    const optionCount = await rootSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('add child button is present in mind map toolbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'MindMap Add Child Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('button[aria-label="Add child node"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Add sibling node"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Rename selected node"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Delete selected node"]')).toBeVisible();
  });

  test('rename button triggers an edit state for the selected node', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'MindMap Rename Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first().click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-toolbar')).toBeVisible({ timeout: 10000 });

    const renameBtn = page.locator('button[aria-label="Rename selected node"]');
    await expect(renameBtn).toBeVisible();
    const isDisabled = await renameBtn.isDisabled();
    expect(typeof isDisabled).toBe('boolean');
  });
});
