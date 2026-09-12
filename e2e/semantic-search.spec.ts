import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Semantic search (N1, Issue #751) — UI-level coverage only.
 *
 * No model download happens here: the spec aborts requests to the Hugging
 * Face Hub and the transformers.js WASM CDN, which forces the graceful
 * lexical fallback path with its surfaced hint. Ranking behavior itself is
 * covered by the mocked unit tests (embeddings/vector-store/worker).
 */
test.describe('Semantic search toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Block the embedding model and WASM binaries so the embedder cannot
    // load — semantic queries then degrade to the lexical fallback hint.
    // Subdomains matter: the model files live on cdn-lfs.huggingface.co and
    // the tokenizer/assets may come from jsdelivr subdomains.
    await page.route(
      /^https:\/\/(?:[a-z0-9-]+\.)*(?:huggingface\.co|cdn\.jsdelivr\.net)\//,
      (route) => route.abort(),
    );
    await page.goto('/');
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('renders an accessible semantic search toggle', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /semantic search/i });
    await expect(toggle).toBeVisible();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    expect(await toggle.getAttribute('aria-checked')).toBe('false');
  });

  test('toggles semantic mode on and off', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /semantic search/i });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('surfaces a lexical fallback hint when the semantic model is unavailable', async ({
    page,
  }) => {
    await page.getByRole('switch', { name: /semantic search/i }).click();
    await page.getByRole('searchbox', { name: /search library/i }).fill('triz');

    const status = page.getByRole('status').filter({ hasText: /keyword results/i });
    // transformers.js spends several seconds failing its CDN fetches (model
    // + WASM) before surfacing the embedder error that drives the fallback.
    await expect(status).toBeVisible({ timeout: 20_000 });

    // The search box keeps working — results still render (graceful fallback).
    await expect(page.getByRole('searchbox', { name: /search library/i })).toHaveValue('triz');
  });
});