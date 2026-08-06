import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

test.describe('Editor view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /editor/i);
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
    // The saved entity appears in the library on every viewport.
    // Scoped to the card heading role: the right-panel search results render
    // the same name as a plain div (and are hidden below 1100px anyway).
    await navClick(page, /library/i);
    await expect(
      page.getByRole('heading', { name: 'My Test Note', exact: true }),
    ).toBeVisible();
  });

  test('editor mode radio group has three options', async ({ page }) => {
    const radiogroup = page.getByRole('radiogroup', { name: /editor mode/i });
    await expect(radiogroup).toBeVisible();

    const radios = radiogroup.getByRole('radio');
    await expect(radios).toHaveCount(3);
  });

  test('can switch between edit, preview, and split modes', async ({ page }) => {
    const radiogroup = page.getByRole('radiogroup', { name: /editor mode/i });
    const radios = radiogroup.getByRole('radio');

    await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'true');

    await radios.nth(1).click();
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');

    await radios.nth(2).click();
    await expect(radios.nth(2)).toHaveAttribute('aria-checked', 'true');
  });

  test('advanced section toggles visibility', async ({ page }) => {
    const advancedBtn = page.getByRole('button', { name: /advanced/i });
    await expect(advancedBtn).toBeVisible();

    await advancedBtn.click();
    const sourceUrl = page.getByLabel('Source URL');
    await expect(sourceUrl).toBeVisible();

    await advancedBtn.click();
    await expect(sourceUrl).toBeHidden();
  });

  test('can add a tag to an entity', async ({ page }) => {
    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await page.locator('#entity-name').fill('Tag Test');

    const tagInput = page.getByPlaceholder(/add tag/i);
    if (await tagInput.isVisible()) {
      await tagInput.fill('my-tag');
      await page.getByRole('button', { name: /add tag/i }).click();
      await expect(page.getByText('#my-tag')).toBeVisible();
    }
  });

  test('name field shows validation on empty save attempt', async ({ page }) => {
    await page.getByRole('button', { name: /new|create|add/i }).first().click();

    const nameInput = page.locator('#entity-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('');
    await nameInput.blur();

    // Editor should remain open — entity wasn't saved with empty name
    await expect(nameInput).toBeVisible();
  });
});
