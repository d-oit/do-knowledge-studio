import { type Page } from '@playwright/test';
import { navClick } from './navigation';

/**
 * Navigate to the editor and start a new entity with the given name.
 *
 * Shared by the editor, crud-workflow, and markdown-preview specs so the
 * entity-creation setup lives in one place instead of being copy-pasted
 * into every beforeEach.
 */
export const createNewEntity = async (page: Page, name = 'Test Entity'): Promise<void> => {
  await page.goto('/');
  await navClick(page, /editor/i);
  await page.getByRole('button', { name: /new|create|add/i }).first().click();
  await page.locator('#entity-name').fill(name);
}

/**
 * Switch the editor-mode radio group to the given index:
 * 0 = edit, 1 = preview, 2 = split.
 */
export const switchEditorMode = async (page: Page, index: number): Promise<void> => {
  await page.getByRole('radiogroup', { name: /editor mode/i }).getByRole('radio').nth(index).click();
}
