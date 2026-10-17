import { test, expect, type Page } from '@playwright/test';
import { expectNavigationReachable, waitForAppReady } from './helpers/navigation';

/**
 * Framework-level error surfaces (ADR 035, Plan 130 G1 / A6).
 *
 * The per-view boundaries are already covered by `offline-views.spec.ts` (a
 * rejected dynamic import renders `ViewErrorBoundary`). What is under test here
 * is the layer above them: `src/app/error.tsx`, which Next wraps around the
 * root segment, and `src/app/not-found.tsx`.
 *
 * A route-level render failure cannot be produced from the test's side of the
 * page without a hook in the component, so the spec injects a deterministically
 * armed fault instead: `window.matchMedia` throws for the reduced-motion query
 * while armed, and `useReducedMotion` reads that query during render.
 *
 * Which re-render is triggered is load-bearing. Most components that read the
 * query live inside a view (`home-view`, `library-entities`, ...), so a
 * navigation would surface the failure inside `ViewErrorBoundary` — one
 * boundary lower than the file under test. Opening the command palette changes
 * only store state that the shell chrome subscribes to (the palette and the
 * shortcuts dialog), so the failure surfaces exactly where `error.tsx` is
 * responsible for it, and the views are untouched.
 *
 * Disarming is what makes `retry()` able to succeed, which is the recovery path
 * being asserted.
 */

/** Window flags the injected fault reads and this spec arms. */
interface RenderFaultSwitch {
  __failReducedMotionMatch?: boolean;
}

/**
 * Installs the fault on every document this page loads, disarmed.
 *
 * Only the reduced-motion query fails: `next-themes` and every other consumer
 * asks about `prefers-color-scheme`, so the rest of the app keeps working and
 * the failure stays attributable to one render.
 */
const installRenderFault = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const state = window as unknown as RenderFaultSwitch;
    state.__failReducedMotionMatch = false;
    window.matchMedia = (query: string) => {
      if (state.__failReducedMotionMatch === true && query.includes('prefers-reduced-motion')) {
        throw new Error('Injected render failure (error-boundaries spec)');
      }
      return original(query);
    };
  });
};

/** Arms or disarms the injected fault. */
const setRenderFault = async (page: Page, armed: boolean): Promise<void> => {
  await page.evaluate((value) => {
    const state = window as unknown as RenderFaultSwitch;
    state.__failReducedMotionMatch = value;
  }, armed);
};

test.describe('Route error boundary', () => {
  test('renders the themed boundary and recovers through the retry action', async ({ page }) => {
    await installRenderFault(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Arming alone changes nothing: the re-render caused by the shortcut is
    // what walks the hook again and surfaces the failure.
    await setRenderFault(page, true);
    await page.keyboard.press('Control+k');

    const boundaryHeading = page.getByRole('heading', { name: 'Something went wrong' });
    await expect(boundaryHeading).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    // `retry()` re-fetches and re-renders the failed segment, so it can only
    // succeed once the cause is gone.
    await setRenderFault(page, false);
    await page.getByRole('button', { name: /try again/i }).click();

    await waitForAppReady(page);
    await expectNavigationReachable(page);
    await expect(boundaryHeading).toBeHidden();
  });
});

test.describe('Unmatched routes', () => {
  test('renders the not-found page with a way back to the studio', async ({ page }) => {
    await page.goto('/no-such-route-in-this-studio');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: /back to the studio/i }).click();

    await waitForAppReady(page);
    await expectNavigationReachable(page);
  });
});
