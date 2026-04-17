import { test, expect } from '@playwright/test';

test('sidebar navigation uses semantic buttons and has correct aria-current', async ({ page }) => {
  await page.goto('/');

  // Wait for the app to be ready
  await expect(page.locator('.layout')).toBeVisible();

  const navButtons = page.locator('.nav-button');
  await expect(navButtons).toHaveCount(4);

  // Check the first button (Editor) - it should be active by default
  const editorButton = navButtons.nth(0);
  await expect(editorButton).toHaveText('Editor');
  await expect(editorButton).toHaveAttribute('aria-current', 'page');
  await expect(editorButton).toHaveClass(/active/);

  // Click on Graph button
  const graphButton = navButtons.nth(1);
  await expect(graphButton).toHaveText('Graph');
  await expect(graphButton).not.toHaveAttribute('aria-current', 'page');

  await graphButton.click();

  // Now Graph should be active
  await expect(graphButton).toHaveAttribute('aria-current', 'page');
  await expect(graphButton).toHaveClass(/active/);
  await expect(editorButton).not.toHaveAttribute('aria-current', 'page');
  await expect(editorButton).not.toHaveClass(/active/);

  // Verify focus-visible state (simulate keyboard navigation)
  await page.keyboard.press('Tab'); // This might focus something else first, let's focus a button specifically
  await graphButton.focus();
  // We can't easily test :focus-visible via Playwright locators without complex CSS checks,
  // but we can ensure it is focusable.
  await expect(graphButton).toBeFocused();
});
