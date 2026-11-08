#!/usr/bin/env node
/**
 * Generates README/PWA screenshots with Playwright (#1064).
 *
 * Drives a production build (`pnpm run build && pnpm run start`), captures
 * light/dark desktop + mobile, and writes `public/screenshot-wide.png` and
 * `public/screenshot-narrow.png`. Run manually before release; CI asserts the
 * files exist and are fresh via `docs:check`.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const run = async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-app-ready="true"]', { timeout: 30000 });
    await page.screenshot({ path: 'public/screenshot-wide.png' });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(BASE, { waitUntil: 'networkidle' });
    await mobile.waitForSelector('[data-app-ready="true"]', { timeout: 30000 });
    await mobile.screenshot({ path: 'public/screenshot-narrow.png' });
    console.log('Screenshots written to public/screenshot-wide.png + screenshot-narrow.png');
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
