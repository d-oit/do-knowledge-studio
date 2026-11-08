import { test, expect } from '@playwright/test';
import { navClick, waitForAppReady } from './helpers/navigation';

/**
 * CSP contract for #1051: no violation reports on any primary view.
 *
 * Listens for `console` errors and `securitypolicyviolation` events while
 * driving the shell, editor, library, graph, chat, sync and backup surfaces.
 * A narrowed `connect-src` must not break the Sync, AI Harness or semantic
 * model flows, so the absence of violations is the falsifiable gate.
 */

const CSP_VIOLATION_PATTERN = /Content Security Policy|CSP|securitypolicyviolation/i;

test('no CSP violations across primary views', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && CSP_VIOLATION_PATTERN.test(msg.text())) {
      violations.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    if (CSP_VIOLATION_PATTERN.test(err.message)) {
      violations.push(err.message);
    }
  });
  await page.exposeFunction('__dksCspHook', (msg: string) => {
    violations.push(msg);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const fn = (window as unknown as { __dksCspHook?: (m: string) => void }).__dksCspHook;
      fn?.(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });

  await page.goto('/');
  await waitForAppReady(page);

  const views: RegExp[] = [/editor/i, /librar/i, /graph/i, /chat/i, /sync/i, /export/i, /settings/i];
  for (const nav of views) {
    await navClick(page, nav);
    await waitForAppReady(page);
  }

  expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([]);
});
