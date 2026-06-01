import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test('sidebar navigation uses semantic buttons and has correct aria-current', async ({ page }) => {
  await page.goto('/');

  // Wait for the app to be ready
  await expect(page.locator('.layout-container')).toBeVisible({ timeout: 10000 });

  await ensureNavVisible(page);

  const navButtons = page.locator('.nav-button');
  // On mobile/tablet, both the SidebarNav and Header might have elements,
  // but we specifically check for the visible ones.
  const count = await navButtons.filter({ visible: true }).count();
  expect(count).toBeGreaterThanOrEqual(5);

  // Check the first button (Editor) - it should be active by default
  const editorButton = navButtons.filter({ hasText: 'Editor', visible: true }).first();
  await expect(editorButton).toHaveAttribute('aria-current', 'page');
  await expect(editorButton).toHaveClass(/active/);

  // Click on Graph button
  const graphButton = navButtons.filter({ hasText: 'Graph', visible: true }).first();
  await expect(graphButton).not.toHaveAttribute('aria-current', 'page');

  await graphButton.click();

  // Menu closes after click on responsive layouts, reopen it to check state
  await ensureNavVisible(page);

  // Now Graph should be active
  await expect(graphButton).toHaveAttribute('aria-current', 'page');
  await expect(graphButton).toHaveClass(/active/);
  await expect(editorButton).not.toHaveAttribute('aria-current', 'page');
  await expect(editorButton).not.toHaveClass(/active/);

  // Verify focus-visible state (simulate keyboard navigation)
  await graphButton.focus();
  await expect(graphButton).toBeFocused();
});
