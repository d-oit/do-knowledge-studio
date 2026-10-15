import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Graph gesture interaction tests (Plan 169 Phase 1).
 *
 * Verifies that the GraphView canvas supports:
 * 1. Pointer drag-to-pan across the SVG background with clamped viewBox updates.
 * 2. Mouse wheel zooming that modifies the viewBox scale dimensions.
 * 3. Preserved single-click selection on graph nodes (not swallowed by pan slop).
 */
test.describe('Graph Pointer & Wheel Gestures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navClick(page, /graph/i);
    const canvas = page.getByRole('application', { name: /graph canvas/i });
    await expect(canvas).toBeVisible();
  });

  test('pans the canvas viewBox on pointer drag', async ({ page }) => {
    const svg = page.locator('svg[aria-label^="Knowledge graph"]');
    await expect(svg).toBeVisible();

    const initialViewBox = await svg.getAttribute('viewBox');
    expect(initialViewBox).not.toBeNull();
    const [minX0, minY0, w0, h0] = (initialViewBox as string).split(' ').map(Number);

    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Drag on empty canvas background (top-left margin inside SVG)
    const startX = box.x + 50;
    const startY = box.y + 50;
    const endX = startX + 120;
    const endY = startY + 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    const pannedViewBox = await svg.getAttribute('viewBox');
    expect(pannedViewBox).not.toBeNull();
    const [minX1, minY1, w1, h1] = (pannedViewBox as string).split(' ').map(Number);

    // ViewBox minX and minY shift in the opposite direction of panOffset
    expect(minX1).not.toBeCloseTo(minX0);
    expect(minY1).not.toBeCloseTo(minY0);
    // Width and height remain constant under pure panning
    expect(w1).toBeCloseTo(w0, 1);
    expect(h1).toBeCloseTo(h0, 1);
  });

  test('zooms the canvas viewBox on mouse wheel scroll', async ({ page }) => {
    const svg = page.locator('svg[aria-label^="Knowledge graph"]');
    await expect(svg).toBeVisible();

    const initialViewBox = await svg.getAttribute('viewBox');
    expect(initialViewBox).not.toBeNull();
    const [, , w0, h0] = (initialViewBox as string).split(' ').map(Number);

    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Scroll up (zoom in) at canvas center
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -200);

    await expect.poll(async () => {
      const vb = await svg.getAttribute('viewBox');
      const [, , w] = (vb ?? '').split(' ').map(Number);
      return w;
    }).toBeLessThan(w0);

    const zoomedViewBox = await svg.getAttribute('viewBox');
    const [, , w1, h1] = (zoomedViewBox as string).split(' ').map(Number);
    expect(w1).toBeLessThan(w0);
    expect(h1).toBeLessThan(h0);
  });

  test('allows node selection on click without triggering drag', async ({ page }) => {
    const firstNode = page.locator('svg[aria-label^="Knowledge graph"] g[role="button"]').first();
    await expect(firstNode).toBeVisible();

    await firstNode.click();
    await expect(firstNode).toHaveAttribute('aria-label', /selected/);
  });
});
