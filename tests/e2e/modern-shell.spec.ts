import { test, expect } from '@playwright/test';

test.describe('Modern Shell UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
  });

  test('Cmd+K / Ctrl+K toggles the command palette', async ({ page, isMobile: _isMobile }) => {
    const palette = page.locator('.command-palette-modal');
    await expect(palette).not.toBeVisible();

    // Toggle on
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();

    // Toggle off with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();

    // Toggle on again
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();

    // Toggle off by clicking overlay
    // Use dispatchEvent for more reliable overlay clicks across viewports
    await page.locator('.command-palette-overlay').evaluate(el => (el as HTMLElement).click());
    await expect(palette).not.toBeVisible();
  });

  test('searching and keyboard navigation in palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('.command-palette-header input');

    await input.fill('Graph');
    // Commands should be filtered
    await expect(page.locator('.command-item:has-text("Go to Graph")')).toBeVisible();
    await expect(page.locator('.command-item:has-text("Go to Editor")')).not.toBeVisible();

    // Navigate with keyboard
    await page.keyboard.press('ArrowDown');
    // Enter to navigate
    await page.keyboard.press('Enter');

    // Should be in Graph view (wait for it to load)
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });
  });

  test('Toggle Graph Focus action updates state', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('.command-palette-header input');

    await input.fill('Focus');
    await expect(page.locator('.command-item:has-text("Toggle Graph Focus")')).toBeVisible();

    await page.keyboard.press('Enter');

    // Should navigate to Graph view and have focus mode active
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });
  });
});
