import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * N6 — fully-offline local LLM provider (issue #756).
 *
 * Deliberately network-free: nothing here sends a chat or downloads a model.
 * It only proves the settings surface exposes the in-browser local provider
 * and that selecting it hides the API key field (the adapter itself is
 * covered by unit tests with a mocked transformers.js module).
 */
test.describe('Local (in-browser) LLM provider', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /ai harness/i);
    await page.getByRole('button', { name: /show settings/i }).click();
  });

  test('provider selector includes the in-browser local option', async ({ page }) => {
    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();

    const localOption = providerSelect.locator('option', { hasText: 'Local (in-browser)' });
    // Options inside a closed native select are never "visible" in Playwright
    // — assert existence/value instead.
    await expect(localOption).toHaveCount(1);
    await expect(localOption).toHaveAttribute('value', 'local');
  });

  test('selecting local hides the API key field and shows the download hint', async ({ page }) => {
    // Default provider (OpenRouter) shows the key field.
    await expect(page.getByPlaceholder('sk-or-…')).toBeVisible();

    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption('local');

    // No API key required for the in-browser provider.
    await expect(page.getByPlaceholder('sk-or-…')).toHaveCount(0);
    // First-use download copy is surfaced.
    await expect(page.getByText(/First use downloads the model/i)).toBeVisible();
  });

  test('local provider lists quantized in-browser models in the engine selector', async ({ page }) => {
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption('local');

    const engineSelect = page.locator('select').nth(1);
    await expect(engineSelect.locator('option', { hasText: 'Qwen2.5' })).toHaveCount(1);
  });
});