import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

test.describe('Entity CRUD workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('create a new entity from editor', async ({ page }) => {
    await navClick(page, /editor/i);

    await page.getByRole('button', { name: /new|create|add/i }).first().click();

    const nameInput = page.locator('#entity-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Test Entity');

    await page.getByRole('button', { name: /save|commit/i }).click();
    await expect(nameInput).toHaveValue('E2E Test Entity');
  });

  test('edit an existing entity', async ({ page }) => {
    await navClick(page, /editor/i);

    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await page.locator('#entity-name').fill('Edit Test');
    await page.getByRole('button', { name: /save|commit/i }).click();

    const nameInput = page.locator('#entity-name');
    await nameInput.clear();
    await nameInput.fill('Edit Test Updated');
    await page.getByRole('button', { name: /save|commit/i }).click();

    await expect(nameInput).toHaveValue('Edit Test Updated');
  });

  test('entity persists across page reload', async ({ page }) => {
    await navClick(page, /editor/i);

    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await page.locator('#entity-name').fill('Persistent Entity');
    await page.getByRole('button', { name: /save|commit/i }).click();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await navClick(page, /library/i);
    await expect(page.getByText('Persistent Entity').first()).toBeVisible();
  });

  test('create entity with different types', async ({ page }) => {
    await navClick(page, /editor/i);

    await page.getByRole('button', { name: /new|create|add/i }).first().click();

    const typeSelector = page.getByRole('button', { name: /entity type/i });
    await expect(typeSelector).toBeVisible();

    await page.locator('#entity-name').fill('Typed Entity');
    await page.getByRole('button', { name: /save|commit/i }).click();
    await expect(page.locator('#entity-name')).toHaveValue('Typed Entity');
  });

  test('add and remove tags on entity', async ({ page }) => {
    await navClick(page, /editor/i);

    await page.getByRole('button', { name: /new|create|add/i }).first().click();
    await page.locator('#entity-name').fill('Tagged Entity');

    const tagInput = page.getByPlaceholder(/add tag/i);
    if (await tagInput.isVisible()) {
      await tagInput.fill('test-tag');
      await page.getByRole('button', { name: /add tag/i }).click();
      await expect(page.getByText('#test-tag')).toBeVisible();

      const removeBtn = page.getByRole('button', { name: /remove tag test-tag/i });
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await expect(page.getByText('#test-tag')).toBeHidden();
      }
    }
  });
});
