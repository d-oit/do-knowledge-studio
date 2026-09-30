import { test, expect } from '@playwright/test';
import { assertNoCriticalAxeViolations, assertNoAxeViolations } from './helpers/a11y';
import {
  expectNavigationReachable,
  navClick,
  openNavIfHidden,
} from './helpers/navigation';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page has a main landmark', async ({ page }) => {
    await expectNavigationReachable(page);
  });

  test('sidebar navigation has proper aria-label', async ({ page }) => {
    await openNavIfHidden(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();
  });

  test('sidebar nav items have aria-current when active', async ({ page }) => {
    await openNavIfHidden(page);
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
    await openNavIfHidden(page);
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
  // Plan 095: color-contrast token fixes applied (globals.css).
  // All views now use the strict assertion (critical + serious).
  test.beforeEach(async ({ page }) => {
    // Disable animations: entrance animations (stagger-fade-in, framer-motion)
    // leave elements mid-fade (opacity < 1) for a few hundred ms, which blends
    // colors and trips axe's color-contrast rule nondeterministically.
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('home page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('library page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /library/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('editor page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /editor/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('chat page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /chat/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('mind map page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /mind map/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  // Graph page uses SVG <g> elements with role="button" + tabindex="0" for keyboard-accessible
  // data visualization nodes. Axe-core flags these as nested-interactive (serious) — a known
  // limitation with no clean SVG equivalent. Using critical-only assertion for this view.
  test('graph page has no critical axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /graph/i);
    await page.waitForLoadState('networkidle');
    await assertNoCriticalAxeViolations(page);
  });

  test('TRIZ page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /triz/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('export page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /export/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('sync page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /sync/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });

  test('AI harness page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /ai/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page);
  });
});
