import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Mind Map treeview keyboard contract (Plan 169 Phase 3 acceptance:
 * "keyboard roving tabindex and treeview ARIA remain 100% intact" —
 * W3C APG treeview pattern).
 *
 * The unit suites exercise the keydown handlers but cannot observe real
 * focus movement or the tab-stop layout; this spec verifies the composed
 * behaviour in a browser, with no pointer input.
 */
test.describe('Mind Map treeview keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /mind map/i);
    await expect(page.getByRole('tree', { name: /knowledge mind map/i })).toBeVisible();
  });

  test('exposes exactly one tab stop when the view opens', async ({ page }) => {
    const items = page.getByRole('treeitem');
    await expect(items.first()).toBeVisible();

    // APG: the tree is a single tab stop; exactly one item carries tabindex=0.
    await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);
  });

  test('arrow, Home, and End keys move real focus', async ({ page }) => {
    const items = page.getByRole('treeitem');
    expect(await items.count()).toBeGreaterThan(1);

    await items.first().focus();
    await expect(items.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(items.first()).toBeFocused();

    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();

    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
  });

  test('ArrowRight and ArrowLeft toggle aria-expanded without leaving the view', async ({ page }) => {
    // The default root's subtree is root + leaves; re-root at the entity whose
    // child itself has children so a collapsed expandable node exists.
    await page.getByLabel('Root entity').selectOption({ label: 'Root: Knowledge Graph Project' });

    const collapsed = page.locator('[role="treeitem"][aria-expanded="false"]').first();
    await expect(collapsed).toBeVisible();
    const itemId = await collapsed.getAttribute('data-entity-id');
    const rowsBefore = await page.getByRole('treeitem').count();

    await collapsed.focus();
    await page.keyboard.press('ArrowRight');
    const expanded = page.locator(`[role="treeitem"][data-entity-id="${itemId}"]`);
    await expect(expanded).toHaveAttribute('aria-expanded', 'true');
    // Expanding reveals at least one child row.
    expect(await page.getByRole('treeitem').count()).toBeGreaterThan(rowsBefore);
    // Focus stays on the toggled row; expansion never navigates away.
    await expect(expanded).toBeFocused();
    await expect(page.getByRole('tree', { name: /knowledge mind map/i })).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(expanded).toHaveAttribute('aria-expanded', 'false');
    // The subtree exits with an animation; retry until the rows are removed.
    await expect(page.getByRole('treeitem')).toHaveCount(rowsBefore);
  });

  test('Tab leaves the tree in a single stop', async ({ page }) => {
    await page.getByRole('treeitem').first().focus();
    await page.keyboard.press('Tab');
    const activeRole = await page.evaluate(() =>
      document.activeElement?.getAttribute('role'),
    );
    expect(activeRole).not.toBe('treeitem');
  });
});
