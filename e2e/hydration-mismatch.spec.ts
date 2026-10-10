import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/navigation';

/**
 * A view must hydrate cleanly when the OS asks for reduced motion.
 *
 * `useReducedMotion` is consumed by ~25 animated elements to decide whether to
 * skip their entry animation (`initial={reducedMotion ? false : {...}}`). If the
 * hook answers differently on the server than on the client's first pass, the
 * markup React hydrates does not match the HTML it was sent, and React reports
 * a mismatch and re-renders that subtree from scratch — on every animated
 * element, on every load, for exactly the users who asked for less motion.
 *
 * The failure is invisible to a screenshot and invisible to a unit test that
 * mocks the hook, so it is pinned here in a real browser instead.
 *
 * Runs at every configured viewport, because the media state is per-context
 * rather than per-viewport and a view can be entered by reloading on it.
 */

/** Readable React message in development; minified codes are #418/#423 in production. */
const HYDRATION_MISMATCH = /hydrat|server rendered HTML didn't match|Minified React error #(418|423)/i;

/**
 * React reports a hydration mismatch *after* the tree has committed: the report
 * is queued, not thrown, so it arrives some time after `data-app-ready` — and an
 * absence assertion cannot poll for a message that never comes. Measured on the
 * defective code: reading the console immediately after readiness captures
 * nothing, and the report is present well within this window.
 */
const HYDRATION_REPORT_SETTLE_MS = 2000;

test.describe('Hydration under prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Home hydrates without a server/client mismatch', async ({ page }) => {
    const consoleOutput: string[] = [];
    page.on('console', (message) => {
      consoleOutput.push(`[${message.type()}] ${message.text()}`);
    });
    page.on('pageerror', (error) => consoleOutput.push(`[pageerror] ${error.message}`));

    // The listener must exist before the document loads: React reports the
    // mismatch while hydrating, which is over by the time `goto` resolves.
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(HYDRATION_REPORT_SETTLE_MS);

    // Sanity: a blank page must not be able to pass this test.
    await expect(page.getByRole('heading', { name: /recent work/i })).toBeVisible();

    const mismatches = consoleOutput.filter((text) => HYDRATION_MISMATCH.test(text));
    expect(mismatches, `hydration errors:\n${mismatches.join('\n')}`).toEqual([]);
  });

  test('entry animations end visible rather than frozen mid-motion', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // The section the Home view fades in. Under reduced motion it must reach
    // full opacity immediately — the point of skipping the animation is to end
    // at the final state, not to sit at the initial one.
    await expect(page.locator('main section').first()).toHaveCSS('opacity', '1');
  });
});
