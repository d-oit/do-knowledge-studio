import { test, expect } from '@playwright/test';
import { assertNoAxeViolations } from './helpers/a11y';
import {
  expectNavigationReachable,
  navClick,
  openNavIfHidden,
  waitForAppReady,
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

/**
 * Documented exception: SVG data-viz nodes cannot be both an image and
 * keyboard-operable controls without nesting interactive roles.
 */
const GRAPH_SVG_NESTED_INTERACTIVE = 'nested-interactive';

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

  // Graph nodes are SVG <g role="button" tabindex="0"> inside an <svg role="img">.
  // axe-core's nested-interactive rule flags the <svg> as nesting focusable controls.
  // Measured 2026-09-30: the reported target is `svg[viewBox]` itself, and there is no
  // equivalent that keeps BOTH the accessible image role and keyboard-operable nodes.
  // This is the ONLY excused rule here — every other critical/serious rule still gates
  // the page, unlike the previous blanket "critical only" assertion.
  test('graph page has no unexcused critical or serious axe violations', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /graph/i);
    await page.waitForLoadState('networkidle');
    await assertNoAxeViolations(page, { allowRules: [GRAPH_SVG_NESTED_INTERACTIVE] });
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

/**
 * The offline banner is `fixed top-0` at `z-50` while the topbar is in normal
 * flow at the top of the page, so the banner's band sits directly over the
 * topbar's controls.
 *
 * Measured before this test existed: on a 1280 and a 1920 viewport the 36px
 * banner covered the hit points of the quick filter, the command-palette
 * trigger and New entity; at 390×844 the wrapped 56px banner covered the menu
 * trigger and the search trigger too. `document.elementFromPoint` returned the
 * banner for every one of them, so while offline — the moment a local-first app
 * most needs to work — its primary controls could not be clicked.
 *
 * This asserts the user-visible contract (the controls are hit-testable), not
 * the banner's height or styling, so any layout that keeps them reachable
 * passes.
 */
test.describe('Offline banner', () => {
  // The banner slides in from above the viewport. Without this, the geometric
  // probe below can run while it is still off-screen and every control looks
  // reachable — the exact way the first version of this test passed on broken
  // code. Reduced motion removes the slide entirely, so the probe always sees
  // the resting layout, and the explicit position wait covers the animated case.
  test.use({ reducedMotion: 'reduce' });

  test('does not cover the topbar controls', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await context.setOffline(true);

    // The banner mounts (already at its resting position under reduced motion)
    // one frame before the shell reserves its height, so probing immediately
    // reported an empty obstruction list even on the broken layout: measured,
    // this test passed 3 of 6 mobile runs before it waited. Poll the
    // precondition — and report it, so a failure says "only 0px of 56px
    // reserved" instead of an inscrutable timeout.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const banner = [...document.querySelectorAll('[role="status"]')].find(
              (node) => /offline/i.test(node.textContent ?? '') && node.className.includes('fixed'),
            );
            if (banner === undefined) return 'no banner';
            const bannerRect = banner.getBoundingClientRect();
            if (Math.round(bannerRect.bottom) > Math.round(bannerRect.height)) {
              return 'banner still sliding in';
            }
            const shell = document.querySelector('[data-app-ready="true"]');
            const reserved = shell ? Number.parseFloat(getComputedStyle(shell).paddingTop) : 0;
            return reserved >= bannerRect.height - 0.5
              ? 'reserved'
              : `only ${reserved}px of ${bannerRect.height}px reserved`;
          }),
        { timeout: 5000 },
      )
      .toBe('reserved');

    const obstructed = await page.evaluate(() =>
      [...document.querySelectorAll('header button, header input')]
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0)
        .filter(({ el, rect }) => {
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return !(hit === el || el.contains(hit));
        })
        .map(({ el }) =>
          (el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.textContent ?? '')
            .trim()
            .slice(0, 40),
        ),
    );

    expect(
      obstructed,
      `topbar controls hidden behind the offline banner: ${obstructed.join(', ')}`,
    ).toEqual([]);
  });
});
