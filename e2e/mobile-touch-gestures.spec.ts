import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Mobile touch and gesture tests (Plan 169 Phase 2 & 3).
 *
 * Verifies that:
 * 1. Mobile touch drag pans the GraphView canvas via touch events.
 * 2. Dual-pointer pinch gesture updates the canvas zoom.
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

    // Dispatch touch sequence on empty SVG canvas background
    const startX = box.x + 60;
    const startY = box.y + 60;
    const endX = startX + 90;
    const endY = startY + 70;

    await svg.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: startX,
      clientY: startY,
      button: 0,
    });

    await svg.dispatchEvent('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: endX,
      clientY: endY,
      button: 0,
    });

    await svg.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: endX,
      clientY: endY,
      button: 0,
    });

    const pannedViewBox = await svg.getAttribute('viewBox');
    expect(pannedViewBox).not.toBeNull();
    const [minX1, minY1] = (pannedViewBox as string).split(' ').map(Number);

    expect(minX1).not.toBeCloseTo(minX0);
    expect(minY1).not.toBeCloseTo(minY0);
  });

  test('zooms the canvas on dual-pointer pinch gesture', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /graph/i);
    const canvas = page.getByRole('application', { name: /graph canvas/i });
    await expect(canvas).toBeVisible();

    const svg = page.locator('svg[aria-label^="Knowledge graph"]');
    await expect(svg).toBeVisible();

    const initialViewBox = await svg.getAttribute('viewBox');
    expect(initialViewBox).not.toBeNull();
    const [, , w0, h0] = (initialViewBox as string).split(' ').map(Number);

    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Initial dual pointer down (distance = 100px)
    await svg.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: centerX - 50,
      clientY: centerY,
      button: 0,
    });

    await svg.dispatchEvent('pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: centerX + 50,
      clientY: centerY,
      button: 0,
    });

    // Pinch outward (distance = 200px => 2x zoom)
    await svg.dispatchEvent('pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: centerX - 100,
      clientY: centerY,
      button: 0,
    });

    await svg.dispatchEvent('pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: centerX + 100,
      clientY: centerY,
      button: 0,
    });

    await svg.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: centerX - 100,
      clientY: centerY,
      button: 0,
    });

    await svg.dispatchEvent('pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: centerX + 100,
      clientY: centerY,
      button: 0,
    });

    const zoomedViewBox = await svg.getAttribute('viewBox');
    expect(zoomedViewBox).not.toBeNull();
    const [, , w1, h1] = (zoomedViewBox as string).split(' ').map(Number);

    // Zooming in shrinks the viewBox dimensions
    expect(w1).toBeLessThan(w0);
    expect(h1).toBeLessThan(h0);
  });

  test('verifies Mind Map expander touch targets are at least 44x44px', async ({ page }) => {
    await page.goto('/');
    await navClick(page, /mind map/i);

    const tree = page.getByRole('tree');
    await expect(tree).toBeVisible();

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
