import { test, expect } from '@playwright/test';

test.describe('Editor view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can create a new entity by clicking the new button', async ({ page }) => {
    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await expect(page.locator('#entity-name')).toBeVisible();
  });

  test('can type in the name field', async ({ page }) => {
    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    const nameInput = page.locator('#entity-name');
    await nameInput.fill('Test Entity');
    await expect(nameInput).toHaveValue('Test Entity');
  });

  test('can save an entity with a name', async ({ page }) => {
    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await page.locator('#entity-name').fill('My Test Note');
    await page.getByRole('button', { name: /save|commit/i }).click();
    await expect(page.getByText('My Test Note')).toBeVisible();
  });
});
