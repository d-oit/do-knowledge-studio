import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';
import { createNewEntity } from './helpers/editor';

/**
 * Graph Revision Comparison Overlay tests (Plan 170).
 *
 * Verifies that:
 * 1. The "Compare revision" button is disabled when no snapshot is saved.
 * 2. Saving a snapshot enables the "Compare revision" button.
 * 3. Adding a new entity/node reflects in the comparison overlay as an added entity.
 * 4. The comparison overlay is accessible (dialog role, title, close action).
 */
test.describe('Graph Revision Comparison', () => {
  test('disables compare button initially, enables on save, and displays added nodes in overlay', async ({
    page,
  }) => {
    await page.goto('/');
    await navClick(page, /graph/i);

    const compareBtn = page.getByRole('button', { name: /compare revision/i });
    await expect(compareBtn).toBeVisible();
    await expect(compareBtn).toBeDisabled();

    // Save snapshot of initial graph state
    const saveBtn = page.getByRole('button', { name: /save snapshot/i });
    await saveBtn.click();
    await expect(compareBtn).toBeEnabled();

    // Create a new entity in the editor
    await navClick(page, /editor/i);
    const newEntityName = `Comparison Node ${Date.now()}`;
    await createNewEntity(page, newEntityName);
    await page.getByRole('button', { name: /save|commit/i }).click();

    // Return to graph view and open comparison overlay
    await navClick(page, /graph/i);
    await expect(compareBtn).toBeEnabled();
    await compareBtn.click();

    // Verify modal dialog appearance and content
    const dialog = page.getByRole('dialog', { name: /graph revision comparison/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/added entities/i)).toBeVisible();
    await expect(dialog.getByText(newEntityName)).toBeVisible();

    // Close dialog
    const closeBtn = dialog.getByRole('button', { name: /close/i }).first();
    await closeBtn.click();
    await expect(dialog).toBeHidden();
  });
});
