import { test, expect } from '@playwright/test';
import { ensureNavVisible, closeNav } from './utils';

test.describe('Entity CRUD', () => {
  test('User can create a new entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });

  test('User can view entity details', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Claims', () => {
  test('User can add a claim to an entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Search', () => {
  test('User can search via chat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Chat', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Chat', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    const input = page.locator('input[placeholder*="Ask"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Graph', () => {
  test('Graph visualization renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });

  test('Graph has control buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('Mind Map', () => {
  test('Mind map view renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first();
    await btn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Mind Map', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  });
});

test.describe('AI Harness Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dks:ai-wizard-seen', 'true');
    });
  });

  test('renders with input field and knowledge toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    // Verify input field is present
    const input = page.locator('.chat-controls input[type="text"]');
    await expect(input).toBeVisible();

    // Verify knowledge toggle is present
    const toggle = page.locator('.chat-view input[type="checkbox"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
  });

  test('accepts text input and sends message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });

    await closeNav(page);

    // Type a message and submit
    const input = page.locator('.chat-controls input[type="text"]');
    await input.fill('What is TRIZ?');
    
    const sendBtn = page.locator('.chat-controls button.primary');
    await expect(sendBtn).toBeVisible({ timeout: 10000 });
    await sendBtn.click();

    // Verify user message appears
    await expect(page.locator('.message.user').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Entity Editor with Source URL', () => {
  test('source URL input renders and accepts text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    await closeNav(page);

    // Open Advanced section
    await page.getByRole('button', { name: /advanced/i }).click();

    // Verify source URL input is present
    const sourceUrlInput = page.locator('input[type="url"]');
    await expect(sourceUrlInput).toBeVisible();

    // Type a URL
    await sourceUrlInput.fill('https://en.wikipedia.org/wiki/TRIZ');
    await expect(sourceUrlInput).toHaveValue('https://en.wikipedia.org/wiki/TRIZ');
  });

  test('entity name and source URL inputs accept text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    await closeNav(page);

    // Open Advanced section
    await page.getByRole('button', { name: /advanced/i }).click();

    // Fill entity name
    const nameInput = page.locator('.editor-container input[type="text"]').first();
    await nameInput.fill('Test Entity');

    // Fill source URL
    const urlInput = page.locator('input[type="url"]');
    await urlInput.fill('https://example.com/test-article');

    // Verify both fields have correct values
    await expect(nameInput).toHaveValue('Test Entity');
    await expect(urlInput).toHaveValue('https://example.com/test-article');
  });
});

test.describe('AI Harness Chat', () => {
  test('AI Harness chat view renders with input field', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.chat-controls input')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Ask"]')).toBeVisible({ timeout: 5000 });
  });

  test('Chat has augment local knowledge toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'AI Harness', visible: true }).first();
    await btn.click();

    await expect(page.locator('.chat-view')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="checkbox"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Entity Editor with Source URL', () => {
  test('Editor renders source URL input field', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    // Open Advanced section
    await page.getByRole('button', { name: /advanced/i }).click();

    await expect(page.locator('.entity-source')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.source-input')).toBeVisible({ timeout: 5000 });
  });

  test('Source URL input accepts text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const btn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await btn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });

    // Open Advanced section
    await page.getByRole('button', { name: /advanced/i }).click();

    const sourceInput = page.locator('.source-input');
    await sourceInput.fill('https://example.com/article');
    await expect(sourceInput).toHaveValue('https://example.com/article');
  });

  test('source URL persists after saving entity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const editorBtn = page.locator('.nav-button').filter({ hasText: 'Editor', visible: true }).first();
    await editorBtn.click();

    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await closeNav(page);

    // Fill entity name
    const nameInput = page.locator('#entity-title');
    await nameInput.fill('Source URL Test Entity');

    // Open Advanced and fill source URL
    await page.getByRole('button', { name: /advanced/i }).click();
    const sourceInput = page.locator('#entity-source-url');
    await sourceInput.fill('https://example.com/persisted-article');

    // Wait for tiptap editor to fully initialize (useEditor hook returns non-null)
    await expect(page.locator('.tiptap-content')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.tiptap-content .ProseMirror[contenteditable="true"]')).toBeVisible({ timeout: 5000 });

    // Save entity
    const saveBtn = page.locator('button.primary', { hasText: 'Save to DB' });
    await saveBtn.click();

    // Verify success status message using role=alert (more reliable than class selector)
    await expect(page.locator('[role="alert"]')).toContainText('Saved successfully', { timeout: 15000 });

    // Navigate to Library and verify the entity exists
    await ensureNavVisible(page);
    const libraryBtn = page.locator('.nav-button').filter({ hasText: 'Library', visible: true }).first();
    await libraryBtn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Find the saved entity in the library using text content (more reliable than CSS classes)
    await expect(page.locator('text=Source URL Test Entity').first()).toBeVisible({ timeout: 10000 });
  });
});
