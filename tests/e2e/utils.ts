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
    }
  }
}
