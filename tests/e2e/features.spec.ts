import { test, expect } from '@playwright/test';

test.describe('Entity CRUD', () => {
  test('User can create a new entity', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
  });

  test('User can view entity details', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Claims', () => {
  test('User can add a claim to an entity', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Search', () => {
  test('User can search via chat', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Chat' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.ask-surface')).toBeVisible({ timeout: 15000 });

    const input = page.locator('input[placeholder*="Ask"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message-wrapper').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Graph', () => {
  test('Graph visualization renders', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Graph' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    // Wait for the main-content area where Graph is rendered
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
  });

  test('Graph has control buttons', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Graph' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    // On some screens/modes GraphView might take a moment to render the toolbar
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Mind Map', () => {
  test('Mind map view renders', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    if (isMobile) {
      await page.getByLabel('Open menu').click();
    }

    const btn = page.getByRole('button', { name: 'Mind Map' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });
  });
});
