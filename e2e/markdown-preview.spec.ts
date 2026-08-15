import { test, expect } from '@playwright/test';
import { createNewEntity, switchEditorMode } from './helpers/editor';

/**
 * Representative CommonMark sample exercising the baseline syntax the
 * editor preview supports. GFM extensions (tables, task lists,
 * strikethrough) are enabled via remark-gfm and covered by a dedicated
 * test below.
 */
const MARKDOWN_SAMPLE = [
  '# Heading One',
  '',
  '## Heading Two',
  '',
  '### Heading Three',
  '',
  '**bold text** and *italic text* and `inline code`',
  '',
  '- bullet one',
  '- bullet two',
  '',
  '1. first item',
  '2. second item',
  '',
  '> quoted line',
  '',
  '[external link](https://example.com)',
  '',
  '---',
].join('\n');

test.describe('Markdown preview', () => {
  test.beforeEach(async ({ page }) => {
    await createNewEntity(page, 'Markdown Preview Test');
    await page.getByLabel('Editor content').fill(MARKDOWN_SAMPLE);
    // Preview mode is the second radio in the editor-mode group.
    await switchEditorMode(page, 1);
  });

  const preview = (page: import('@playwright/test').Page) => page.locator('div.prose').first();

  test('renders headings at the correct levels', async ({ page }) => {
    const pane = preview(page);
    await expect(pane.getByRole('heading', { name: 'Heading One', level: 1 })).toBeVisible();
    await expect(pane.getByRole('heading', { name: 'Heading Two', level: 2 })).toBeVisible();
    await expect(pane.getByRole('heading', { name: 'Heading Three', level: 3 })).toBeVisible();
  });

  test('renders bold, italic, and inline code emphasis', async ({ page }) => {
    const pane = preview(page);
    await expect(pane.locator('strong', { hasText: 'bold text' })).toBeVisible();
    await expect(pane.locator('em', { hasText: 'italic text' })).toBeVisible();
    await expect(pane.locator('code', { hasText: 'inline code' })).toBeVisible();
  });

  test('renders unordered and ordered lists', async ({ page }) => {
    const pane = preview(page);
    const unordered = pane.locator('ul');
    await expect(unordered.getByText('bullet one')).toBeVisible();
    await expect(unordered.getByText('bullet two')).toBeVisible();
    const ordered = pane.locator('ol');
    await expect(ordered.getByText('first item')).toBeVisible();
    await expect(ordered.getByText('second item')).toBeVisible();
  });

  test('renders blockquotes and horizontal rules', async ({ page }) => {
    const pane = preview(page);
    await expect(pane.locator('blockquote', { hasText: 'quoted line' })).toBeVisible();
    await expect(pane.locator('hr')).toBeVisible();
  });

  test('renders links as anchors with the expected href', async ({ page }) => {
    const pane = preview(page);
    const link = pane.getByRole('link', { name: 'external link' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com');
  });

  test('renders GFM tables, task lists, and strikethrough', async ({ page }) => {
    // Switch back to edit mode to refill with GFM-only content.
    await switchEditorMode(page, 0);
    await page.getByLabel('Editor content').fill([
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '- [ ] open task',
      '- [x] done task',
      '',
      '~~strikethrough~~',
    ].join('\n'));
    await switchEditorMode(page, 1);

    const pane = preview(page);
    // GFM table renders with header and body cells.
    await expect(pane.locator('table')).toBeVisible();
    await expect(pane.getByRole('columnheader', { name: 'A' })).toBeVisible();
    await expect(pane.getByRole('cell', { name: '1' })).toBeVisible();
    // GFM task list renders disabled checkboxes with the correct state.
    const checkboxes = pane.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(2);
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
    // GFM strikethrough renders as <del>.
    await expect(pane.locator('del', { hasText: 'strikethrough' })).toBeVisible();
  });

  test('split mode shows the textarea and the preview side by side', async ({ page }) => {
    await switchEditorMode(page, 2);
    await expect(page.getByLabel('Editor content')).toBeVisible();
    await expect(preview(page).getByRole('heading', { name: 'Heading One', level: 1 })).toBeVisible();
  });

  test('shows the empty preview placeholder when content is empty', async ({ page }) => {
    // A fresh page load gives a blank editing session (the editor's content
    // state initializes from the entity on mount, so re-clicking "new" would
    // keep the previous draft).
    await createNewEntity(page);
    await switchEditorMode(page, 1);
    // The placeholder itself is markdown: `_Nothing to preview._` parses as
    // emphasis, so the visible text is "Nothing to preview." inside an <em>.
    await expect(preview(page).locator('em', { hasText: 'Nothing to preview.' })).toBeVisible();
  });
});
