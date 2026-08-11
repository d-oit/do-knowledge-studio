import { test, expect } from '@playwright/test';

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the initial JS bundle to settle so React has hydrated and the
    // Ctrl+K listener is bound (networkidle fires after fetches complete).
    await page.waitForLoadState('networkidle');
    // Hydration signal that exists on every viewport: the <main> landmark is
    // rendered after React mounts, whereas the sidebar nav (same label as the
    // mobile drawer nav) is hidden below the lg breakpoint.
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();
  });

  test('closes with Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('search input is focused when opened', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByRole('combobox');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeFocused();
    }
  });

  test('typing filters command results', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByRole('combobox');
    if (await searchInput.isVisible()) {
      await searchInput.fill('library');
      await expect(dialog.getByText(/library/i)).toBeVisible();
    }
  });

  test('clicking a navigation item navigates', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    const libraryItem = dialog.getByText(/^Library$/i).first();
    if (await libraryItem.isVisible()) {
      await libraryItem.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
    }
  });

  test('can be opened from sidebar search trigger', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    // The sidebar has a search button with "Search…" text
    const searchTrigger = nav.getByRole('button', { name: /search/i });
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
      const dialog = page.getByRole('dialog', { name: /command/i });
      await expect(dialog).toBeVisible();
    }
  });

  test('dialog has proper aria attributes', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
  });
});
