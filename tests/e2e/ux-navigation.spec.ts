import { test, expect } from '@playwright/test';

test('sidebar navigation uses semantic buttons and has correct aria-current', async ({ page }) => {
  await page.goto('/');

  // Wait for the app to be ready
  await expect(page.locator('.layout-container')).toBeVisible({ timeout: 10000 });

  const navButtons = page.locator('.nav-button');
  // There are 8 nav buttons in total (Editor, Library, Graph, Mind Map, Search, Chat, Export, AI Harness)
  await expect(navButtons).toHaveCount(8);

  // Check the first button (Editor) - it should be active by default
  const editorButton = page.getByRole('button', { name: 'Editor' });
  await expect(editorButton).toHaveAttribute('aria-current', 'page');
  await expect(editorButton).toHaveClass(/active/);

  // Click on Graph button
  const graphButton = page.getByRole('button', { name: 'Graph' });
  await expect(graphButton).not.toHaveAttribute('aria-current', 'page');

  await graphButton.click();

  // Now Graph should be active
  await expect(graphButton).toHaveAttribute('aria-current', 'page');
  await expect(graphButton).toHaveClass(/active/);
  await expect(editorButton).not.toHaveAttribute('aria-current', 'page');
  await expect(editorButton).not.toHaveClass(/active/);

  // Verify focus-visible state (simulate keyboard navigation)
  await graphButton.focus();
  await expect(graphButton).toBeFocused();
});
