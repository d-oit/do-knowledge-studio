import { test, expect } from '@playwright/test';
import { expectNavigationReachable, navClick, openNavIfHidden } from './helpers/navigation';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads and shows the correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });

  test('navigation is reachable (sidebar on desktop, drawer trigger below lg)', async ({ page }) => {
    await expectNavigationReachable(page);
  });

  test('home view shows greeting or welcome content', async ({ page }) => {
    // The home view always renders a "Recent work" section (empty state or list).
    // Scoped by role so the sidebar label (hidden on mobile) never matches.
    await expect(page.getByRole('heading', { name: /recent work/i })).toBeVisible();
  });

  test('can navigate to library view', async ({ page }) => {
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('can navigate to graph view', async ({ page }) => {
    await navClick(page, /graph/i);
    const graphContent = page.getByRole('img', { name: /knowledge graph/i }).or(
      page.getByText(/no data|no entities|empty/i),
    );
    await expect(graphContent).toBeVisible();
  });

  test('can navigate to mindmap view', async ({ page }) => {
    await navClick(page, /mind\s?map/i);
    await expect(page.getByRole('heading', { name: /mind map/i })).toBeVisible();
    // Mindmap renders an SVG canvas inside the main content area
    const canvas = page.locator('#main-content svg, #main-content canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('can navigate to editor view', async ({ page }) => {
    await navClick(page, /editor/i);
    const editorContent = page.locator('#entity-name, [aria-label="Editor content"]').first();
    await expect(editorContent).toBeVisible();
  });

  test('can navigate to export view', async ({ page }) => {
    await navClick(page, /export/i);
    await expect(page.getByRole('heading', { name: 'Export', exact: true })).toBeVisible();
  });

  test('sidebar shows all navigation groups', async ({ page }) => {
    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByText('Overview')).toBeVisible();
    await expect(nav.getByText('Capture')).toBeVisible();
    await expect(nav.getByText('Explore')).toBeVisible();
  });

  test('active nav item has aria-current="page"', async ({ page }) => {
    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const homeBtn = nav.getByRole('button', { name: /home/i }).first();
    await expect(homeBtn).toHaveAttribute('aria-current', 'page');

    await navClick(page, /library/i);

    // The mobile drawer closes after navigating; reopen it (no-op on desktop)
    // and re-query both buttons from the same post-reopen nav locator so the
    // assertions never couple to the pre-navigation drawer instance.
    await openNavIfHidden(page);
    const reopenedNav = page.getByRole('navigation', { name: /main navigation/i });
    const libraryBtn = reopenedNav.getByRole('button', { name: /library/i }).first();
    const reopenedHomeBtn = reopenedNav.getByRole('button', { name: /home/i }).first();
    await expect(libraryBtn).toHaveAttribute('aria-current', 'page');
    await expect(reopenedHomeBtn).not.toHaveAttribute('aria-current', 'page');
  });
});
