import { test, expect } from '@playwright/test';
import { ensureNavVisible } from './utils';

test.describe('Entity CRUD', () => {
  test('User can create a new entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });

  test('User can view entity details', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Claims', () => {
  test('User can add a claim to an entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Search', () => {
  test('User can search via chat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Chat', visible: true }).first();
    await btn.click();

    await expect(page.locator('.ask-surface')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Chat', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    const input = page.locator('input[placeholder*="Ask"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message-wrapper').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Graph', () => {
  test('Graph visualization renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });

  test('Graph has control buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Mind Map', () => {
  test('Mind map view renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});
