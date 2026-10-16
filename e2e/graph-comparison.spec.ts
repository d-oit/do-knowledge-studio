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
 * 4. The overlay reports canvas deltas (layout/zoom/pan/focus/selection).
 * 5. Canvas keyboard shortcuts stand down while the modal is open, then resume.
 */
test.describe('Graph Revision Comparison', () => {
  test('disables compare button initially, enables on save, shows added nodes, and shields canvas keys', async ({
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
    await expect(dialog.getByText(/canvas changes/i)).toBeVisible();
    await expect(dialog.getByText(/added entities/i)).toBeVisible();
    await expect(dialog.getByText(newEntityName)).toBeVisible();

    // Canvas shortcuts must stand down while the modal owns the keyboard:
    // without the shield, this key would pan the graph behind the dialog.
    const canvas = page.getByRole('application', { name: /graph canvas/i });
    const svg = page.getByRole('img', { name: /knowledge graph/i });
    const viewBoxBefore = (await svg.getAttribute('viewBox')) ?? '';
    await page.keyboard.press('ArrowRight');
    await expect(svg).toHaveAttribute('viewBox', viewBoxBefore);

    // Close dialog, re-focus the canvas, and confirm the shortcut resumes.
    const closeBtn = dialog.getByRole('button', { name: /close/i }).first();
    await closeBtn.click();
    await expect(dialog).toBeHidden();
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(svg).not.toHaveAttribute('viewBox', viewBoxBefore);
  });
});
