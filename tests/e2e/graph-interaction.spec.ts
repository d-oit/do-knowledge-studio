import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Graph Interaction', () => {
  test('graph view renders with controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.graph-controls')).toBeVisible({ timeout: 5000 });
  });

  test('graph renders canvas with nodes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    // Graph canvas should be present
    await expect(page.locator('.sigma-container canvas')).toBeVisible({ timeout: 10000 });
  });

  test('graph controls have snapshot buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    // At least one snapshot button should exist
    const saveBtn = page.locator('button:has-text("Save Snapshot")');
    const loadBtn = page.locator('button:has-text("Load Snapshot")');
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    const loadVisible = await loadBtn.isVisible().catch(() => false);
    expect(saveVisible || loadVisible).toBeTruthy();
  });
});
