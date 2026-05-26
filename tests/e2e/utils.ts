import { Page } from '@playwright/test';

/**
 * Ensures the navigation menu is visible on responsive layouts.
 * If the navigation buttons are not visible, it attempts to click the 'Open menu' button.
 */
export async function ensureNavVisible(page: Page) {
  const navButton = page.locator('.nav-button').filter({ hasText: 'Editor' });
  if (!(await navButton.isVisible())) {
    const menuButton = page.getByLabel('Open menu');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Wait for the drawer to fully open to prevent pointer intercept errors
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Ensures the navigation menu is hidden on mobile layouts after use.
 * This prevents the drawer overlay from intercepting pointer events.
 */
export async function closeNav(page: Page) {
  const menuButton = page.getByLabel('Close menu');
  if (await menuButton.isVisible()) {
    await menuButton.click();
    // Wait for the drawer to fully close
    await page.waitForTimeout(500);
  }
}
