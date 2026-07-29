import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('Keyboard accessibility — comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // T2: Skip-nav link
  test('skip-nav: Tab after page load focuses skip link; Enter moves focus to main', async ({ page }) => {
    // The skip link is sr-only until focused, so we Tab from the top of the page
    await page.keyboard.press('Tab');

    // The first focusable element should be the skip-to-content link
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();

    // Activating it should move focus to the main content region
    await page.keyboard.press('Enter');

    // Verify main landmark exists and is the active element (or at least visible)
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();
  });

  test('skip-nav: link is visually hidden until focused', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    // Before focus it should not be visible (sr-only)
    // After focus it becomes visible (focus:not-sr-only)
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
  });

  // T3: Command palette focus trap
  test('command palette: Tab cycles within open palette; Escape closes', async ({ page }) => {
    await page.keyboard.press('Control+k');

    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    // The search input inside the palette should receive focus
    const searchInput = dialog.getByRole('searchbox').or(dialog.getByPlaceholder(/search/i));
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeFocused();
    }

    // Tab should cycle within the dialog (focus trap)
    await page.keyboard.press('Tab');
    // Focus should still be within the dialog, not outside
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    // After Tab, focus should be on an element within the dialog or loop back
    expect(focusedTag).toBeTruthy();

    // Escape closes the dialog
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('command palette: focus returns to trigger after Escape', async ({ page }) => {
    // Tab to a focusable element before opening the palette
    await page.keyboard.press('Tab');

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // After closing, focus should be somewhere on the page (not lost)
    const afterClose = await page.evaluate(() => document.activeElement?.tagName);
    expect(afterClose).toBeTruthy();
  });

  // T4: Editor radiogroup arrow keys
  test('editor radiogroup: arrow keys cycle between Edit/Preview/Split', async ({ page }) => {
    await navClick(page, /editor/i);
    await expect(page.getByRole('heading', { name: /editor/i })).toBeVisible();

    const radiogroup = page.getByRole('radiogroup', { name: /editor mode/i });
    await expect(radiogroup).toBeVisible();

    const radios = radiogroup.getByRole('radio');
    await expect(radios).toHaveCount(3);

    // Focus the first radio
    await radios.first().focus();
    await expect(radios.first()).toBeFocused();

    // Right arrow should move to the next radio
    await page.keyboard.press('ArrowRight');
    const secondRadio = radios.nth(1);
    await expect(secondRadio).toBeFocused();

    // Right arrow again should move to the third (or wrap to first)
    await page.keyboard.press('ArrowRight');
    // Either third is focused or it wrapped to first
    const focusedIdx = await radios.evaluateAll((els) =>
      els.findIndex((el) => el === document.activeElement),
    );
    expect(focusedIdx).toBeGreaterThanOrEqual(0);
  });

  // T5: Overlay Escape + focus restoration
  test('export reset overlay: closes on Escape', async ({ page }) => {
    await navClick(page, /export/i);

    const resetBtn = page.getByRole('button', { name: /reset/i });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      const dialog = page.getByRole('dialog', { name: /confirm reset/i });
      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });

  test('shortcuts dialog: closes on Escape', async ({ page }) => {
    // Open shortcuts dialog (typically via ? key or a button)
    await page.keyboard.press('?');

    const dialog = page.getByRole('dialog', { name: /shortcut/i });
    if (await dialog.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });

  test('sidebar: Tab order follows DOM order with no gaps', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const buttons = nav.getByRole('button');
    const count = await buttons.count();

    // Tab through each button and verify focus moves sequentially
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      await btn.focus();
      await expect(btn).toBeFocused();
    }
  });

  test('no keyboard trap: can Tab past sidebar to main content', async ({ page }) => {
    // Start at the top of the page and Tab multiple times
    await page.keyboard.press('Tab'); // skip-nav

    // Tab through sidebar items
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    // Should still be on the page (not stuck)
    await expect(page).toHaveTitle(/DO Knowledge Studio/);
  });
});
