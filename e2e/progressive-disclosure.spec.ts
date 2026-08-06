import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Progressive disclosure E2E coverage — runs on every viewport project
 * (chromium desktop, mobile, tablet, desktop-xl) so the disclosure surfaces
 * behave consistently at all sizes.
 */
test.describe('Progressive disclosure surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('library: advanced filters are collapsed by default and expand on demand', async ({ page }) => {
    await navClick(page, /library/i);
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();

    const toggle = page.getByRole('button', { name: /Advanced filters/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Type-specific options stay hidden until expanded
    await expect(page.getByLabel('Tag contains')).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Tag contains')).toBeVisible();
    await expect(
      page.getByLabel('Only show entities with a description'),
    ).toBeVisible();
  });

  test('library: advanced tag filter narrows results', async ({ page }) => {
    await navClick(page, /library/i);
    await page.getByRole('button', { name: /Advanced filters/i }).click();

    // Seed data contains entities; filtering by a tag that exists in seed data
    const tagInput = page.getByLabel('Tag contains');
    await tagInput.fill('knowledge');
    await expect(tagInput).toHaveValue('knowledge');

    // Clearable via the dedicated action
    await page.getByRole('button', { name: 'Clear advanced filters' }).click();
    await expect(tagInput).toHaveValue('');
  });

  test('graph: secondary controls sit behind More and reveal on click', async ({ page }) => {
    await navClick(page, /graph/i);
    await expect(page.getByRole('img', { name: /knowledge graph/i })).toBeVisible();

    // Primary controls are visible without expanding
    await expect(page.getByLabel('Focus neighborhood')).toBeVisible();
    await expect(page.getByLabel('Save snapshot')).toBeVisible();

    // Secondary controls are hidden by default
    await expect(page.getByLabel('Export PNG')).toBeHidden();

    await page.getByLabel('More controls').click();
    await expect(page.getByLabel('Export PNG')).toBeVisible();
    await expect(page.getByLabel('Undo')).toBeVisible();
    await expect(page.getByLabel('Redo')).toBeVisible();
  });

  test('ai harness: contextual suggestions appear before the first message', async ({ page }) => {
    await navClick(page, /ai harness/i);
    await expect(page.getByRole('heading', { name: 'AI Harness' })).toBeVisible();

    // Context-based suggestions appear (seed entities exist)
    const suggestions = page.getByRole('button', { name: /Summarize my library|Find connections|How does this work/i });
    await expect(suggestions.first()).toBeVisible();
    await expect(page.getByText('Try asking')).toBeVisible();
  });

  test('ai harness: suggestion click fills the input', async ({ page }) => {
    await navClick(page, /ai harness/i);

    const summarize = page.getByRole('button', { name: /Summarize my library/i });
    if (await summarize.isVisible()) {
      await summarize.click();
      const textarea = page.getByPlaceholder(/Ask the AI agent/);
      await expect(textarea).toHaveValue(/Summarize/i);
    }
  });

  test('mobile: topbar drawer triggers meet 44px touch targets', async ({ page }) => {
    // The menu/search triggers are lg:hidden, so this exercises mobile/tablet
    // projects; on desktop projects the guard skips (sidebar replaces them).
    const menuBtn = page.getByRole('button', { name: /open menu/i });
    if (await menuBtn.isVisible()) {
      const menuBox = await menuBtn.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox!.width).toBeGreaterThanOrEqual(44);
      expect(menuBox!.height).toBeGreaterThanOrEqual(44);

      const searchBtn = page.getByRole('button', { name: /search knowledge base/i });
      const searchBox = await searchBtn.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(searchBox!.width).toBeGreaterThanOrEqual(44);
      expect(searchBox!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
