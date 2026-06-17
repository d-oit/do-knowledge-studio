import { Page, expect } from '@playwright/test';

/**
 * Ensures the navigation menu is visible on responsive layouts.
 * If the navigation buttons are not visible, it clicks the 'Open menu' button
 * and waits for the drawer to fully open via DOM assertion.
 */
export async function ensureNavVisible(page: Page) {
  const navButton = page.locator('.nav-button').filter({ hasText: 'Editor' });
  if (await navButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }
  const menuButton = page.getByLabel('Open menu');
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    await expect(page.getByLabel('Close menu')).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Ensures the navigation menu is hidden on mobile layouts after use.
 * Waits for the drawer to be removed from DOM instead of a hard timeout.
 */
export async function closeNav(page: Page) {
  const menuButton = page.getByLabel('Close menu');
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    await expect(page.getByLabel('Close menu')).not.toBeVisible({ timeout: 5000 });
  }
}
