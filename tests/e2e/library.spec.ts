import { test, expect } from '@playwright/test';

test.describe('Library View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to be ready
    await expect(page.locator('.brand')).toContainText('Knowledge Studio');

    // Create some test data via Editor
    // Check if we're on mobile (hamburger menu visible)
    const isMobile = await page.locator('.mobile-header .icon-button:first-child').isVisible();
    if (isMobile) {
      // Open mobile drawer
      await page.click('.mobile-header .icon-button:first-child');
      // Wait for drawer to open and then click Editor
      await page.waitForSelector('.mobile-drawer-content:not(.hidden)', { state: 'visible' });
      await page.click('nav button:has-text("Editor")');
      // Close drawer after clicking
      await page.click('.mobile-header .icon-button:first-child');
    } else {
      // Desktop view
      await page.click('nav button:has-text("Editor")');
    }
    await page.fill('input[placeholder="Entity Name (e.g. TRIZ)"]', 'Library Test Entity');
    await page.selectOption('select', 'concept');
    await page.click('button:has-text("Save to DB")');
    await expect(page.locator('text=Saved successfully!')).toBeVisible();
  });

  test('should navigate to Library and show entities', async ({ page }) => {
    // Handle mobile vs desktop navigation
    const isMobile = await page.locator('.mobile-header .icon-button:first-child').isVisible();
    if (isMobile) {
      await page.click('.mobile-header .icon-button:first-child'); // Open drawer
      // Wait for drawer to open
      await page.waitForSelector('.mobile-drawer-content:not(.hidden)', { state: 'visible' });
      await page.click('nav button:has-text("Library")');
      await page.click('.mobile-header .icon-button:first-child'); // Close drawer
    } else {
      await page.click('nav button:has-text("Library")');
    }
    await expect(page.locator('h2:has-text("Library")')).toBeVisible();
    await expect(page.locator('text=Library Test Entity')).toBeVisible();
    await expect(page.locator('.type-badge:has-text("concept")')).toBeVisible();
  });

  test('should filter entities by type', async ({ page }) => {
    // Handle mobile vs desktop navigation
    const isMobile = await page.locator('.mobile-header .icon-button:first-child').isVisible();
    if (isMobile) {
      await page.click('.mobile-header .icon-button:first-child'); // Open drawer
      // Wait for drawer to open
      await page.waitForSelector('.mobile-drawer-content:not(.hidden)', { state: 'visible' });
      await page.click('nav button:has-text("Library")');
      await page.click('.mobile-header .icon-button:first-child'); // Close drawer
    } else {
      await page.click('nav button:has-text("Library")');
    }

    // Filter by 'Person' - should be empty
    await page.click('.filter-chip:has-text("Person")');
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();
    await expect(page.locator('text=No entities found matching your filters.')).toBeVisible();

    // Filter by 'Concept' - should show our entity
    await page.click('.filter-chip:has-text("Concept")');
    await expect(page.locator('text=Library Test Entity')).toBeVisible();
  });

  test('should search for entities', async ({ page }) => {
    // Handle mobile vs desktop navigation
    const isMobile = await page.locator('.mobile-header .icon-button:first-child').isVisible();
    if (isMobile) {
      await page.click('.mobile-header .icon-button:first-child'); // Open drawer
      await page.click('nav button:has-text("Library")');
      await page.click('.mobile-header .icon-button:first-child'); // Close drawer
    } else {
      await page.click('nav button:has-text("Library")');
    }

    await page.fill('input[placeholder="Search library..."]', 'Library Test');
    await expect(page.locator('text=Library Test Entity')).toBeVisible();

    await page.fill('input[placeholder="Search library..."]', 'Non-existent');
    await expect(page.locator('text=Library Test Entity')).not.toBeVisible();
  });

  test('should navigate to editor when clicking an entity', async ({ page }) => {
    // Handle mobile vs desktop navigation
    const isMobile = await page.locator('.mobile-header .icon-button:first-child').isVisible();
    if (isMobile) {
      await page.click('.mobile-header .icon-button:first-child'); // Open drawer
      await page.click('nav button:has-text("Library")');
      await page.click('.mobile-header .icon-button:first-child'); // Close drawer
    } else {
      await page.click('nav button:has-text("Library")');
    }

    await page.click('text=Library Test Entity');

    // Should be in Editor now
    await expect(page.locator('.nav-button.active:has-text("Editor")')).toBeVisible();
    await expect(page.locator('input.title-input')).toHaveValue('Library Test Entity');
    await expect(page.locator('select')).toHaveValue('concept');
  });
});
