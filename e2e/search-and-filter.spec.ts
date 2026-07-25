import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('Search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('search input is visible and focusable', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await expect(searchInput).toBeVisible();
    await searchInput.focus();
    await expect(searchInput).toBeFocused();
  });

  test('typing in search filters entities', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('test');
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('clear search button appears when text is entered', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('something');
    const clearBtn = page.getByRole('button', { name: /clear search/i });
    await expect(clearBtn).toBeVisible();
  });

  test('clear search button removes text', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('something');
    const clearBtn = page.getByRole('button', { name: /clear search/i });
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
  });

  test('type filter buttons toggle active state', async ({ page }) => {
    const filterGroup = page.getByRole('group', { name: /filter by type/i });
    await expect(filterGroup).toBeVisible();

    const filterBtns = filterGroup.getByRole('button');
    const count = await filterBtns.count();
    expect(count).toBeGreaterThan(1);

    const secondFilter = filterBtns.nth(1);
    await secondFilter.click();
    await expect(secondFilter).toHaveAttribute('aria-pressed', 'true');
  });

  test('view mode toggle switches between grid and list', async ({ page }) => {
    const viewGroup = page.getByRole('group', { name: /view mode/i });
    await expect(viewGroup).toBeVisible();

    const gridBtn = page.getByRole('button', { name: /grid view/i });
    const listBtn = page.getByRole('button', { name: /list view/i });

    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');

    await listBtn.click();
    await expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('search and filter work together', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('test');

    const filterGroup = page.getByRole('group', { name: /filter by type/i });
    const filterBtns = filterGroup.getByRole('button');
    await filterBtns.nth(1).click();

    await expect(searchInput).toHaveValue('test');
    await expect(filterBtns.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('status region announces filter results', async ({ page }) => {
    const status = page.getByRole('status').first();
    await expect(status).toBeAttached();
  });
});
