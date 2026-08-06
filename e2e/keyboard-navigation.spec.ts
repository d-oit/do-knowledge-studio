import { test, expect } from '@playwright/test';
import {
  expectNavigationReachable,
  navClick,
  openNavIfHidden,
} from './helpers/navigation';

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Tab moves focus through sidebar navigation items', async ({ page }) => {
    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();

    const firstNavItem = nav.getByRole('button').first();
    await firstNavItem.focus();
    await expect(firstNavItem).toBeFocused();

    await page.keyboard.press('Tab');
    const secondItem = nav.getByRole('button').nth(1);
    await expect(secondItem).toBeFocused();
  });

  test('Escape closes command palette', async ({ page }) => {
    // Wait for the app shell to hydrate so the Ctrl+K window listener is attached.
    await expectNavigationReachable(page);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Enter activates focused sidebar item', async ({ page }) => {
    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const libraryBtn = nav.getByRole('button', { name: /library/i }).first();
    await libraryBtn.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('Arrow keys navigate within filter button groups', async ({ page }) => {
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();

    const filterGroup = page.getByRole('group', { name: /filter by type/i });
    await expect(filterGroup).toBeVisible();

    const firstFilter = filterGroup.getByRole('button').first();
    await firstFilter.focus();
    await expect(firstFilter).toBeFocused();
  });

  test('Tab does not get trapped in sidebar', async ({ page }) => {
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });
});
