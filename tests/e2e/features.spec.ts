import { test, expect } from '@playwright/test';

test('Chat uses local search', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Chat")');

  await expect(page.locator('.chat-view')).toBeVisible();

  const input = page.locator('input[placeholder*="Search entities"]');
  await input.fill('TRIZ');
  await page.keyboard.press('Enter');

  // Assistant should respond
  await expect(page.locator('.message.assistant')).toBeVisible();
  // It might show results or "not found" depending on DB state, but it should process.
});

test('Graph View focus mode', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Graph")');

  await expect(page.locator('.graph-container')).toBeVisible();

  const focusBtn = page.locator('button[title*="Focus Neighborhood"]');
  await expect(focusBtn).toBeDisabled(); // Disabled by default since no node selected

  // Note: Selection and filtering logic is hard to test without specific nodes,
  // but we can verify the button state.
});
