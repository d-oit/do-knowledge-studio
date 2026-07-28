import { test, expect } from "@playwright/test";

async function navClick(page: import("@playwright/test").Page, name: RegExp | string) {
  const nav = page.getByRole("navigation", { name: /main navigation/i });
  await nav.getByRole("button", { name }).first().click();
}

async function setZoom(page: import("@playwright/test").Page, percent: number) {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
  // Let reflow settle
  await page.waitForTimeout(300);
}

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(
    scrollWidth,
    `${label}: horizontal overflow (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("Zoom & Reflow", () => {
  test("200% text zoom — no horizontal overflow on home", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await setZoom(page, 200);
    await assertNoHorizontalOverflow(page, "home");
  });

  test("200% text zoom — no horizontal overflow on library", async ({ page }) => {
    await page.goto("/");
    await navClick(page, /library/i);
    await page.waitForLoadState("networkidle");
    await setZoom(page, 200);
    await assertNoHorizontalOverflow(page, "library");
  });

  test("200% text zoom — no horizontal overflow on editor", async ({ page }) => {
    await page.goto("/");
    await navClick(page, /editor/i);
    await page.waitForLoadState("networkidle");
    await setZoom(page, 200);
    await assertNoHorizontalOverflow(page, "editor");
  });

  test("400% reflow — single column with no horizontal scrollbar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await setZoom(page, 400);
    await assertNoHorizontalOverflow(page, "400% reflow");

    // Page title should remain visible
    const title = page.locator("h1").first();
    await expect(title).toBeVisible();

    // Main content area should exist
    const main = page.locator("main, [role='main']");
    await expect(main.first()).toBeAttached();
  });

  test("200% zoom + mobile — no horizontal overflow and nav accessible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await setZoom(page, 200);
    await assertNoHorizontalOverflow(page, "mobile 200%");

    // Try to open the hamburger / menu button and verify navigation works
    const menuBtn = page.getByRole("button", {
      name: /menu|hamburger|toggle|open navigation/i,
    });
    const menuVisible = await menuBtn.isVisible().catch(() => false);

    if (menuVisible) {
      await menuBtn.click();
      await page.waitForTimeout(300);

      // After opening, navigation should be accessible (at least one nav button)
      const nav = page.getByRole("navigation", { name: /main navigation/i });
      const anyNavBtn = nav.getByRole("button").first();
      await expect(anyNavBtn).toBeVisible();
    }
  });

  test("Zoom doesn't clip interactive elements — search input visible at 200%", async ({ page }) => {
    await page.goto("/");
    await navClick(page, /library/i);
    await page.waitForLoadState("networkidle");
    await setZoom(page, 200);

    const searchInput = page.getByRole("searchbox", {
      name: /search/i,
    });
    // The input should still be visible at 200% zoom
    await expect(searchInput.first()).toBeVisible();

    // It should also be typeable
    await searchInput.first().fill("accessibility test");
    await expect(searchInput.first()).toHaveValue("accessibility test");
  });
});
