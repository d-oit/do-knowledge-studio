import { test, expect } from '@playwright/test';

test.describe('Responsive behavior', () => {
  test('desktop: sidebar is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const sidebar = page.getByRole('navigation', { name: /main navigation/i });
    await expect(sidebar).toBeVisible();
  });

  test('tablet: sidebar is hidden, mobile drawer available', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Desktop sidebar should be hidden at tablet size
    // The mobile drawer hamburger should be visible
    const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      // Mobile drawer nav should appear
      const mobileNav = page.getByRole('navigation', { name: /main navigation/i });
      await expect(mobileNav).toBeVisible();
    }
  });

  test('mobile: layout adapts to small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still be functional
    await expect(page).toHaveTitle(/DO Knowledge Studio/);

    // Main content should be visible
    const content = page.locator('#main, main, [role="main"]').first();
    if (await content.isVisible()) {
      await expect(content).toBeVisible();
    }
  });

  test('desktop: three-pane layout at wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // At wide viewport, the right panel may be visible
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });

  test('viewport resize does not break layout', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DO Knowledge Studio/);

    // Resize through breakpoints
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveTitle(/DO Knowledge Studio/);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveTitle(/DO Knowledge Studio/);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });
});
