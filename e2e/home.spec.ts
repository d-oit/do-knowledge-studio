import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads and shows the correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });

  test('sidebar navigation is visible', async ({ page }) => {
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible();
  });

  test('can navigate to library view', async ({ page }) => {
    await page.getByRole('button', { name: /library/i }).click();
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('can navigate to graph view', async ({ page }) => {
    await page.getByRole('button', { name: /graph/i }).click();
    await expect(page.locator('[data-testid="graph-view"]')).toBeVisible();
  });

  test('can navigate to mindmap view', async ({ page }) => {
    await page.getByRole('button', { name: /mind\s?map/i }).click();
    await expect(page.locator('[data-testid="mindmap-view"]')).toBeVisible();
  });
});
