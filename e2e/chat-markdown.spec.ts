import { test, expect } from '@playwright/test';
import { createNewEntity } from './helpers/editor';
import { navClick } from './helpers/navigation';
import { setStudioTheme } from './helpers/theme';
import { readTypographyStyles } from './helpers/typography';

const ENTITY_NAME = 'Typography Fixture';
const MARKDOWN_CONTENT = [
  '',
  '',
  '# Reply heading',
  '',
  'A styled paragraph.',
  '',
  '> Quoted text.',
  '',
  '- First item',
  '- Second item',
].join('\n');

const CHAT_QUERY_PLACEHOLDER = 'Ask about your library, or request a synthesis…';

test('renders a local assistant Markdown reply with theme-aware typography', async ({ page }) => {
  await createNewEntity(page, ENTITY_NAME);
  await page.getByLabel('Editor content', { exact: true }).fill(MARKDOWN_CONTENT);
  await page.getByRole('button', { name: /save|commit/i }).click();
  await navClick(page, /chat/i);

  const main = page.getByRole('main');
  const input = page.getByPlaceholder(CHAT_QUERY_PLACEHOLDER);
  await input.fill(ENTITY_NAME);
  await input.press('Enter');

  const heading = main.getByRole('heading', { name: 'Reply heading', level: 1 });
  await expect(heading).toBeVisible();
  const paragraph = heading.locator('xpath=following-sibling::p[1]');
  await expect(paragraph).toHaveText('A styled paragraph.');
  await expect(main.locator('blockquote', { hasText: 'Quoted text.' })).toBeVisible();
  const list = main.getByRole('list').filter({ hasText: 'First item' });
  await expect(list.getByText('First item', { exact: true })).toBeVisible();
  await expect(list.getByText('Second item', { exact: true })).toBeVisible();

  await setStudioTheme(page, 'light');
  const light = await readTypographyStyles(heading);
  expect(light.proseBody).not.toBe('');
  expect(light.paragraphColor).not.toBe('');
  expect(light.blockquoteBorderWidth).toBeGreaterThan(0);

  await setStudioTheme(page, 'dark');
  const dark = await readTypographyStyles(heading);
  expect(dark.proseBody).not.toBe('');
  expect(dark.paragraphColor).not.toBe('');
  expect(dark.blockquoteBorderWidth).toBeGreaterThan(0);
  expect(dark.proseBody).not.toBe(light.proseBody);
  expect(dark.paragraphColor).not.toBe(light.paragraphColor);
});
