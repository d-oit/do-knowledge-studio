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

    await expect(page.locator('.ask-surface')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);
    await expect(page.locator('.nav-button').filter({ hasText: 'Chat', visible: true }).first()).toHaveAttribute('aria-current', 'page', { timeout: 10000 });

    const input = page.locator('input[placeholder*="Ask"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(page.locator('.message-wrapper').first()).toBeVisible({ timeout: 15000 });
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

    // Type a message and submit
    const input = page.locator('.chat-controls input[type="text"]');
    await input.fill('What is TRIZ?');
    
    const sendBtn = page.locator('.chat-controls button.primary');
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
});

test.describe('Progressive Disclosure — SearchPanel', () => {
  test('Advanced Search toggle hides semantic/keyword mode by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    // Open Search via sidebar
    const searchBtn = page.locator('.nav-button').filter({ hasText: 'Search', visible: true }).first();
    await searchBtn.click();

    // Mode toggle should NOT be visible initially (progressive disclosure)
    await expect(page.locator('.search-mode-toggle')).not.toBeVisible({ timeout: 5000 });
  });

  test('Advanced Search toggle reveals semantic/keyword mode selector', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const searchBtn = page.locator('.nav-button').filter({ hasText: 'Search', visible: true }).first();
    await searchBtn.click();

    // Click Advanced Search toggle
    const advancedToggle = page.locator('.search-panel .advanced-toggle');
    await advancedToggle.click();

    // Verify mode toggle is now visible with Keyword and Semantic buttons
    await expect(page.locator('.search-mode-toggle')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /keyword/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /semantic/i })).toBeVisible();
  });

  test('Advanced Search toggle has correct aria-expanded state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const searchBtn = page.locator('.nav-button').filter({ hasText: 'Search', visible: true }).first();
    await searchBtn.click();

    const advancedToggle = page.locator('.search-panel .advanced-toggle');

    // Initially collapsed
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Progressive Disclosure — GraphControls', () => {
  test('More toggle hides Load Snapshot button by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const graphBtn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await graphBtn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Load Snapshot button should NOT be visible initially
    const loadBtn = page.locator('button').filter({ hasText: 'Load Snapshot' });
    await expect(loadBtn).not.toBeVisible({ timeout: 5000 });
  });

  test('More toggle reveals Load Snapshot button when expanded', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const graphBtn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await graphBtn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Click More toggle
    const moreToggle = page.getByRole('button', { name: /more graph controls/i });
    await moreToggle.click();

    // Load Snapshot should now be visible
    const loadBtn = page.locator('button').filter({ hasText: 'Load Snapshot' });
    await expect(loadBtn).toBeVisible({ timeout: 5000 });
  });

  test('Primary controls (Focus, Save Snapshot) remain visible regardless of More toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.layout-container')).toBeVisible({ timeout: 15000 });

    await ensureNavVisible(page);

    const graphBtn = page.locator('.nav-button').filter({ hasText: 'Graph', visible: true }).first();
    await graphBtn.click();

    await expect(page.locator('.main-content')).toBeVisible({ timeout: 15000 });

    // Primary controls always visible
    await expect(page.locator('button').filter({ hasText: 'Save Snapshot' })).toBeVisible({ timeout: 5000 });

    // Click More to expand — primary controls should remain visible
    const moreToggle = page.getByRole('button', { name: /more graph controls/i });
    await moreToggle.click();
    await expect(page.locator('button').filter({ hasText: 'Save Snapshot' })).toBeVisible({ timeout: 5000 });

    // Collapse — primary controls still visible
    await moreToggle.click();
    await expect(page.locator('button').filter({ hasText: 'Save Snapshot' })).toBeVisible({ timeout: 5000 });
  });
});
