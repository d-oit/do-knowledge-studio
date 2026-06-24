import { Page, expect } from '@playwright/test';

export async function ensureNavVisible(page: Page) {
  const navButton = page.locator('.nav-button').filter({ hasText: 'Editor' });
  if (!(await navButton.isVisible())) {
    const menuButton = page.getByLabel('Open menu');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }
  }
}

export async function closeNav(page: Page) {
  const menuButton = page.getByLabel('Close menu');
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Creates a test entity via the editor and waits for the save to complete.
 * The save button is disabled until the tiptap editor is fully initialized,
 * so we wait for it to be enabled before clicking.
 */
export async function saveTestEntity(page: Page, name: string, options?: { type?: string }) {
  await ensureNavVisible(page);
  await page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first().click();
  await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
  await closeNav(page);

  await page.fill('#entity-title', name);
  await expect(page.locator('#entity-title')).toHaveValue(name, { timeout: 5000 });

  if (options?.type) {
    await page.selectOption('#entity-type', options.type);
  }

  // Ensure React has synced the controlled input state before save
  await page.waitForTimeout(500);

  // Wait for the save button to be enabled (indicates editor is fully initialized)
  const saveBtn = page.locator('button:has-text("Save to DB")');
  await expect(saveBtn).toBeEnabled({ timeout: 15000 });

  await saveBtn.click();

  // Wait for save success
  await expect(page.locator('[role="alert"]')).toContainText(
    /Saved successfully|updated successfully/,
    { timeout: 10000 }
  );

  // Brief pause for FTS5 indexing
  await page.waitForTimeout(1000);
}
