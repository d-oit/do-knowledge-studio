import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('AI Harness view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /ai harness/i);
  });

  test('navigates to AI Harness and shows heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Harness' })).toBeVisible();
  });

  test('shows Lab badge', async ({ page }) => {
    await expect(page.locator('.rounded-full').filter({ hasText: 'Lab' }).first()).toBeVisible();
  });

  test('shows description text', async ({ page }) => {
    await expect(
      page.getByText(/Connect a language model and augment/i),
    ).toBeVisible();
  });

  test('shows settings toggle button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /show settings/i })).toBeVisible();
  });

  test('toggles settings panel visibility', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /show settings/i });
    await toggle.click();

    // Settings panel should appear
    await expect(page.getByText('Hide settings')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Provider' })).toBeVisible();

    // Hide settings
    await page.getByRole('button', { name: /hide settings/i }).click();
    await expect(page.getByRole('button', { name: /show settings/i })).toBeVisible();
  });

  test('chat textarea and send button are present', async ({ page }) => {
    await expect(page.getByPlaceholder(/Ask the AI agent/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('shows initial assistant message', async ({ page }) => {
    await expect(page.getByText(/AI agent ready to assist/)).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeDisabled();
  });

  test('send button enables when text is entered', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Ask the AI agent/);
    await textarea.fill('Hello');
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeEnabled();
  });

  test('settings panel shows provider selector', async ({ page }) => {
    await page.getByRole('button', { name: /show settings/i }).click();

    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();
    await expect(providerSelect).toHaveValue(/openrouter|ollama/);
  });

  test('settings panel shows augment toggle', async ({ page }) => {
    await page.getByRole('button', { name: /show settings/i }).click();
    await expect(page.getByText(/Augment with local knowledge/i)).toBeVisible();
  });

  test('settings panel shows status section', async ({ page }) => {
    await page.getByRole('button', { name: /show settings/i }).click();
    await expect(page.getByText('Status')).toBeVisible();
    // Use exact match to avoid 'Offline ready' and 'AI agent ready' false positives
    await expect(page.locator('span.font-mono', { hasText: /^Ready$/ })).toBeVisible();
  });

  test('augmented indicator shows in chat footer', async ({ page }) => {
    await expect(
      page.getByText(/Augmented with local knowledge|No augmentation/),
    ).toBeVisible();
  });

  test('active engine model shown in chat footer', async ({ page }) => {
    // The effective model should be displayed somewhere in the footer
    await expect(page.locator('.font-mono').last()).toBeVisible();
  });
});
