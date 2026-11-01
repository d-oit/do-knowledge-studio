import { test, expect, type Page } from '@playwright/test';
import { navClick, viewHeading } from './helpers/navigation';
import { seedEntities } from '../src/lib/studio/seed-data';
import { SEED_QUERIES } from '../src/lib/search/eval/seed-queries';
import { EVAL_K, recallAtK, reciprocalRank } from '../src/lib/search/eval/metrics';

/**
 * In-browser retrieval measurement (Plan 192, follow-up to #1065).
 *
 * `model-eval.test.ts` scores the corpus in Node on the `cpu` backend. That
 * measures the weights, not the app: the shipped path is a web worker over WASM,
 * fused inside the editor's own code, and the numbers a user experiences can
 * only come from driving that path.
 *
 * This spec is a measurement, not a gate — it needs the embedding model on the
 * CDN and takes minutes, so it is excluded from the default suite:
 *
 *   PLAYWRIGHT_PRODUCTION=1 pnpm exec playwright test e2e/semantic-search-eval.spec.ts --project=chromium
 *
 * `PLAYWRIGHT_PRODUCTION=1` serves the built app, which is the only build that
 * registers the service worker holding `dks-model-v1`; without it every run
 * re-downloads ~25 MB. The numbers it prints belong in `plans/`.
 */

/** How long a single query may take to settle, including the first model load. */
const RANK_SETTLE_TIMEOUT_MS = 120_000;
/** Gap between two samples when deciding a ranking has stopped changing. */
const SAMPLE_INTERVAL_MS = 400;
/** Consecutive identical samples required before a ranking is trusted. */
const STABLE_SAMPLES = 3;
/** Whole-run budget: 16 queries on a cold cache, model download included. */
const EVAL_TEST_TIMEOUT_MS = 600_000;

/** Entity name → id, so DOM order can be scored against labelled ids. */
const NAME_TO_ID = new Map(seedEntities.map((entity) => [entity.name, entity.id]));

/**
 * Reads the ranked entity ids the library grid is currently showing.
 *
 * The grid renders one `<h3>` per entity card; anything not in the seed corpus
 * (a view heading, a section title) is dropped, so the result is the ranking and
 * not the page chrome. First occurrence wins: the grid is a ranking, not a list.
 */
const readRankedIds = async (page: Page): Promise<string[]> => {
  const names = await page.locator('h3').allInnerTexts();
  const ids: string[] = [];
  for (const raw of names) {
    const id = NAME_TO_ID.get(raw.trim());
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

/**
 * Waits until the ranking stops changing, then returns it.
 *
 * The semantic path renders lexical results first and swaps to the fused
 * ranking when the worker answers, then again once the model finishes loading.
 * Sampling until the order holds for `STABLE_SAMPLES` consecutive samples is
 * what makes "the ranking" mean the settled one rather than whichever frame the
 * reader happened to catch.
 */
const waitForSettledRanking = async (page: Page): Promise<string[]> => {
  const deadline = Date.now() + RANK_SETTLE_TIMEOUT_MS;
  let previous = '';
  let identical = 0;
  while (Date.now() < deadline) {
    const current = (await readRankedIds(page)).join(',');
    identical = current !== '' && current === previous ? identical + 1 : 0;
    if (identical >= STABLE_SAMPLES) {
      return current.split(',');
    }
    previous = current;
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  return previous === '' ? [] : previous.split(',');
};

/** Whether the view is showing the lexical-fallback notice for this query. */
const sawLexicalFallback = async (page: Page): Promise<boolean> =>
  (await page.getByRole('status').filter({ hasText: /keyword results/i }).count()) > 0;

test.describe('in-browser retrieval measurement', () => {
  test('scores the shipped seed corpus through the real semantic pipeline', async ({ page }) => {
    test.setTimeout(EVAL_TEST_TIMEOUT_MS);

    await page.goto('/');
    await navClick(page, /library/i);
    await expect(viewHeading(page, /library/i)).toBeVisible();

    // Grid view keeps one card per entity, in rank order.
    await page.getByRole('button', { name: /grid view/i }).click();
    await page.getByRole('switch', { name: /semantic search/i }).click();

    const searchInput = page.getByRole('searchbox', { name: /search library/i });
    const rankings = new Map<string, string[]>();
    const lexicalQueries: string[] = [];

    for (const entry of SEED_QUERIES) {
      // Clear first: the store debounces on change, and re-typing the same
      // string into a non-empty box would not trigger a new search.
      await searchInput.fill('');
      await searchInput.fill(entry.query);

      const ranked = await waitForSettledRanking(page);
      rankings.set(entry.query, ranked);
      if (await sawLexicalFallback(page)) lexicalQueries.push(entry.query);
    }

    let recallSum = 0;
    let mrrSum = 0;
    const lines: string[] = [];
    for (const entry of SEED_QUERIES) {
      const ranked = rankings.get(entry.query) ?? [];
      const recall = recallAtK(ranked, entry.relevantIds, EVAL_K);
      const rr = reciprocalRank(ranked, entry.relevantIds);
      recallSum += recall;
      mrrSum += rr;
      lines.push(
        `  ${entry.query.padEnd(58)} recall=${recall.toFixed(3)} rr=${rr.toFixed(3)} ` +
          `top=${ranked.slice(0, EVAL_K).join(' ') || '(none)'}`,
      );
    }

    const recalls = recallSum / SEED_QUERIES.length;
    const mrr = mrrSum / SEED_QUERIES.length;
    process.stdout.write(
      `\nin-browser eval — seed corpus (${String(SEED_QUERIES.length)} labels, ` +
        `${String(seedEntities.length)} documents)\n` +
        `${lines.join('\n')}\n` +
        `  ${'TOTAL'.padEnd(58)} recall@${String(EVAL_K)}=${recalls.toFixed(3)} mrr=${mrr.toFixed(3)}\n` +
        `  lexical fallbacks: ${String(lexicalQueries.length)}/${String(SEED_QUERIES.length)}\n`,
    );

    // The measurement is only meaningful if every query actually ranked
    // something: an empty grid would score 0 recall for a rendering bug, not a
    // retrieval one.
    for (const entry of SEED_QUERIES) {
      expect(rankings.get(entry.query)?.length ?? 0, `no results for "${entry.query}"`).toBeGreaterThan(0);
    }
    // Retrieval quality is recorded above, not asserted: the labels are
    // authored, and a threshold here would fail CI for a model refresh rather
    // than for a regression.
    expect(mrr).toBeGreaterThan(0);
  });
});
