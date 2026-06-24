import { test, expect } from '@playwright/test';
import { saveTestEntity } from './utils';

test.describe('Search Navigation', () => {
  test('command palette search navigates to entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await saveTestEntity(page, 'Search Test Entity');

    // Extra wait for FTS5 indexing
    await page.waitForTimeout(2000);

    // Open command palette and search
    await page.keyboard.press('Control+k');
    await expect(page.locator('.command-palette-modal')).toBeVisible();
    await page.fill('.command-palette-header input', 'Search Test');
    await expect(page.locator('.command-item:has-text("Search Test Entity")').first()).toBeVisible({ timeout: 15000 });
    await page.locator('.command-item:has-text("Search Test Entity")').first().click();

    await expect(page.locator('.nav-button[aria-current="page"]')).toHaveText('Editor', { timeout: 10000 });
    await expect(page.locator('text=Editing Entity')).toBeVisible({ timeout: 10000 });
  });

  test('search sidebar shows entity results', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Search sidebar is hidden on mobile/tablet');
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await saveTestEntity(page, 'Sidebar Search Test');

    // Extra wait for FTS5 indexing to complete
    await page.waitForTimeout(3000);

    const searchSidebar = page.locator('.search-sidebar');
    await expect(searchSidebar).toBeVisible();
    const searchInput = searchSidebar.locator('input[type="search"]');
    await searchInput.fill('Sidebar Search');
    await expect(searchSidebar.locator('.result-name:has-text("Sidebar Search Test")').first()).toBeVisible({ timeout: 15000 });
  });
});
