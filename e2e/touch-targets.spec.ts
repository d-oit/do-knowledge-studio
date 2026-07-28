import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const TOUCH_MIN_SIZE = 44;

const INTERACTIVE_SELECTOR =
  'button, a, input[type="checkbox"], input[type="radio"], select, ' +
  '[role="button"], [role="tab"], [role="menuitem"], [role="link"]';

interface TouchViolation {
  selector: string;
  role: string | null;
  text: string;
  width: number;
  height: number;
}

async function getTouchViolations(page: import('@playwright/test').Page): Promise<TouchViolation[]> {
  return page.evaluate(
    ({ selector, minSize }: { selector: string; minSize: number }) => {
      const violations: TouchViolation[] = [];
      const elements = document.querySelectorAll(selector);

      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        const style = window.getComputedStyle(htmlEl);

        // Exclude visually-hidden elements (sr-only, clip, zero-size)
        const isVisuallyHidden =
          style.position === 'absolute' &&
          (style.clip !== 'auto' || style.clipPath !== 'none' || style.overflow === 'hidden') &&
          rect.width <= 1 &&
          rect.height <= 1;

        const isVisible =
          !isVisuallyHidden &&
          htmlEl.offsetParent !== null &&
          htmlEl.offsetWidth > 0 &&
          htmlEl.offsetHeight > 0 &&
          rect.width > 0 &&
          rect.height > 0;

        if (!isVisible) return;

        if (rect.width < minSize || rect.height < minSize) {
          const text =
            htmlEl.textContent?.trim().slice(0, 80) ||
            (htmlEl as HTMLInputElement).placeholder?.slice(0, 80) ||
            '';
          violations.push({
            selector: el.tagName.toLowerCase() +
              (el.id ? `#${el.id}` : '') +
              (el.className && typeof el.className === 'string'
                ? `.${el.className.split(' ').slice(0, 2).join('.')}`
                : ''),
            role: htmlEl.getAttribute('role'),
            text,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          });
        }
      });

      return violations;
    },
    { selector: INTERACTIVE_SELECTOR, minSize: TOUCH_MIN_SIZE },
  );
}

