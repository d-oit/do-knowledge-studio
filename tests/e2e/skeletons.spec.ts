import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('Skeleton Loaders', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept JS chunks and add delay to ensure skeletons are visible
    await page.route('**/*.js', async route => {
      const url = route.request().url();
      if (url.includes('GraphView') || url.includes('MindMapView') || url.includes('Chat') || url.includes('ExportPanel') || url.includes('AIHarness') || url.includes('Editor') || url.includes('SearchPanel')) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await route.continue();
    });

    await page.goto('/');
    await page.waitForSelector('.layout-container', { timeout: 15000 });
  });

  test('should show EditorSkeleton during initial load', async ({ page }) => {
    const skeleton = page.locator('.skeleton-layout').first();
    await expect(skeleton).toBeAttached();
  });

  test('should show GraphSkeleton when switching to Graph view', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Graph")').first().click();
    const skeletonCircle = page.locator('.skeleton-circle');
    await expect(skeletonCircle.first()).toBeAttached();
  });

  test('should show MindMapSkeleton when switching to Mind Map view', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Mind Map")').first().click();

    // Check for skeleton loader in the main content area
    const container = page.locator('.main-content');
    await expect(container.locator('.skeleton-layout, .empty-state').first()).toBeAttached();
  });

  test('should show AISkeleton when switching to Chat or AI Harness', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Chat")').first().click();
    await expect(page.locator('.skeleton-layout').first()).toBeAttached();

    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("AI Harness")').first().click();
    await expect(page.locator('.skeleton-layout').first()).toBeAttached();
  });

  test('should show ExportSkeleton when switching to Export', async ({ page, isMobile }) => {
    if (isMobile) await ensureNavVisible(page);
    await page.locator('.nav-button:visible:has-text("Export")').first().click();
    await expect(page.locator('.skeleton-layout').first()).toBeAttached();
  });

  test('should show SearchSkeleton in sidebar and mobile overlay', async ({ page, isMobile }) => {
    if (isMobile) {
      // In mobile, click the search icon in header to open overlay
      await page.click('button[aria-label="Open search"]');
      const searchOverlay = page.locator('.mobile-search-overlay');
      await expect(searchOverlay.locator('.skeleton-layout')).toBeAttached();
    } else {
      // Sidebar search is desktop only
      const searchSidebar = page.locator('.search-sidebar');
      await expect(searchSidebar.locator('.skeleton-layout')).toBeAttached();
    }
  });
});
