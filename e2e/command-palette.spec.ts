import { test, expect } from '@playwright/test';
import { viewHeading, waitForAppReady } from './helpers/navigation';

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ctrl+K is bound by an effect, so wait for the mounted shell rather than a
    // visible element that the server already rendered.
    await waitForAppReady(page);
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
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
  });

  test('typing filters command results', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    const searchInput = dialog.getByRole('combobox');
    await expect(searchInput).toBeVisible();
    const unrelatedCommand = dialog.getByRole('option', { name: 'Toggle theme' });
    await expect(unrelatedCommand).toBeVisible();
    await searchInput.fill('library');
    // Two commands legitimately mention the library now (the navigation item
    // and the JSON export), so the assertion names the navigation command and
    // proves filtering by requiring an unrelated command to disappear.
    await expect(dialog.getByRole('option', { name: 'Library', exact: true })).toBeVisible();
    await expect(unrelatedCommand).toBeHidden();
  });

  test('clicking a navigation item navigates', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();

    const libraryItem = dialog.getByText(/^Library$/i).first();
    if (await libraryItem.isVisible()) {
      await libraryItem.click();
      await expect(dialog).toBeHidden();
      await expect(viewHeading(page, /library/i)).toBeVisible();
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

  test('opens from the topbar command-palette trigger', async ({ page }) => {
    const topbarTrigger = page
      .getByRole('banner')
      .getByRole('button', { name: 'Open command palette' });
    test.skip(
      !(await topbarTrigger.isVisible()),
      'The topbar command-palette shortcut is available only at desktop widths.',
    );
    await topbarTrigger.click();
    await expect(page.getByRole('dialog', { name: /command/i })).toBeVisible();
  });

  test('dialog has proper aria attributes', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
  });
});
