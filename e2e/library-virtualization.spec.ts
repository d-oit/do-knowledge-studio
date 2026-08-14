import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Library windowed-rendering spec (plans/122 W3).
 *
 * Seeds 120 entities through the Zustand persist envelope so the Library is
 * both over the LIBRARY_INITIAL_LIMIT cap (24) and the VIRTUALIZE_THRESHOLD
 * (64), forcing the windowed path in a real browser (measurable container).
 *
 * Locators are role-scoped (heading for grid cards, link for table rows)
 * because the right panel renders the same entity names as suggestion buttons.
 */

/** Must match CURRENT_SCHEMA_VERSION in src/lib/studio/migrations.ts. */
const SCHEMA_VERSION = 5;

/** Persist key used by the Zustand store (name option in store.ts). */
const STORE_KEY = 'do-knowledge-studio-store';

/** Generates `count` entities with names Entity 0 … Entity N-1. */
const makeEntities = (count: number): object[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `seed-${i}`,
    name: `Entity ${i}`,
    type: 'note',
    description: `Seeded entity ${i} for virtualization coverage`,
    content: '',
    tags: ['seed'],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-15T00:00:00Z',
    links: [],
  }));

const SEED_ENVELOPE = {
  state: {
    entities: makeEntities(120),
    claims: [],
    graph: undefined,
    mindMap: undefined,
    links: undefined,
    tags: undefined,
  },
  version: SCHEMA_VERSION,
};

/** The library list/grid scroll container (SCROLL_CONTAINER_CLASS). */
const scroller = (page: import('@playwright/test').Page) =>
  page.locator('[class*="max-h-[65vh]"]');

test.describe('Library windowed rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ storeKey, envelope }) => {
        localStorage.setItem(storeKey, JSON.stringify(envelope));
      },
      { storeKey: STORE_KEY, envelope: SEED_ENVELOPE },
    );
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('grid caps at 24 then windows the expanded list', async ({ page }) => {
    // Default grid renders the first 24 cards only.
    await expect(page.getByRole('heading', { name: 'Entity 0', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entity 23', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entity 24', exact: true })).toHaveCount(0);
    await expect(page.getByText(/Showing 24 of 120 entities/).first()).toBeVisible();

    // Expand: windowed rendering mounts only the visible window, not all 120.
    await page.getByRole('button', { name: /Show all 120 entities/ }).click();
    await expect(page.getByText(/Showing 120 of 120 entities/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entity 119', exact: true })).toHaveCount(0);

    // Scrolling the grid container mounts later windows and unmounts the first.
    await scroller(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('heading', { name: 'Entity 119', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entity 0', exact: true })).toHaveCount(0);
  });

  test('list view windows rows and mounts more on scroll', async ({ page }) => {
    await page.getByRole('button', { name: 'List view' }).click();
    // Expand past the 24-cap so the table gets the full 120 entities and the
    // windowed path activates (120 > VIRTUALIZE_THRESHOLD).
    await page.getByRole('button', { name: /Show all 120 entities/ }).click();

    // Windowed table: far rows are not mounted.
    await expect(page.getByRole('link', { name: 'Open Entity 0', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Entity 119', exact: true })).toHaveCount(0);

    // Only a window of rows exists in the DOM (not all 120).
    const table = scroller(page).getByRole('table');
    const mounted = await table.getByRole('link').count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(60);

    // Scrolling mounts later rows.
    await scroller(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('link', { name: 'Open Entity 119', exact: true })).toBeVisible();
  });
});