test.describe('Touch-target size verification', () => {
  test.describe('global interactive elements on mobile', () => {
    test('all home page interactive elements meet 44x44 minimum', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const violations = await getTouchViolations(page);

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  ${v.selector}${v.role ? ` [role="${v.role}"]` : ''} ` +
              `"${v.text}" → ${v.width}×${v.height}px`,
          )
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} elements below 44×44px on home page:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} touch-target violations (below 44×44px)`).toEqual([]);
    });

    test('all library page interactive elements meet 44x44 minimum', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // On mobile, sidebar is hidden — open hamburger first
      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(300);
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      const libraryBtn = nav.getByRole('button', { name: /library/i }).first();

      if (await libraryBtn.isVisible()) {
        await libraryBtn.click();
        await page.waitForLoadState('networkidle');
      }

      const violations = await getTouchViolations(page);

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  ${v.selector}${v.role ? ` [role="${v.role}"]` : ''} ` +
              `"${v.text}" → ${v.width}×${v.height}px`,
          )
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} elements below 44×44px on library page:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} touch-target violations (below 44×44px)`).toEqual([]);
    });

    test('all editor page interactive elements meet 44x44 minimum', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // On mobile, sidebar is hidden — open hamburger first
      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(300);
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      const editorBtn = nav.getByRole('button', { name: /editor/i }).first();

      if (await editorBtn.isVisible()) {
        await editorBtn.click();
        await page.waitForLoadState('networkidle');
      }

      const violations = await getTouchViolations(page);

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  ${v.selector}${v.role ? ` [role="${v.role}"]` : ''} ` +
              `"${v.text}" → ${v.width}×${v.height}px`,
          )
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} elements below 44×44px on editor page:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} touch-target violations (below 44×44px)`).toEqual([]);
    });
  });

  test.describe('sidebar navigation touch targets on mobile', () => {
    test('sidebar nav buttons meet 44x44 after opening mobile menu', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      await expect(nav).toBeVisible();

      const violations = await nav.evaluate(
        (el, minSize) => {
          const violations: Array<{
            text: string;
            role: string;
            width: number;
            height: number;
          }> = [];
          const buttons = el.querySelectorAll('button, [role="button"]');

          buttons.forEach((btn) => {
            const htmlEl = btn as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            if (
              htmlEl.offsetWidth === 0 ||
              htmlEl.offsetHeight === 0
            )
              return;

            if (rect.width < minSize || rect.height < minSize) {
              violations.push({
                text: htmlEl.textContent?.trim().slice(0, 60) || '',
                role: htmlEl.getAttribute('role') || 'button',
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
              });
            }
          });

          return violations;
        },
        TOUCH_MIN_SIZE,
      );

      if (violations.length > 0) {
        const report = violations
          .map((v) => `  "${v.text}" → ${v.width}×${v.height}px`)
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} sidebar nav buttons below 44×44px:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} sidebar nav button touch-target violations`).toEqual([]);
    });

    test('hamburger menu button itself meets 44x44 on mobile', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });

      if (!(await menuBtn.isVisible())) {
        test.skip();
        return;
      }

      const box = await menuBtn.boundingBox();
      expect(box).not.toBeNull();

      if (box) {
        expect(
          box.width,
          `Hamburger menu button width ${box.width}px is below ${TOUCH_MIN_SIZE}px minimum`,
        ).toBeGreaterThanOrEqual(TOUCH_MIN_SIZE);
        expect(
          box.height,
          `Hamburger menu button height ${box.height}px is below ${TOUCH_MIN_SIZE}px minimum`,
        ).toBeGreaterThanOrEqual(TOUCH_MIN_SIZE);
      }
    });
  });

  test.describe('library list touch targets on mobile', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      const libraryBtn = nav.getByRole('button', { name: /library/i }).first();
      if (await libraryBtn.isVisible()) {
        await libraryBtn.click();
      }

      await page.waitForLoadState('networkidle');
    });

    test('entity link/button elements in library list meet 44x44', async ({ page }) => {
      const violations = await page.evaluate(
        (minSize) => {
          const violations: Array<{
            selector: string;
            text: string;
            width: number;
            height: number;
          }> = [];

          const cards = document.querySelectorAll(
            'a[aria-label*="open" i], [role="link"][aria-label*="open" i]',
          );
          cards.forEach((card) => {
            const htmlEl = card as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            if (
              htmlEl.offsetWidth === 0 ||
              htmlEl.offsetHeight === 0
            )
              return;

            if (rect.width < minSize || rect.height < minSize) {
              violations.push({
                selector: htmlEl.tagName.toLowerCase() +
                  (htmlEl.id ? `#${htmlEl.id}` : '') +
                  (htmlEl.getAttribute('aria-label')
                    ? `[aria-label="${htmlEl.getAttribute('aria-label')}"]`
                    : ''),
                text: htmlEl.textContent?.trim().slice(0, 80) || '',
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
              });
            }
          });

          if (violations.length === 0) {
            const buttons = document.querySelectorAll(
              '[role="listitem"] button, [role="listitem"] a, ' +
                'li button, li a, ' +
                '[data-testid*="entity"] button, [data-testid*="entity"] a',
            );
            buttons.forEach((btn) => {
              const htmlEl = btn as HTMLElement;
              const rect = htmlEl.getBoundingClientRect();
              if (
                htmlEl.offsetWidth === 0 ||
                htmlEl.offsetHeight === 0
              )
                return;

              if (rect.width < minSize || rect.height < minSize) {
                violations.push({
                  selector: htmlEl.tagName.toLowerCase() +
                    (htmlEl.id ? `#${htmlEl.id}` : ''),
                  text: htmlEl.textContent?.trim().slice(0, 80) || '',
                  width: Math.round(rect.width * 10) / 10,
                  height: Math.round(rect.height * 10) / 10,
                });
              }
            });
          }

          return violations;
        },
        TOUCH_MIN_SIZE,
      );

      if (violations.length > 0) {
        const report = violations
          .map((v) => `  ${v.selector} "${v.text}" → ${v.width}×${v.height}px`)
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} library list items below 44×44px:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} library list touch-target violations`).toEqual([]);
    });

    test('library filter chips/buttons meet 44x44 on mobile', async ({ page }) => {
      const chipViolations = await page.evaluate(
        (minSize) => {
          const violations: Array<{
            selector: string;
            text: string;
            width: number;
            height: number;
          }> = [];

          const chips = document.querySelectorAll(
            '[role="group"] button, [role="group"] [role="radio"], ' +
              '[role="group"] [role="checkbox"], ' +
              '[role="radiogroup"] [role="radio"]',
          );
          chips.forEach((chip) => {
            const htmlEl = chip as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            if (
              htmlEl.offsetWidth === 0 ||
              htmlEl.offsetHeight === 0
            )
              return;

            if (rect.width < minSize || rect.height < minSize) {
              violations.push({
                selector: htmlEl.tagName.toLowerCase() +
                  (htmlEl.getAttribute('role')
                    ? `[role="${htmlEl.getAttribute('role')}"]`
                    : ''),
                text: htmlEl.textContent?.trim().slice(0, 60) || '',
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
              });
            }
          });

          return violations;
        },
        TOUCH_MIN_SIZE,
      );

      if (chipViolations.length > 0) {
        const report = chipViolations
          .map((v) => `  ${v.selector} "${v.text}" → ${v.width}×${v.height}px`)
          .join('\n');
        console.warn(
          `[touch-target] ${chipViolations.length} library filter elements below 44×44px:\n${report}`,
        );
      }

      expect(chipViolations, `Found ${chipViolations.length} library filter touch-target violations`).toEqual([]);
    });
  });

  test.describe('cross-page touch-target consistency', () => {
    test('graph page interactive elements meet 44x44 on mobile', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      const graphBtn = nav.getByRole('button', { name: /graph/i }).first();
      if (await graphBtn.isVisible()) {
        await graphBtn.click();
      }

      await page.waitForLoadState('networkidle');

      const violations = await getTouchViolations(page);

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  ${v.selector}${v.role ? ` [role="${v.role}"]` : ''} ` +
              `"${v.text}" → ${v.width}×${v.height}px`,
          )
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} elements below 44×44px on graph page:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} touch-target violations (below 44×44px)`).toEqual([]);
    });

    test('mind map page interactive elements meet 44x44 on mobile', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const menuBtn = page.getByRole('button', { name: /menu|open menu/i });
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
      }

      const nav = page.getByRole('navigation', { name: /main navigation/i });
      const mindMapBtn = nav.getByRole('button', { name: /mind map/i }).first();
      if (await mindMapBtn.isVisible()) {
        await mindMapBtn.click();
      }

      await page.waitForLoadState('networkidle');

      const violations = await getTouchViolations(page);

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  ${v.selector}${v.role ? ` [role="${v.role}"]` : ''} ` +
              `"${v.text}" → ${v.width}×${v.height}px`,
          )
          .join('\n');
        console.warn(
          `[touch-target] ${violations.length} elements below 44×44px on mind map page:\n${report}`,
        );
      }

      expect(violations, `Found ${violations.length} touch-target violations (below 44×44px)`).toEqual([]);
    });
  });
});
