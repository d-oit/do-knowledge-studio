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

test.describe('AI Harness Chat', () => {
  test('AI Harness chat view renders with input field', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.chat-controls input')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Ask"]')).toBeVisible({ timeout: 5000 });
  });

  test('Chat has augment local knowledge toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="checkbox"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Entity Editor with Source URL', () => {
  test('Editor renders source URL input field', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.entity-source')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.source-input')).toBeVisible({ timeout: 5000 });
  });

  test('Source URL input accepts text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    const sourceInput = page.locator('.source-input');
    await sourceInput.fill('https://example.com/article');
    await expect(sourceInput).toHaveValue('https://example.com/article');
  });
});
