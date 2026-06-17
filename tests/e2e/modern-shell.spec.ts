import { test, expect } from '@playwright/test';

test.describe('Modern Shell UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    // Ensure palette is fully hidden before test
    await expect(page.locator('.command-palette-modal')).not.toBeVisible({ timeout: 5000 });
  });

  test('Cmd+K / Ctrl+K toggles the command palette', async ({ page, isMobile: _isMobile }) => {
    const palette = page.locator('.command-palette-modal');
    await expect(palette).not.toBeVisible();

    // Ensure page body has focus before sending keyboard shortcut
    await page.locator('body').click();
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await expect(page.locator('.command-palette-header input')).toBeFocused({ timeout: 5000 });

    // Toggle off with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible({ timeout: 5000 });

    // Toggle on again
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await expect(page.locator('.command-palette-header input')).toBeFocused({ timeout: 5000 });

    // Toggle off by clicking overlay — use Playwright click, not evaluate()
    await page.locator('.command-palette-overlay').click({ position: { x: 10, y: 10 } });
    await expect(palette).not.toBeVisible({ timeout: 5000 });
  });

  test('searching and keyboard navigation in palette', async ({ page }) => {
    await page.locator('body').click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette-modal')).toBeVisible();
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
    await page.locator('body').click();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette-modal')).toBeVisible();
    const input = page.locator('.command-palette-header input');

    await input.fill('Focus');
    await expect(page.locator('.command-item:has-text("Toggle Graph Focus")')).toBeVisible();

    await page.keyboard.press('Enter');

    // Should navigate to Graph view and have focus mode active
    await expect(page.locator('.sigma-container, .loading-screen')).toBeVisible({ timeout: 15000 });
  });
});
