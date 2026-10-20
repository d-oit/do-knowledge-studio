import { test, expect } from '@playwright/test';

/**
 * The search worker must answer, not time out.
 *
 * `search-worker.ts` guards its `message` listener with a check that the
 * bundler cannot fold away. When that guard was `typeof window === 'undefined'`,
 * Turbopack resolved `window` statically, dropped the whole block from the
 * emitted worker chunk, and shipped a worker that booted without an error but
 * never handled a message. Every request then waited out
 * `SEARCH_WORKER_TIMEOUT_MS` (3000ms) before the client fell back to the main
 * thread, so each chat reply took ~3.3s instead of ~0.35s.
 *
 * A unit test cannot catch this: the module is loaded directly under jsdom,
 * where the guard is never statically resolved. The defect only exists in the
 * bundle the browser actually runs, so the assertion has to run against the
 * built app in a real browser.
 *
 * The contract asserted here is a bound on the reply latency, not the
 * implementation: whatever the worker does internally, the user must not wait
 * out the fallback timeout. A timeout-shaped latency is the observable
 * symptom; a green console is not, because the broken worker logs nothing.
 */

const CHAT_INPUT_PLACEHOLDER = 'Ask about your library, or request a synthesis…';

/** Latency a broken (never-answering) worker produces: the 3s fallback wait. */
const FALLBACK_TIMEOUT_MS = 3000;

/**
 * Ceiling for a healthy reply. The healthy path measured ~350ms; the broken
 * one ~3350ms. 2500ms sits between them with wide margin on both sides, so
 * ordinary machine slowness does not trip it and the defect always does.
 */
const MAX_REPLY_LATENCY_MS = 2500;

test.describe('search worker', () => {
  test('answers a chat query without waiting out the fallback timeout', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Chat/ }).click();

    const input = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
    await expect(input).toBeVisible();

    const main = page.getByRole('main');
    const replyMarker = main.getByText(/Used \d+ local items/);

    // First send primes the index; the measured send is the second one, so a
    // one-off cold-start cost cannot be mistaken for the worker's behaviour.
    await input.fill('knowledge');
    await input.press('Enter');
    await expect(replyMarker.first()).toBeVisible({ timeout: 15_000 });

    const startedAt = Date.now();
    await input.fill('search');
    await input.press('Enter');
    await expect(replyMarker.nth(1)).toBeVisible({ timeout: 15_000 });
    const elapsed = Date.now() - startedAt;

    expect(
      elapsed,
      `chat reply took ${elapsed}ms — the search worker did not answer and the client fell back after ${FALLBACK_TIMEOUT_MS}ms`,
    ).toBeLessThan(MAX_REPLY_LATENCY_MS);
  });

  test('the worker the app constructs handles a message', async ({ page }) => {
    // Record the worker's URL at construction time. Discovery through
    // `performance.getEntriesByType('resource')` is unreliable: the entry is
    // only listed once the worker script has been fetched, and other worker
    // chunks (Next's own runtime helpers) can match the same name.
    await page.addInitScript(() => {
      const created: string[] = [];
      (window as unknown as { __studioWorkerUrls: string[] }).__studioWorkerUrls = created;
      const OriginalWorker = window.Worker;
      const RecordingWorker = function (url: string | URL, options?: WorkerOptions) {
        created.push(String(url));
        return new OriginalWorker(url, options);
      } as unknown as typeof Worker;
      RecordingWorker.prototype = OriginalWorker.prototype;
      Object.setPrototypeOf(RecordingWorker, OriginalWorker);
      window.Worker = RecordingWorker;
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Give the client time to construct its worker.
    await page.waitForTimeout(1500);

    const workerUrls = await page.evaluate(
      () => (window as unknown as { __studioWorkerUrls: string[] }).__studioWorkerUrls,
    );

    // A worker URL is required: without one the client never left the main
    // thread and the latency assertion above would be measuring the fallback
    // rather than a broken worker.
    expect(workerUrls.length, 'the app should construct a search worker').toBeGreaterThan(0);

    const reply = await page.evaluate(async (url) => {
      const worker = new Worker(url);
      return await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve('NO_REPLY'), 4000);
        worker.onmessage = (event: MessageEvent) => {
          clearTimeout(timer);
          resolve(`REPLY:${JSON.stringify(event.data)}`);
        };
        worker.onerror = (event: ErrorEvent) => {
          clearTimeout(timer);
          resolve(`ERROR:${event.message}`);
        };
        worker.postMessage({ id: 'probe', type: 'SEARCH', entities: [], claims: [], query: 'x' });
      });
    }, workerUrls[0]);

    expect(reply, 'the search worker must reply to a SEARCH message').toMatch(/^REPLY:/);
  });
});
