import { test, expect } from '@playwright/test';

test.describe('Production Smoke Test', () => {
  test('should boot and allow core navigation', async ({ page, isMobile }) => {
    // Go to the home page
    await page.goto('/');

    // Verify the app container is visible (using layout-container as per App.tsx)
    const layout = page.locator('.layout-container');
    // Wait longer for boot to complete in CI environment
    await expect(layout).toBeVisible({ timeout: 15000 });

    // Check for responsive state and open menu if needed
    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    // Verify core navigation buttons are present
    const navButtons = page.locator('.nav-button');
    await expect(navButtons.first()).toBeVisible();

    // Verify Cross-Origin headers on the main document
    const response = await page.request.get('/');
    const headers = response.headers();

    // In production mode (vite preview), headers should be present
    if (process.env.PLAYWRIGHT_MODE === 'production') {
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
    }

    // Perform a core navigation: click 'Graph'
    const graphButton = page.getByRole('button', { name: /graph/i }).first();
    await graphButton.click();

    // Verify navigation state
    await expect(graphButton).toHaveAttribute('aria-current', 'page');
    await expect(graphButton).toHaveClass(/active/);

    // Verify we reached the graph view area
    await expect(page.locator('.main-content')).toBeVisible();
  });
});
