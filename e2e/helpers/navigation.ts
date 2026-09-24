import { expect, type Page } from '@playwright/test';

/**
 * Open the mobile drawer when the persistent sidebar is hidden (mobile and
 * tablet viewports). No-op on desktop where the sidebar is always visible.
 * After this resolves, `getByRole('navigation', { name: /main navigation/i })`
 * matches the visible navigation on every viewport.
 *
 * Defined before `navClick` because `navClick` calls it — module-scope const
 * arrows must be declared before use (temporal dead zone).
 */
export const openNavIfHidden = async (page: Page): Promise<void> => {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  if (await nav.isVisible()) return;
  await page.getByRole('button', { name: /open menu/i }).first().click();
  await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
}

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
}

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
}

/**
 * Wait until React has mounted and the shell's global listeners are bound.
 *
 * `expectNavigationReachable` only proves the sidebar is *visible*, and the
 * sidebar is server-rendered — so a keypress issued before hydration is simply
 * lost, with nothing to retry it. `networkidle` settles the initial bundle and
 * the <main> landmark confirms the mounted shell on every viewport (the sidebar
 * is hidden below `lg`, so it cannot serve as the signal there).
 *
 * Every spec that presses a global shortcut should call this first; the one that
 * did not (`keyboard-navigation.spec.ts`) produced the flaky Ctrl+K that the
 * dispatched four-project sweep caught (plans/149 §4).
 */
export const waitForAppReady = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main')).toBeVisible();
}
