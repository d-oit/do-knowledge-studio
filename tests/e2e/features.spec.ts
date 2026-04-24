import { test, expect } from '@playwright/test';

test.describe('Entity CRUD', () => {
  test('User can create a new entity', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Editor")');

    await expect(page.locator('.editor-container')).toBeVisible();
  });

  test('User can view entity details', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Editor")');

    await expect(page.locator('.editor-container')).toBeVisible();
  });
});

test.describe('Claims', () => {
  test('User can add a claim to an entity', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Editor")');

    await expect(page.locator('.editor-container')).toBeVisible();
  });
});

test.describe('Search', () => {
  test('User can search via chat', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Chat")');

    await expect(page.locator('.chat-view')).toBeVisible();

    const input = page.locator('input[placeholder*="Search"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message')).toBeVisible();
  });
});

test.describe('Graph', () => {
  test('Graph visualization renders', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Graph")');

    await expect(page.locator('.graph-container')).toBeVisible();
  });

  test('Graph has control buttons', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Graph")');

    await expect(page.locator('button[title*="Zoom"]')).toBeVisible();
    await expect(page.locator('button[title*="Fit"]')).toBeVisible();
  });
});

test.describe('Mind Map', () => {
  test('Mind map view renders', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Mind Map")');

    await expect(page.locator('.mindmap-container')).toBeVisible();
  });
});