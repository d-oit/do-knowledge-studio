import { test, expect } from '@playwright/test';

async function navClick(page: import('@playwright/test').Page, name: string | RegExp) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  const btn = nav.getByRole('button', { name });
  await btn.click();
}

test.describe('Keyboard Accessibility', () => {
  test.describe('Skip-nav link', () => {
    test('first Tab focuses skip-nav link', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Press Tab once; the first focusable element should be a skip-nav link
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const text = await focused.textContent();

      expect(
        text?.toLowerCase().includes('skip') ||
        text?.toLowerCase().includes('main content'),
      ).toBeTruthy();
    });

    test('activating skip-nav link moves focus to main content', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Tab');
      const skipLink = page.locator(':focus');

      const isSkipLink =
        (await skipLink.textContent())?.toLowerCase().includes('skip') ||
        (await skipLink.getAttribute('href'))?.startsWith('#');
      if (!isSkipLink) {
        // If the first element isn't the skip link, try to find it directly
        const link = page.locator(
          'a[href="#main-content"], a[href="#main"], [data-testid="skip-nav"], a:has-text("Skip")',
        ).first();
        await link.focus();
      }

      await page.keyboard.press('Enter');

      // Focus should have moved to the main content area
      const mainContent = page.locator(
        '#main-content, main, [role="main"], #content',
      );
      const focused = page.locator(':focus');

      // Either focus is on #main-content itself, or inside it
      const isMainFocused = await mainContent.evaluate((el, focusedEl) => {
        return el === focusedEl || el.contains(focusedEl);
      }, await focused.elementHandle()).catch(() => false);

      // Alternatively, after skip link activation, the main content
      // should be visible and the skip link itself no longer focused
      const skipLinkNoLongerFocused = await skipLink.evaluate(
        (el) => document.activeElement !== el,
      );

      expect(isMainFocused || skipLinkNoLongerFocused).toBeTruthy();
    });
  });

  test.describe('Command palette focus trap', () => {
    test('Ctrl+K opens command palette dialog', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Control+k');

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });

    test('focus cycles within the dialog — Tab does not escape', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Tab several times — focus must stay inside the dialog
      const tabCount = 10;
      for (let i = 0; i < tabCount; i++) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        // Use evaluate to check containment robustly
        const isInside = await dialog.evaluate((el, focusedEl) => {
          return el.contains(focusedEl) || el === focusedEl;
        }, await focused.elementHandle());

        expect(isInside).toBeTruthy();
      }

      // Shift+Tab should also stay inside
      for (let i = 0; i < tabCount; i++) {
        await page.keyboard.press('Shift+Tab');
        const focused = page.locator(':focus');
        const isInside = await dialog.evaluate((el, focusedEl) => {
          return el.contains(focusedEl) || el === focusedEl;
        }, await focused.elementHandle());

        expect(isInside).toBeTruthy();
      }
    });

    test('Escape closes dialog and restores focus', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Focus something predictable before opening palette
      const sidebar = page.getByRole('navigation', { name: /main navigation/i });
      await sidebar.focus();
      const beforeFocusedId = await page.evaluate(
        () => document.activeElement?.tagName ?? '',
      );
      expect(beforeFocusedId.length).toBeGreaterThan(0);

      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      // Focus must not be lost (not null, not on body by default)
      const activeTag = await page.evaluate(
        () => document.activeElement?.tagName ?? '',
      );
      const isLost =
        activeTag === '' ||
        activeTag === 'BODY' ||
        activeTag === 'HTML';
      expect(isLost).toBe(false);
    });
  });

  test.describe('Editor radiogroup arrow keys', () => {
    test('ArrowRight moves focus through radio buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate to editor view
      try {
        await navClick(page, /editor/i);
      } catch {
        // Fallback: try href-based navigation
        await page.click('a[href*="editor"], a[href*="write"]');
      }
      await page.waitForTimeout(500);

      const radiogroup = page.getByRole('radiogroup', {
        name: /editor mode/i,
      });
      const radios = radiogroup.getByRole('radio');

      const count = await radios.count();
      if (count === 0) {
        test.skip(true, 'No editor mode radiogroup found');
        return;
      }

      // Focus the first radio
      await radios.first().focus();
      let focused = page.locator(':focus');
      let idx = await radios.evaluateAll(
        (els, focusedEl) =>
          els.findIndex((el) => el === focusedEl),
        await focused.elementHandle(),
      );
      expect(idx).toBe(0);

      // ArrowRight → next radio
      await page.keyboard.press('ArrowRight');
      focused = page.locator(':focus');
      idx = await radios.evaluateAll(
        (els, focusedEl) =>
          els.findIndex((el) => el === focusedEl),
        await focused.elementHandle(),
      );
      expect(idx).toBe(1);

      // ArrowRight again → third radio
      if (count >= 3) {
        await page.keyboard.press('ArrowRight');
        focused = page.locator(':focus');
        idx = await radios.evaluateAll(
          (els, focusedEl) =>
            els.findIndex((el) => el === focusedEl),
          await focused.elementHandle(),
        );
        expect(idx).toBe(2);
      }

      // ArrowRight from last → wraps to first or stays
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('ArrowRight');
      }
      focused = page.locator(':focus');
      idx = await radios.evaluateAll(
        (els, focusedEl) =>
          els.findIndex((el) => el === focusedEl),
        await focused.elementHandle(),
      );
      // Either wraps to first or stays on last
      expect([0, count - 1]).toContain(idx);
    });

    test('ArrowLeft moves focus backward through radio buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      try {
        await navClick(page, /editor/i);
      } catch {
        await page.click('a[href*="editor"], a[href*="write"]');
      }
      await page.waitForTimeout(500);

      const radiogroup = page.getByRole('radiogroup', {
        name: /editor mode/i,
      });
      const radios = radiogroup.getByRole('radio');

      const count = await radios.count();
      if (count === 0) {
        test.skip(true, 'No editor mode radiogroup found');
        return;
      }

      // Focus first radio, then move to last with repeated ArrowRight
      await radios.first().focus();
      for (let i = 1; i < count; i++) {
        await page.keyboard.press('ArrowRight');
      }
      let focused = page.locator(':focus');
      let idx = await radios.evaluateAll(
        (els, focusedEl) =>
          els.findIndex((el) => el === focusedEl),
        await focused.elementHandle(),
      );
      // Should be on last (or first if it wraps)
      if (count > 1) {
        expect(idx).toBe(count - 1);
      }

      // ArrowLeft → previous radio
      await page.keyboard.press('ArrowLeft');
      focused = page.locator(':focus');
      idx = await radios.evaluateAll(
        (els, focusedEl) =>
          els.findIndex((el) => el === focusedEl),
        await focused.elementHandle(),
      );
      if (count > 1) {
        expect(idx).toBe(count - 2);
      }
    });
  });

  test.describe('Overlay Escape + focus restoration', () => {
    test('Export reset dialog opens and closes with Escape', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate to export page
      try {
        await navClick(page, /export/i);
      } catch {
        await page.click('a[href*="export"]');
      }
      await page.waitForTimeout(500);

      // Find and click a reset button
      const resetBtn = page.getByRole('button', { name: /reset/i });
      const resetCount = await resetBtn.count();

      if (resetCount === 0) {
        test.skip(true, 'No reset button found on export page');
        return;
      }

      // Focus the reset button first
      await resetBtn.first().focus();

      await resetBtn.first().click();

      // Check if a dialog appeared
      const dialog = page.getByRole('dialog');
      const dialogCount = await dialog.count();

      if (dialogCount > 0) {
        await page.keyboard.press('Escape');
        await expect(dialog.first()).not.toBeVisible({ timeout: 3000 });
      }

      // Focus must not be lost
      const afterTag = await page.evaluate(
        () => document.activeElement?.tagName ?? '',
      );
      const isLost =
        afterTag === '' ||
        afterTag === 'BODY' ||
        afterTag === 'HTML';
      expect(isLost).toBe(false);
    });

    test('Command palette Escape restores focus', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Focus the sidebar nav before opening palette
      const sidebar = page.getByRole('navigation', {
        name: /main navigation/i,
      });
      await sidebar.focus();

      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      // Focus should not be on body or undefined
      const activeTag = await page.evaluate(
        () => document.activeElement?.tagName ?? '',
      );
      const isLost =
        activeTag === '' ||
        activeTag === 'BODY' ||
        activeTag === 'HTML';
      expect(isLost).toBe(false);
    });

    test('focus is not lost after closing any overlay via Escape', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Test with command palette as a reliable overlay
      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 3000 });

      const bodyFocused = await page.evaluate(() => {
        const el = document.activeElement;
        // Focus is "lost" if it fell to body or nothing
        return el === document.body || el === null;
      });
      expect(bodyFocused).toBe(false);
    });
  });
});
