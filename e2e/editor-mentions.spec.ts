import { test, expect } from '@playwright/test';
import { createNewEntity, switchEditorMode } from './helpers/editor';
import { navClick } from './helpers/navigation';

test.describe('Editor @mention entity linking', () => {
  test('mentions a seed entity and links it on save', async ({ page }) => {
    await createNewEntity(page, 'Mentions Note');

    // Type a mention query into the content editor.
    const editor = page.getByLabel('Editor content');
    await editor.click();
    await editor.pressSequentially('See @Altshuller', { delay: 30 });

    // The picker lists the seed entity; selecting inserts the markdown token.
    const listbox = page.getByRole('listbox', { name: /mention/i });
    await expect(listbox).toBeVisible();
    const option = page.getByRole('option', { name: /Genrich Altshuller/i });
    await expect(option).toBeVisible();
    await option.click();
    await expect(editor).toHaveValue(/\[@Genrich Altshuller\]\(dks:\/\/entity\/e2\)/);

    // Preview renders the mention as a styled chip (custom `a` component).
    await switchEditorMode(page, 1);
    await expect(page.locator('[data-mention-id="e2"]')).toBeVisible();

    // Save — the reciprocal backlink write (saveEntity) lands on the library.
    await page.getByRole('button', { name: /save to library/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Mentions Note', exact: true }),
    ).toBeVisible();

    // The graph shows the mention edges around the new note.
    await navClick(page, /graph/i);
    await page.getByRole('button', { name: /Mentions Note/ }).click();
    // Scope to the graph svg: outside the canvas the same relation words
    // appear on entity cards and in edge lists (strict-mode violations).
    const graph = page.getByRole('img', { name: /knowledge graph/i });
    await expect(graph.getByText('mentions', { exact: true })).toBeVisible();
    await expect(graph.getByText('mentioned-in', { exact: true })).toBeVisible();
  });
});