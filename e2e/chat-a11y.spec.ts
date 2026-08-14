import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

test.describe('Chat accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /chat/i);
  });

  test('chat bubbles announce sender roles to screen readers', async ({ page }) => {
    // The store seeds a welcome assistant message; clear it so the assertions
    // below see exactly the one user and one assistant message this test sends.
    await page.getByRole('button', { name: 'Clear chat history' }).click();

    const textarea = page.getByPlaceholder('Ask about your library, or request a synthesis…');
    await textarea.fill('What is in my library?');
    await textarea.press('Enter');

    // The store replies locally (BM25 search) so both a user and an
    // assistant bubble render without any AI provider configured.
    const userLabel = page.getByText('You:', { exact: true });
    const assistantLabel = page.getByText('Assistant:', { exact: true });
    await expect(userLabel).toBeVisible();
    await expect(assistantLabel).toBeVisible();

    // Both labels are screen-reader-only: visually hidden via the sr-only
    // technique while still being announced, so sighted users keep clean
    // bubbles and assistive technology gets role context per message.
    await expect(userLabel).toHaveClass(/sr-only/);
    await expect(assistantLabel).toHaveClass(/sr-only/);
  });

  test('send and clear chat buttons expose matching tooltips', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toHaveAttribute('title', 'Send message');

    const clearBtn = page.getByRole('button', { name: 'Clear chat history' });
    await expect(clearBtn).toHaveAttribute('title', 'Clear chat history');
  });
});
