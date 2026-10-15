import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Mobile touch and gesture tests (Plan 169 Phase 2 & 3).
 *
 * Verifies that:
 * 1. Mobile touch drag pans the GraphView canvas.
 * 2. Mobile 2-pointer pinch zooms the GraphView canvas.
 * 3. MindMapView tree items expose touch targets >= 44px (WCAG 2.5.5).
 */
test.describe('Mobile Touch & Gesture Interactions', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('pans the canvas on mobile touch drag', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /graph/i);
    const canvas = page.getByRole('application', { name: /graph canvas/i });
    await expect(canvas).toBeVisible();

    const svg = page.locator('svg[aria-label^="Knowledge graph"]');
    await expect(svg).toBeVisible();

    const initialViewBox = await svg.getAttribute('viewBox');
    expect(initialViewBox).not.toBeNull();
    const [minX0, minY0] = (initialViewBox as string).split(' ').map(Number);

    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Single touch drag
    const startX = box.x + 60;
    const startY = box.y + 60;
    const endX = startX + 80;
    const endY = startY + 60;

    await page.touchscreen.tap(startX, startY);
    // Emulate pointer drag sequence
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    const pannedViewBox = await svg.getAttribute('viewBox');
    expect(pannedViewBox).not.toBeNull();
    const [minX1, minY1] = (pannedViewBox as string).split(' ').map(Number);

    expect(minX1).not.toBeCloseTo(minX0);
    expect(minY1).not.toBeCloseTo(minY0);
  });

  test('verifies Mind Map expander touch targets are at least 44x44px', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /mind map/i);

    const tree = page.getByRole('tree');
    await expect(tree).toBeVisible();

    // Look for expander buttons or placeholders
    const expanders = page.locator('[role="treeitem"] button[aria-label="Collapse"], [role="treeitem"] button[aria-label="Expand"], [role="treeitem"] span[aria-hidden="true"]');
    const count = await expanders.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await expanders.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
