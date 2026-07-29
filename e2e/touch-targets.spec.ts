import { test, expect } from '@playwright/test';

/** Helper: click a sidebar nav button by label (scoped to <nav>) */
async function navClick(page: import('@playwright/test').Page, name: RegExp | string) {
  const nav = page.getByRole('navigation', { name: /main navigation/i });
  await nav.getByRole('button', { name }).first().click();
}

const MIN_TOUCH_TARGET = 44;

/**
 * Enumerate all interactive elements and verify each meets the 44x44px
 * minimum touch target size (WCAG 2.5.5 / 2.5.8).
 */
async function assertTouchTargets(page: import('@playwright/test').Page, viewName: string) {
  const violations = await page.evaluate((min: number) => {
    const selectors = 'button, a[href], input[type="checkbox"], input[type="radio"], [role="button"]';
    const els = Array.from(document.querySelectorAll<HTMLElement>(selectors));
    const issues: { tag: string; text: string; width: number; height: number }[] = [];

    for (const el of els) {
      // Skip elements that are not visible
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.opacity === '0') continue;

      // Skip skip-to-content links (sr-only until focused — intentional WCAG pattern)
      if (
        el.tagName === 'A' &&
        (el as HTMLAnchorElement).href?.includes('#') &&
        ((el.textContent || '').toLowerCase().includes('skip') ||
          (el.getAttribute('aria-label') || '').toLowerCase().includes('skip'))
      ) continue;

      // Skip SVG <g> elements (data visualization nodes, not UI controls)
      if (el.tagName === 'G' || el instanceof SVGGElement) continue;

      if (rect.width < min || rect.height < min) {
        issues.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return issues;
  }, MIN_TOUCH_TARGET);

  expect(
    violations,
    `[${viewName}] Found ${violations.length} interactive elements below ${MIN_TOUCH_TARGET}px:\n` +
      violations.map((v) => `  - <${v.tag}> "${v.text}" — ${v.width}x${v.height}px`).join('\n'),
  ).toEqual([]);
}

test.describe('Touch targets — WCAG 2.5.5 (44x44px minimum)', () => {
  // Desktop viewport (≥lg breakpoint = 1024px) so sidebar navigation buttons are visible.
  // Mobile nav uses a drawer pattern with different interactive elements.
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('home: all interactive elements meet 44x44px', async ({ page }) => {
    await assertTouchTargets(page, 'Home');
  });

  test('library: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /library/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Library');
  });

  test('editor: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /editor/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Editor');
  });

  test('chat: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /chat/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Chat');
  });

  test('graph: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /graph/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Graph');
  });

  test('mind map: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /mind map/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Mind Map');
  });

  test('export: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /export/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Export');
  });

  test('sync: all interactive elements meet 44x44px', async ({ page }) => {
    await navClick(page, /sync/i);
    await page.waitForLoadState('networkidle');
    await assertTouchTargets(page, 'Sync');
  });
});
