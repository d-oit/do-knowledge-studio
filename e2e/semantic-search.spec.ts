import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

const SEMANTIC_FALLBACK_ASSERTION_TIMEOUT_MS = 10_000;
const SEMANTIC_FALLBACK_TEST_TIMEOUT_MS = 15_000;

/**
 * Semantic search (N1, Issue #751) — UI-level coverage only.
 *
 * No model download happens here: the spec returns a deterministic 404 for
 * Hugging Face Hub and transformers.js WASM CDN requests to force the graceful
 * lexical fallback path with its surfaced hint. Ranking behavior itself is
 * covered by the mocked unit tests (embeddings/vector-store/worker).
 */
test.describe('Semantic search toggle', () => {
  // Prevent the app service worker from forwarding model requests outside the
  // Playwright route handler.
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    // Use an immediate missing-asset response instead of relying on browser
    // network abort/retry scheduling. Subdomains matter: model files live on
    // cdn-lfs.huggingface.co and tokenizer/assets may come from jsdelivr.
    await page.route(
      /^https:\/\/(?:[a-z0-9-]+\.)*(?:huggingface\.co|cdn\.hf\.co|cdn\.jsdelivr\.net)\//,
      (route) =>
        route.fulfill({
          status: 404,
          contentType: 'text/plain',
          body: 'Model unavailable in E2E',
        }),
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
    test.setTimeout(SEMANTIC_FALLBACK_TEST_TIMEOUT_MS);

    await page.getByRole('switch', { name: /semantic search/i }).click();
    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    await searchInput.fill('triz');

    const status = page.getByRole('status').filter({ hasText: /keyword results/i });
    await expect(status).toBeVisible({
      timeout: SEMANTIC_FALLBACK_ASSERTION_TIMEOUT_MS,
    });
    await expect(searchInput).toHaveValue('triz');
    await expect(
      page.getByRole('heading', { name: 'TRIZ Contradiction Matrix' }),
    ).toBeVisible();
  });
});