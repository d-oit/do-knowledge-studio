# Performance Baselines

This document records the reproducible performance checks in the repository and the
measurement notes behind them. It names only subsystems that exist in the current
tree; where a figure predates the current implementation it is labelled
**historical**.

There are two measurement surfaces:

1. **Dedicated Vitest benchmarks** (`*.bench.test.ts`) — run with
   `pnpm run test:bench` using `vitest.bench.config.ts`. Wall-clock thresholds
   are isolated from the regular `pnpm run test` suite.
2. **Ad-hoc local runs** — for a before/after comparison on one change, time the
   relevant function directly with `performance.now()` in a throwaway script rather
   than deciding on a single CI run.

---

## 1. Lexical search (BM25) — `src/lib/search/retrieval.ts`

`search()` builds a BM25 index over entities and claims. `getIndex()` caches the
index and rebuilds whenever either array reference changes; tokenization is now
memoized per entry id (`tokenizedById`), so a rebuild forced by a single edit
re-tokenizes only the touched entry instead of the whole corpus.

**How to measure:** `src/lib/search/retrieval.bench.test.ts` builds a
1,000-entity / 3,000-claim corpus, measures one cold build, then times 30 cached
queries, and also exercises a corpus above `MAX_CACHE_ENTRIES`.

**Acceptance criteria:**
- A cold index build stays under the `COLD_BUILD_MS_CEILING` (5,000 ms) smoke bound.
- A cached query beats the cold rebuild it avoids by at least
  `MIN_CACHE_SPEEDUP_FACTOR` (2×).
- Incremental reuse after add/edit/delete ranks identically to a cold rebuild.
- Corpora above `MAX_CACHE_ENTRIES` (20,000 entries) bypass the cache to bound
  memory, and searching them does not error.
- The semantic path (`src/lib/search/vector-store.ts`, run through the worker in
  `src/lib/search/search-worker.ts`) is the vector complement of the lexical path.

**Historical baselines** (quiet machine, from the guard's comments): cold index
build ≈ 210 ms; cached query average ≈ 3.4 ms. A local one-off (2026-10-17,
2,000 entities × 3 claims = 8,000 entries) measured a cold build median of ≈ 384 ms
and a single-edit rebuild median of ≈ 17 ms after tokenization reuse — down from
≈ 367 ms before it, i.e. the rebuild is no longer a full re-tokenization.

---

## 2. Intent parsing — `src/lib/nlp.ts`

`parseIntent()` is the natural-language front end for entity/claim/search intents.

**How to measure:** `src/lib/nlp.bench.test.ts` runs 100 warm-up passes over 7
sample phrases, then 10,000 timed passes over the same samples, and asserts the
total stays under `PARSE_INTENT_MS_CEILING` (2,000 ms).

**Acceptance criteria:** the workload is non-blocking under parallel test-runner
load; a semantic regression that changes parsed output is caught by
`src/lib/nlp.test.ts`, not this guard.

**Historical baseline** (paired run recorded in `plans/168`): baseline median
209.82 ms vs optimized head median 158.80 ms over 7 alternating pairs of 10,000
passes across 7 samples, ≈ 1.32× faster.

---

## 3. Store selectors — `src/lib/studio/store.ts`

`useStats` and `useFilteredEntities` must keep referential stability so unrelated
store writes do not re-render their consumers.

**How to verify:** `src/lib/studio/use-stats.test.tsx` and
`src/lib/studio/use-filtered-entities.test.tsx` are behavioral tests in the
regular suite. They assert referential identity after related and unrelated state
changes; neither test contains a timing threshold.

**Acceptance criteria:** unrelated state changes return the same object/array
instance; related state changes return a new one.

---

## 4. Graph and mind map rendering

- **Graph** — `src/components/studio/views/graph-view.tsx` renders a custom SVG
  canvas (no third-party graph library). Node placement and canvas sizing are pure
  functions in `src/lib/studio/graph-layout.ts` and
  `src/lib/studio/graph-viewport.ts`; `graph-view.tsx` focuses on drawing and
  interaction.
- **Mind map** — `src/components/studio/views/mindmap-view.tsx` renders a custom
  `role="tree"` structure (no third-party mind-map library).

**How to measure:** there is no automated latency guard for these views; profile
the running app with the browser Performance panel and the React Profiler. Watch
that focus mode and layout changes do not rebuild the canvas needlessly, and that
the graph canvas grows with the placed nodes instead of drawing off-canvas.

**Acceptance criteria:** the graph canvas covers every placed node; toggling focus
mode filters what is drawn without rescaling the canvas.

---

## 5. Editor preview

- **Editor** — `src/components/studio/views/editor-view.tsx`, with the markdown
  preview in `src/components/studio/views/editor-preview.tsx` (`react-markdown` +
  `remark-gfm`, links and images vetted through `sanitizeUrl`).

**How to measure:** profile the Editor view with the React Profiler while typing
and saving; check that the preview re-renders only when the document changes.

---

## Data collection

All automated timing assertions live in dedicated `.bench.test.ts` files and are
run by `pnpm run test:bench`, not the regular test command. The benchmark suite
covers:

- `src/lib/search/retrieval.bench.test.ts` — cold/cached BM25 queries and a large
  corpus.
- `src/lib/nlp.bench.test.ts` — intent parsing throughput.
- `src/lib/ai/context.bench.test.ts` — indexed entity lookup in a large corpus.
- `src/lib/studio/claim-parser.bench.test.ts` — repeated plain-text and large
  document scans.
- `src/lib/studio/triz-data.bench.test.ts` — the full TRIZ matrix lookup.

Store selector tests check reference stability rather than elapsed time. There is
no in-app performance panel and no `performance.mark()`/`performance.measure()`
module in the current tree; earlier revisions of this document referenced
`src/lib/perf/index.ts`, an in-app panel, and metrics such as `orama-query-time`/
`mindmap-init`. Those are **historical** and are not reproducible against the
current implementation.
