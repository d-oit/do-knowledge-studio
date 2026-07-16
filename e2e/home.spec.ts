import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads and shows the correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });

  test('sidebar navigation is visible', async ({ page }) => {
    const sidebar = page.getByRole('navigation', { name: /main navigation/i });
    await expect(sidebar).toBeVisible();
  });

  test('home view shows greeting or welcome content', async ({ page }) => {
    const content = page.locator('text=/welcome|hello|good|recent|home/i').first();
    await expect(content).toBeVisible();
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
    // Mindmap renders an SVG canvas or shows an empty state
    await expect(page.locator('svg, canvas, [role="img"]').first()).toBeVisible();
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
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByText('Overview')).toBeVisible();
    await expect(nav.getByText('Capture')).toBeVisible();
    await expect(nav.getByText('Explore')).toBeVisible();
  });

  test('active nav item has aria-current="page"', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const homeBtn = nav.getByRole('button', { name: /home/i }).first();
    await expect(homeBtn).toHaveAttribute('aria-current', 'page');

    await navClick(page, /library/i);
    const libraryBtn = nav.getByRole('button', { name: /library/i }).first();
    await expect(libraryBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).not.toHaveAttribute('aria-current', 'page');
  });
});
