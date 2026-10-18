import { test, expect, type Page } from '@playwright/test';
import { expectNavigationReachable, waitForAppReady } from './helpers/navigation';

/**
 * Framework error surfaces (ADR 035).
 *
 * The route-segment UI in `src/app/error.tsx` is covered as a component because
 * the app has no supported fault-injection route. This browser spec exercises
 * the root-layout fallback through `OfflineIndicator`, which is mounted by the
 * real layout and consumes the same reduced-motion hook.
 *
 * The reduced-motion query is armed only after hydration. Dispatching the
 * browser's real `offline` event re-renders that layout component and surfaces
 * the failure above the route segment, where `global-error.tsx` is responsible
 * for recovery.
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

test.describe('Root layout error boundary', () => {
  test('renders the global fallback and recovers through the retry action', async ({ page }) => {
    test.skip(
      process.env.PLAYWRIGHT_PRODUCTION !== '1',
      'Next.js uses the development error overlay instead of global-error.',
    );
    await installRenderFault(page);
    await page.goto('/');
    await waitForAppReady(page);

    await setRenderFault(page, true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const boundaryHeading = page.getByRole('heading', { name: 'The studio could not start' });
    const retryButton = page.getByRole('button', { name: 'Reload the studio' });
    await expect(boundaryHeading).toBeVisible();
    await expect(retryButton).toBeVisible();

    await setRenderFault(page, false);
    await retryButton.click();

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
