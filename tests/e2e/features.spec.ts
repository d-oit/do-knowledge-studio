import { test, expect } from '@playwright/test';

test.describe('Entity CRUD', () => {
  test('User can create a new entity', async ({ page }) => {
    await page.goto('/');
    // Use layout-container to verify initial load
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    // Click Editor and wait for it to be active
    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 10000 });
  });

  test('User can view entity details', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Claims', () => {
  test('User can add a claim to an entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Editor' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Search', () => {
  test('User can search via chat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Chat' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 10000 });

    const input = page.locator('input[placeholder*="Ask"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message-bubble')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Graph', () => {
  test('Graph visualization renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Graph' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.graph-container')).toBeVisible({ timeout: 10000 });
  });

  test('Graph has control buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Graph' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('button[title*="Zoom"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[title*="Fit"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mind Map', () => {
  test('Mind map view renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });
    const btn = page.getByRole('button', { name: 'Mind Map' });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await expect(page.locator('.mindmap-container')).toBeVisible({ timeout: 10000 });
  });
});
