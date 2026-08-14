import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

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

  test('control buttons expose matching tooltips', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('something');

    await expect(page.getByRole('button', { name: /clear search/i })).toHaveAttribute('title', 'Clear search');
    await expect(page.getByRole('button', { name: /grid view/i })).toHaveAttribute('title', 'Grid view');
    await expect(page.getByRole('button', { name: /list view/i })).toHaveAttribute('title', 'List view');

    // The sort toggle's tooltip tracks its state, matching the aria-label.
    // The store defaults to descending order on first load.
    const sortBtn = page.getByRole('button', { name: /sort (ascending|descending)/i });
    await expect(sortBtn).toHaveAttribute('title', 'Sort descending');
    await sortBtn.click();
    await expect(sortBtn).toHaveAttribute('title', 'Sort ascending');
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
