import { test, expect } from '@playwright/test';
import type { ValidatedEntity } from '../src/lib/studio/schema';
import { navClick, viewHeading } from './helpers/navigation';
import { seedStore } from './helpers/store';

/**
 * Library windowed-rendering spec (plans/122 W3).
 *
 * Seeds 120 entities through the shared store fixture (helpers/store.ts), so
 * the Library is both over the LIBRARY_INITIAL_LIMIT cap (24) and the
 * VIRTUALIZE_THRESHOLD (64), forcing the windowed path in a real browser
 * (measurable container).
 *
 * Locators are role-scoped (heading for grid cards, button for table rows)
 * because the right panel renders the same entity names as suggestion buttons.
 */

/**
 * Generates `count` entities with names Entity 0 … Entity N-1.
 *
 * Annotated with the app's own validated entity type, so a schema change that
 * outlaws these records fails at the seed rather than as a library that
 * unexpectedly renders the demo corpus instead of the seeded entities.
 */
const makeEntities = (count: number): ValidatedEntity[] =>
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

/** The library list/grid scroll container (SCROLL_CONTAINER_CLASS). */
const scroller = (page: import('@playwright/test').Page) =>
  page.locator('[class*="max-h-[65vh]"]');

test.describe('Library windowed rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Entities replace the seed library; claims are emptied so no seed claim
    // refers to an entity id that the seeded corpus does not contain.
    await seedStore(page, { entities: makeEntities(120), claims: [] });
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(viewHeading(page, /library/i)).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Open Entity 0', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Entity 119', exact: true })).toHaveCount(0);

    // Only a window of rows exists in the DOM (not all 120).
    const table = scroller(page).getByRole('table');
    const mounted = await table.getByRole('button', { name: /open entity/i }).count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(60);

    // Scrolling mounts later rows.
    await scroller(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('button', { name: 'Open Entity 119', exact: true })).toBeVisible();
  });

  for (const key of ['Enter', ' '] as const) {
    test(`list row opens the entity with the ${key === ' ' ? 'Space' : key} key`, async ({ page }) => {
      await page.getByRole('button', { name: 'List view' }).click();
      await page.getByRole('button', { name: /Show all 120 entities/ }).click();

      const openButton = page.getByRole('button', { name: 'Open Entity 0', exact: true });
      // The DOM's own answer to "is this in the sequential tab order": native
      // focusability minus any negative tabindex (-1, -2, …). `focus()` below
      // would succeed even for a `tabindex="-1"` button, so this is what keeps
      // the test honest about keyboard reachability.
      expect(await openButton.evaluate((el) => (el as HTMLElement).tabIndex)).toBeGreaterThanOrEqual(0);
      await openButton.focus();
      // Assert focus before pressing: if it landed elsewhere, Space would scroll
      // the page instead, and the test would fail later for the wrong reason
      // (a timeout on the editor assertion rather than "the button never got
      // focus").
      await expect(openButton).toBeFocused();
      // Native button activation — the row's onKeyDown handlers were removed in
      // #861, so this passes only if Enter/Space ride the platform behaviour.
      await page.keyboard.press(key);

      await expect(page.getByLabel('Entity name')).toHaveValue('Entity 0');
    });
  }
});
