import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';
import { createNewEntity } from './helpers/editor';

/**
 * Rule-based claim extraction (N4): an `Assertion: ... (Source: ...)` block
 * typed into an entity note converts into a structured Claim row.
 */
test.describe('Claim extraction', () => {
  test('converts an assertion in a note into a structured claim', async ({ page }) => {
    await createNewEntity(page, 'Claim Extraction Test');

    await page.getByLabel('Editor content').fill(
      'A note about capitals.\n\nAssertion: The capital of France is Paris (Source: geography textbook)',
    );
    await page.getByRole('button', { name: /save|commit/i }).click();

    // The claims panel is shown for an editing entity, so re-open the saved
    // entity from the library (commitEntity leaves the editor in new-entity
    // mode).
    await navClick(page, /library/i);
    await page.getByRole('heading', { name: 'Claim Extraction Test', exact: true }).click();

    const extractButton = page.getByRole('button', { name: /extract claims/i });
    await expect(extractButton).toBeVisible();

    await extractButton.click();
    // Preview dialog lists the parsed assertion (scope to the dialog: the
    // same sentence also sits in the editor textarea and the claims panel).
    const extractDialog = page.getByRole('dialog', { name: /extract claims/i });
    await expect(extractDialog.getByText(/The capital of France is Paris/)).toBeVisible();

    await page.getByRole('button', { name: /add 1 claim/i }).click();

    // The claim row appears in the claims panel with statement and source.
    const claimsPanel = page.getByRole('region', { name: 'Claims' });
    await expect(claimsPanel.getByText(/The capital of France is Paris/)).toBeVisible();
    await expect(claimsPanel.getByText('geography textbook')).toBeVisible();
  });

  test('extracting the same assertion twice does not duplicate the claim', async ({ page }) => {
    await createNewEntity(page, 'Claim Extraction Dedupe');

    await page.getByLabel('Editor content').fill(
      'Assertion: Ostriches cannot fly (Source: zoo guide)',
    );
    await page.getByRole('button', { name: /save|commit/i }).click();

    await navClick(page, /library/i);
    await page.getByRole('heading', { name: 'Claim Extraction Dedupe', exact: true }).click();

    const extractButton = page.getByRole('button', { name: /extract claims/i });
    await expect(extractButton).toBeVisible();
    await extractButton.click();
    await page.getByRole('button', { name: /add 1 claim/i }).click();

    // Extract the same note again: the second add skips the duplicate.
    await extractButton.click();
    await page.getByRole('button', { name: /add 1 claim/i }).click();

    await expect(page.getByText(/Skipped 1 duplicate/)).toBeVisible();
    // Scope to the claims panel: the note body also contains the statement.
    const claimsPanel = page.getByRole('region', { name: 'Claims' });
    await expect(claimsPanel.getByText(/Ostriches cannot fly/)).toHaveCount(1);
  });
});