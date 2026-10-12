import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';

const MIN_TOUCH_TARGET = 44;

/**
 * Runs inside the page and collects every visible interactive element smaller
 * than the given minimum. All helpers are nested so Playwright can serialize
 * the whole closure into `page.evaluate`.
 *
 * When `rootSelector` is provided the scan is scoped to the first matching
 * subtree (e.g. the mobile drawer dialog); otherwise the whole document is
 * scanned. Scoping is how touch-only surfaces are measured without inheriting
 * unrelated violations from the rest of the shell.
 */
const collectTouchTargetViolations = (args: { min: number; rootSelector?: string }) => {
  const { min, rootSelector } = args;
  const selectors = 'button, a[href], input[type="checkbox"], input[type="radio"], input[type="search"], [role="button"]';

  // True when the element is actually rendered and visible. Elements with zero
  // size, `display:none`, `visibility:hidden`, or `opacity:0` are not targets.
  const isVisibleElement = (el: HTMLElement, rect: DOMRect) => {
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return style.opacity !== '0';
  }

  // Skip-to-content links are sr-only until focused — an intentional WCAG
  // pattern, so they are exempt from the minimum target size check.
  const isSkipToContentLink = (el: HTMLElement) => {
    if (el.tagName !== 'A') return false;
    if (!(el as HTMLAnchorElement).href?.includes('#')) return false;
    const text = (el.textContent || '').toLowerCase();
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    return text.includes('skip') || label.includes('skip');
  }

  // SVG <g> elements are data-visualization nodes, not UI controls.
  const isSvgGroupNode = (el: HTMLElement) => el.tagName === 'G' || el instanceof SVGGElement;

  const root: ParentNode = rootSelector ? (document.querySelector(rootSelector) ?? document) : document;
  const els = Array.from(root.querySelectorAll<HTMLElement>(selectors));
  const issues: { tag: string; text: string; width: number; height: number }[] = [];

  for (const el of els) {
    const rect = el.getBoundingClientRect();
    if (!isVisibleElement(el, rect)) continue;
    if (isSkipToContentLink(el)) continue;
    if (isSvgGroupNode(el)) continue;

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
}

/**
 * Enumerate all interactive elements and verify each meets the 44x44px
 * minimum touch target size (WCAG 2.5.5 / 2.5.8).
 */
const assertTouchTargets = async (
  page: Page,
  viewName: string,
  rootSelector?: string,
) => {
  const violations = await page.evaluate(collectTouchTargetViolations, {
    min: MIN_TOUCH_TARGET,
    rootSelector,
  });

  const details = violations
    .map((v) => `  - <${v.tag}> "${v.text}" — ${v.width}x${v.height}px`)
    .join('\n')
  expect(
    violations,
    `[${viewName}] Found ${violations.length} interactive elements below ${MIN_TOUCH_TARGET}px:\n${details}`,
  ).toEqual([]);
}

test.describe('Touch targets — WCAG 2.5.5 (44x44px minimum)', () => {
  // Desktop viewport (≥lg breakpoint = 1024px) so sidebar navigation buttons are visible.
  // Mobile nav uses a drawer pattern with different interactive elements.
  // Reduced motion makes the press-scale micro-interaction inert (transform: none),
  // so geometry is measured in the static layout rather than mid-transition.
  test.use({
    viewport: { width: 1280, height: 900 },
    contextOptions: { reducedMotion: 'reduce' },
  });

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

/**
 * The mobile drawer and the shortcuts dialog are the two surfaces an earlier
 * pass missed: the drawer exists only below `lg`, so the desktop suite never
 * rendered it, and the dialog's compact controls were never measured. Both are
 * scanned in their own subtrees — the shell is not the subject of these tests.
 */
test.describe('Touch-only surfaces — drawer and shortcuts dialog (44x44px minimum)', () => {
  // Phone viewport (< lg = 1024px) so the mobile drawer is mounted, plus the
  // same reduced-motion setting as the desktop suite for stable geometry.
  test.use({
    viewport: { width: 390, height: 844 },
    contextOptions: { reducedMotion: 'reduce' },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('mobile drawer: navigate and search controls meet 44x44px', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();
    const drawer = page.getByRole('dialog', { name: /navigation and search/i });
    await expect(drawer).toBeVisible();

    // Navigation tab (default): close button, tab switcher, nav items, footer toggle.
    await assertTouchTargets(page, 'Mobile drawer — navigate', '[role="dialog"]');

    // Search tab: the Keyword/Ranked mode toggle lives in the shared search panel.
    await drawer.getByRole('button', { name: /^search$/i }).click();
    await expect(drawer.getByRole('button', { name: /^keyword$/i })).toBeVisible();
    await assertTouchTargets(page, 'Mobile drawer — search', '[role="dialog"]');
  });

  test('shortcuts dialog: all controls meet 44x44px', async ({ page }) => {
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i });
    await expect(dialog).toBeVisible();

    // Type a query so the clear-filter button is rendered and measured.
    await dialog.getByRole('searchbox').fill('edit');
    await expect(dialog.getByRole('button', { name: /clear/i })).toBeVisible();
    await assertTouchTargets(page, 'Shortcuts dialog', '[role="dialog"]');
  });
});
