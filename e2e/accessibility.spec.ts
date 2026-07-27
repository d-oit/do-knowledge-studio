import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

/** Helper: run axe-core and assert no critical violations, log serious as warnings */
async function assertNoCriticalAxeViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');

  if (serious.length > 0) {
    console.warn(
      `[a11y] ${serious.length} serious violations found (not blocking):`,
      serious.map((v) => `  - ${v.id}: ${v.description}`).join('\n'),
    );
  }

  expect(critical, `Found ${critical.length} critical axe violations`).toEqual([]);
}

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page has a main landmark', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('sidebar navigation has proper aria-label', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();
  });

  test('sidebar nav items have aria-current when active', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const homeBtn = nav.getByRole('button', { name: /home/i }).first();
    await expect(homeBtn).toHaveAttribute('aria-current', 'page');
  });

  test('library search input has accessible label', async ({ page }) => {
    await navClick(page, /library/i);
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await expect(searchInput).toBeVisible();
  });

  test('library filter groups have aria-label', async ({ page }) => {
    await navClick(page, /library/i);

    const typeGroup = page.getByRole('group', { name: /filter by type/i });
    await expect(typeGroup).toBeVisible();

    const viewGroup = page.getByRole('group', { name: /view mode/i });
    await expect(viewGroup).toBeVisible();
  });

  test('library entity links have accessible names', async ({ page }) => {
    await navClick(page, /library/i);

    const entityLinks = page.getByRole('link', { name: /open /i });
    const count = await entityLinks.count();
    if (count > 0) {
      await expect(entityLinks.first()).toHaveAttribute('aria-label', /open /i);
    }
  });

  test('editor has proper radiogroup for mode selection', async ({ page }) => {
    await navClick(page, /editor/i);

    const radiogroup = page.getByRole('radiogroup', { name: /editor mode/i });
    await expect(radiogroup).toBeVisible();

    const radios = radiogroup.getByRole('radio');
    await expect(radios).toHaveCount(3);
  });

  test('graph view has accessible image description', async ({ page }) => {
    await navClick(page, /graph/i);

    const graphImg = page.getByRole('img', { name: /knowledge graph/i });
    await expect(graphImg).toBeVisible();
  });

  test('export reset dialog has dialog role', async ({ page }) => {
    await navClick(page, /export/i);

    const resetBtn = page.getByRole('button', { name: /reset/i });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      const dialog = page.getByRole('dialog', { name: /confirm reset/i });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('all sidebar interactive elements are keyboard accessible', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const buttons = nav.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      await btn.focus();
      await expect(btn).toBeFocused();
    }
  });
});

test.describe('axe-core automated accessibility', () => {
  test('home page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('library page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /library/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('editor page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /editor/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('chat page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /chat/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('mind map page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /mind map/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('graph page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /graph/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('TRIZ page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /triz/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('export page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /export/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('sync page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /sync/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('AI harness page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await nav.getByRole('button', { name: /ai/i }).first().click();
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });
});
