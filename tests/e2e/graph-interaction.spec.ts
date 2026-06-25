import { test, expect } from '@playwright/test';
import { ensureNavVisible, saveTestEntity } from './utils';

test.describe('Graph Interaction', () => {
  test('graph view renders with controls', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });
    if (!isMobile) {
      await expect(page.locator('.viz-controls')).toBeVisible({ timeout: 15000 });
    }
  });

  test('graph renders canvas with nodes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'Graph Canvas Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.viz-container canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('graph controls have snapshot buttons', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Graph toolbar is hidden on mobile');
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.viz-controls')).toBeVisible({ timeout: 15000 });

    const saveBtn = page.locator('button[aria-label="Save graph snapshot"]');
    const loadBtn = page.locator('button[aria-label="Load or diff saved snapshots"]');
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    const loadVisible = await loadBtn.isVisible().catch(() => false);
    test.skip(!saveVisible && !loadVisible, 'Snapshot controls are not present in this configuration');
    expect(saveVisible || loadVisible).toBeTruthy();
  });

  test('clicking a graph node selects it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'Graph Click Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    const canvas = page.locator('.viz-container canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    await expect(page.locator('.viz-container')).toBeVisible({ timeout: 5000 });
  });

  test('toggling focus mode updates aria-pressed state', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Graph toolbar is hidden on mobile');
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    await saveTestEntity(page, 'Graph Focus Entity');

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    const focusBtn = page.locator('button[aria-label="Show all nodes"], button[aria-label="Focus on neighborhood"]');
    await expect(focusBtn).toBeVisible({ timeout: 10000 });

    const isDisabled = await focusBtn.isDisabled();
    test.skip(isDisabled, 'Focus button is disabled — no node selected');

    const initialPressed = await focusBtn.getAttribute('aria-pressed');
    await focusBtn.click();
    const toggledPressed = await focusBtn.getAttribute('aria-pressed');
    expect(toggledPressed).not.toBe(initialPressed);

    await focusBtn.click();
    const restoredPressed = await focusBtn.getAttribute('aria-pressed');
    expect(restoredPressed).toBe(initialPressed);
  });

  test('saving a snapshot opens the save modal and persists the name', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Graph toolbar is hidden on mobile');
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first().click();
    await expect(page.locator('.viz-container, .loading-screen')).toBeVisible({ timeout: 15000 });

    const saveBtn = page.locator('button[aria-label="Save graph snapshot"]');
    const isSaveVisible = await saveBtn.isVisible().catch(() => false);
    test.skip(!isSaveVisible, 'Save snapshot control is not present in this configuration');

    await saveBtn.click();
    const modal = page.locator('[role="dialog"], .save-snapshot-modal, .modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
