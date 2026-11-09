import { expect, type Page } from '@playwright/test';

/**
 * Wait until the app shell has mounted and its global listeners are bound.
 *
 * Waits on `data-app-ready`, which AppShell sets from its own mount effect. React
 * flushes child effects before parent effects, so when the attribute appears
 * every descendant listener — including CommandPalette's window-level Ctrl+K
 * handler and React's delegated click handlers — has already been bound. An
 * interaction issued before that is simply lost, with nothing to retry it.
 *
 * Neither `networkidle` nor the `<main>` landmark can stand in for this: the
 * shell renders `<main>` unconditionally, so a server-rendered DOM satisfies both
 * before hydration (plans/149 §4).
 *
 * Declared first: the helpers below call it, and module-scope const arrows must
 * be defined before use (temporal dead zone).
 */
/** Accessible name of the first-run onboarding dialog (#1064). */
const ONBOARDING_DIALOG_NAME = /take the tour/i;

/** Escape presses tried before falling back to a click; see below. */
const ONBOARDING_DISMISS_ATTEMPTS = 5;

/** How long each Escape press gets to close the gate before the next try. */
const ONBOARDING_DISMISS_TIMEOUT_MS = 500;

/**
 * Dismiss the first-run onboarding gate if it is showing.
 *
 * The gate appears one animation frame after mount, so the frame is awaited
 * before deciding whether it is there — checking straight after
 * `data-app-ready` races its own `requestAnimationFrame`.
 *
 * Dismissal is Escape rather than a click on "Skip tour": a click moves the
 * browser's sequential-focus starting point into the dialog that is about to
 * unmount, so the next Tab lands elsewhere and the skip-nav specs fail. Escape
 * leaves focus where it was, giving a fresh profile the same Tab order as a
 * returning one. The press is retried because the gate's keydown listener is
 * bound in an effect that can commit a frame after the dialog paints, and a key
 * pressed in that gap is simply lost. The click is a last-resort fallback so a
 * spec fails with a dead overlay rather than a silent hang.
 */
const dismissOnboardingGate = async (page: Page): Promise<void> => {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const gate = page.getByRole('dialog', { name: ONBOARDING_DIALOG_NAME });
  if (!(await gate.isVisible().catch((error: unknown) => {
    console.warn('Onboarding gate visibility check failed; assuming closed', error);
    return false;
  }))) {
    return;
  }
  for (let attempt = 0; attempt < ONBOARDING_DISMISS_ATTEMPTS; attempt += 1) {
    await page.keyboard.press('Escape');
    try {
      await expect(gate).toBeHidden({ timeout: ONBOARDING_DISMISS_TIMEOUT_MS });
      return;
    } catch (error) {
      if (attempt === ONBOARDING_DISMISS_ATTEMPTS - 1) {
        console.warn('Onboarding gate ignored Escape; falling back to Skip tour', error);
      }
    }
  }
  await page.getByRole('button', { name: /skip tour/i }).click();
  await expect(gate).toBeHidden();
};

export const waitForAppReady = async (page: Page): Promise<void> => {
  await expect(page.locator('[data-app-ready="true"]')).toBeAttached();
  // First-run onboarding (#1064) renders a modal dialog over the shell for
  // fresh profiles — which is every E2E context. Dismiss it here so all specs
  // share the same post-onboarding starting point instead of timing out on
  // an overlay that intercepts every click. Unit tests bypass the gate via
  // NODE_ENV=test; E2E runs against the dev server where the flag is absent.
  await dismissOnboardingGate(page);
};

/**
 * Open the mobile drawer when the persistent sidebar is hidden (mobile and
 * tablet viewports). No-op on desktop where the sidebar is always visible.
 * After this resolves, `getByRole('navigation', { name: /main navigation/i })`
 * matches the visible navigation on every viewport.
 *
 * Waits for the shell first: the sidebar and the "Open menu" trigger are both
 * server-rendered, so clicking either before hydration does nothing and the
 * caller then fails on a later assertion (plans/149 §5.2).
 */
export const openNavIfHidden = async (page: Page): Promise<void> => {
  await waitForAppReady(page);
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  if (await nav.isVisible()) return;
  await page.getByRole('button', { name: /open menu/i }).first().click();
  await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
};

/**
 * Click a sidebar navigation button by label, scoped to the main navigation.
 *
 * Viewport-aware: on desktop (≥lg) the sidebar <nav> is visible; on mobile and
 * tablet it is hidden behind the drawer, so we open the drawer ("Open menu")
 * first and click inside it. This lets every spec run on all Playwright
 * projects (chromium, mobile, tablet, desktop-xl).
 *
 * Post-condition: on mobile/tablet the drawer closes after the navigation
 * action (app behavior), so assertions after navClick must target view
 * content rather than drawer state.
 */
export const navClick = async (page: Page, name: RegExp | string): Promise<void> => {
  await openNavIfHidden(page);
  await page
    .getByRole('navigation', { name: /main navigation/i })
    .getByRole('button', { name })
    .first()
    .click();
};

/**
 * Assert that primary navigation is reachable: the persistent sidebar on
 * desktop, or the "Open menu" trigger (which reveals the drawer navigation)
 * below the lg breakpoint.
 */
export const expectNavigationReachable = async (page: Page): Promise<void> => {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  if (await nav.isVisible()) {
    await expect(nav).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  }
};

/**
 * The current view's own heading, scoped to the view content.
 *
 * Since the view-chrome work (Plan 163 / #870) every page-shaped view renders a
 * hero heading, while the shell's topbar owns the view's `h1` — so the two
 * headings carry the same name and a bare
 * `page.getByRole('heading', { name: /library/i })` matches both, failing
 * Playwright's strict mode. Assert the *view's* heading with this instead; use
 * the topbar's `h1` only when the shell chrome is what is under test.
 *
 * The shell is the only owner of `h1`, and the hero is an `h2` inside
 * `<main id="main-content">`; `DESIGN-SYSTEM.md` §11 records that policy.
 */
export const viewHeading = (page: Page, name: string | RegExp) =>
  page.locator('#main-content').getByRole('heading', { name });
