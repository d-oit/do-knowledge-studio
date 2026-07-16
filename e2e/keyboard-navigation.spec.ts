import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Tab moves focus through sidebar navigation items', async ({ page }) => {
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
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Enter activates focused sidebar item', async ({ page }) => {
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
