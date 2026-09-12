import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

test.describe('Timeline view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('is reachable from the main navigation', async ({ page }) => {
    await navClick(page, /timeline/i);
    // Scoped to the main content area: the topbar shows the same view name.
    const main = page.locator('#main-content');
    await expect(main.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
  });

  test('renders month and day bands from seed data', async ({ page }) => {
    await navClick(page, /timeline/i);
    const main = page.locator('#main-content');

    // Seed entities span at least a month of createdAt dates, so at least one
    // month band (level 2) and one day band (level 3) must render.
    await expect(main.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(main.getByRole('heading', { level: 3 }).first()).toBeVisible();

    // Markers are interactive buttons that open the owning entity in the editor.
    const markers = main.getByRole('button', { name: /^Open .* in editor$/ });
    expect(await markers.count()).toBeGreaterThan(0);
  });
});