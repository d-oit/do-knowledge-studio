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

  test('library entity open buttons have accessible names', async ({ page }) => {
    await navClick(page, /library/i);

    // Table rows expose native table semantics (#861); the open action is a
    // real button in the name cell, matching the grid-card pattern. The
    // default view is grid, so switch explicitly — a fresh profile carries
    // no stored view-mode preference (caught by CI, which starts clean).
    await page.getByRole('button', { name: 'List view' }).click();

    const entityButtons = page.getByRole('button', { name: /open /i });
    await expect(entityButtons.first()).toBeVisible();
    await expect(entityButtons.first()).toHaveAttribute('aria-label', /open /i);
    await expect(page.getByRole('table')).toBeVisible();
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
      const dialog = page.getByRole('dialog', { name: /reset to demo data/i });
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

    // The banner mounts and the shell reserves its height in the SAME paint
    // (OfflineIndicator publishes `--offline-banner-height` from a layout
    // effect), so under reduced motion the reservation is already in place when
    // the banner first appears. The poll is kept as a precondition/diagnostic
    // rather than to paper over a frame gap: it reports "only 0px of 56px
    // reserved" instead of an inscrutable geometric failure if the reservation
    // ever regresses, and it also covers the non-reduced-motion slide-in.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const banner = [...document.querySelectorAll('[role="status"]')].find(
              (node) => /offline/i.test(node.textContent ?? '') && node.className.includes('fixed'),
            );
            if (banner === undefined) return 'no banner';
            const bannerRect = banner.getBoundingClientRect();
            // The banner is `fixed top-0`, so at rest its top is 0. While it
            // slides in from above, top is NEGATIVE (bottom < height) — which a
            // bottom-only check treated as "at rest", letting the geometric
            // probe below run against a half-entered banner (GitNexus on
            // PR #925).
            if (Math.abs(bannerRect.top) > 0.5) return 'banner still sliding in';
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

/**
 * The reservation's ORDERING claim needs the exit animation to exist: under the
 * reduced-motion override above, the banner unmounts in the same frame the
 * reservation drops, so a regression that releases early has no window to be
 * caught in (measured: a defect injected into `offline-indicator.tsx` passed the
 * reduced-motion version of this test). This block therefore runs with motion
 * enabled and records the two events from inside the page.
 */
test.describe('Offline banner exit', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('releases the reserved space once the banner has exited', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await context.setOffline(true);
    // Wait for the banner to be *in view*, not merely mounted: with motion
    // enabled it enters from `y: -100%`, so a recorder started as soon as the
    // reservation appears would sample a banner that is still above the
    // viewport, record `banner-gone` before the online transition, and then
    // accept a premature release during the real exit (GitNexus on PR #925).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const shell = document.querySelector('[data-app-ready="true"]');
            const banner = [...document.querySelectorAll('[role="status"]')].find(
              (node) => /offline/i.test(node.textContent ?? '') && node.className.includes('fixed'),
            );
            if (shell === null) return 'no shell';
            if (banner === undefined) return 'no banner';
            const rect = banner.getBoundingClientRect();
            const reserved = Number.parseFloat(getComputedStyle(shell).paddingTop);
            if (reserved <= 0) return 'not reserved';
            if (rect.bottom <= 0 || rect.height === 0) return 'banner still entering';
            return 'in view and reserved';
          }),
        { timeout: 5000 },
      )
      .toBe('in view and reserved');

    // Record the ORDER of the two events from inside the page, at frame
    // resolution. The claim is causal — the reservation must outlive the
    // banner's exit — and neither a poll loop from the test process nor a
    // reduced-motion run can see it: the exit is a few frames long, so a
    // regression that drops the reservation the moment the browser goes online
    // slips between samples (measured: exactly that defect passed the previous
    // version of this test).
    //
    // The recorder runs inside the page and resolves once it has seen both
    // events, so no state crosses the boundary except the ordered list.
    const recording = page.evaluate(async () => {
      // "Gone" is a geometry question, not a DOM-presence one: during the exit
      // animation the banner is still mounted while sliding off the top of the
      // viewport, and a reservation dropped at that point covers nothing. The
      // contract is that the topbar is never left under a *visible* banner, so
      // the marker fires once the banner's bottom edge has left the viewport.
      const bannerOnScreen = () =>
        [...document.querySelectorAll('[role="status"]')].some((node) => {
          if (!/offline/i.test(node.textContent ?? '') || !node.className.includes('fixed')) {
            return false;
          }
          return node.getBoundingClientRect().bottom > 0;
        });
      const reservedPx = () => {
        const shell = document.querySelector('[data-app-ready="true"]');
        return shell === null ? 0 : Number.parseFloat(getComputedStyle(shell).paddingTop);
      };

      const recorded: string[] = [];
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = (marker?: string) => {
          if (settled) return;
          settled = true;
          if (marker !== undefined) recorded.push(marker);
          resolve();
        };
        const tick = () => {
          if (!bannerOnScreen() && !recorded.includes('banner-gone')) recorded.push('banner-gone');
          if (reservedPx() === 0 && !recorded.includes('unreserved')) recorded.push('unreserved');
          if (recorded.includes('banner-gone') && recorded.includes('unreserved')) {
            finish();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(() => { finish('timeout'); }, 5000);
      });
      return recorded;
    });

    await context.setOffline(false);

    const order = await recording;
    const bannerGoneAt = order.indexOf('banner-gone');
    const unreservedAt = order.indexOf('unreserved');

    expect(bannerGoneAt, `the banner never left the layout: ${order.join(' -> ')}`).toBeGreaterThanOrEqual(0);
    expect(unreservedAt, `never released the reservation: ${order.join(' -> ')}`).toBeGreaterThanOrEqual(0);
    // The reservation may end in the same frame the banner leaves, but never
    // before it: releasing first slides the topbar back under a banner that is
    // still animating out.
    expect(
      unreservedAt,
      `reservation released before the banner left the layout: ${order.join(' -> ')}`,
    ).toBeGreaterThanOrEqual(bannerGoneAt);
  });
});
