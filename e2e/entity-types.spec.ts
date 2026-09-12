import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

test.describe('Entity types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('library exposes the built-in entity type filters', async ({ page }) => {
    const filterGroup = page.getByRole('group', { name: /filter by type/i });
    await expect(filterGroup).toBeVisible();

    for (const label of [/Notes/i, /Concepts/i, /People/i, /Projects/i]) {
      await expect(filterGroup.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('library grid renders built-in entity type labels', async ({ page }) => {
    const grid = page.getByRole('main');
    // Seed entities cover the built-in types; their type labels render on cards.
    await expect(grid.getByText('Note').first()).toBeVisible();
    await expect(grid.getByText('Concept').first()).toBeVisible();
  });
});