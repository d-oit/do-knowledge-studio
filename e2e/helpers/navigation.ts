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
export const waitForAppReady = async (page: Page): Promise<void> => {
  await expect(page.locator('[data-app-ready="true"]')).toBeAttached();
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
