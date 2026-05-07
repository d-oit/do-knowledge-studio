import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('Production Smoke Test', () => {
  test('should boot and allow core navigation', async ({ page }) => {
    // Go to the home page
    await page.goto('/');

    // Verify the app container is visible (using layout-container as per App.tsx)
    const layout = page.locator('.layout-container');
    // Wait longer for boot to complete in CI environment
    await expect(layout).toBeVisible({ timeout: 15000 });

    // Check for responsive state and open menu if needed
    await ensureNavVisible(page);

    // Verify core navigation buttons are present
    const navButtons = page.locator('.nav-button');
    await expect(navButtons.filter({ visible: true }).first()).toBeVisible();

    // Verify Cross-Origin headers on the main document
    const response = await page.request.get('/');
    const headers = response.headers();

    // In production mode (vite preview), headers should be present
    if (process.env.PLAYWRIGHT_MODE === 'production') {
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
    }

    // Perform a core navigation: click 'Graph'
    const graphButton = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await graphButton.click();

    // Verify we reached the graph view area
    await expect(page.locator('.main-content')).toBeVisible();

    // On mobile/tablet, the menu closes after navigation, so we need to open it again to check the active state
    await ensureNavVisible(page);

    const activeGraphButton = page.locator('.nav-button').filter({ hasText: 'Graph' }).filter({ visible: true }).first();
    await expect(activeGraphButton).toHaveAttribute('aria-current', 'page');
    await expect(activeGraphButton).toHaveClass(/active/);
  });
});
