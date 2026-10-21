# Plan 182 — An aborted semantic query wedges every later one

**Date:** 2026-10-21
**Status:** Done — reproduced deterministically, fixed, covered by a regression test
**Owner:** integration owner for this sweep
**Found during:** the post-merge sweep, chasing an e2e flake observed in the Plan 179/181 work

## Summary

The embedding runtime caches the *promise* of a model load. An aborted query
races that promise with its signal and rejects immediately, but the load
itself keeps running — and the cached promise stays pending.

The next query then inherits that pending promise instead of starting its own
load. If the model never arrives, the query waits on it forever, and the UI
stays on "Loading semantic model…" with no result and no error.

The symptom is a stuck loading banner on the Library view's semantic search.

## Root cause

`src/lib/search/embeddings.ts`:

```ts
export const getEmbedder = (): Promise<EmbeddingPipeline> => {
  if (embedderPromise === null) {
    embedderPromise = loadEmbedder(embedderGeneration)
  }
  return embedderPromise
}
```

and in `embedTexts`:

```ts
const extractor = await raceWithAbort(getEmbedder(), signal)
```

`raceWithAbort` rejects with `AbortError` when the signal fires, but it does
not cancel the underlying load — that is the point of racing it. The
`catch` in `loadEmbedder` drops the cached promise when the load *fails*:

```ts
embedderPromise = null
```

but an **aborted** load is not a failed load. Nothing dropped the cached
promise, so it stayed pending, and every later caller got it.

The first query's abort is what exposes this: the abort is the only way to
reach the state, and it is reached whenever a query is superseded — a late
store hydration replacing `entities` with a new array, a type-filter change,
or the user typing again mid-load.

## The fix

`embedTexts` now drops the cached promise when the race is lost to an abort:

```ts
let extractor: EmbeddingPipeline
try {
  extractor = await raceWithAbort(getEmbedder(), signal)
} catch (err) {
  if (isAbortError(err)) {
    dropEmbedderPromise()
  }
  throw err
}
```

The next query then starts its own load instead of inheriting one that only
the model can settle.

## Verification

### Deterministic reproduction

The regression test in `src/lib/search/embeddings.test.ts` reproduces the
wedge without a browser: the first query is aborted while the model load is
pending, and the second query must not inherit that pending promise.

| | Before the fix | After the fix |
| --- | --- | --- |
| "does not leave a pending embedder promise after an abort" | **fails** — times out at 5 s | passes in 53 ms |

The test was verified to fail against the unfixed code and pass against the
fixed code.

### The e2e flake

`e2e/semantic-search.spec.ts` — "surfaces a lexical fallback hint when the
semantic model is unavailable" — failed intermittently during the Plan 179
sweep and again during the Plan 181 work. It passed 5/5 in isolation and
216/216 in a full-suite run both before and after the fix, so the flake is
rare and timing-dependent: it needs the model load to be in flight when a
query is superseded, which is a narrow window that widens under CI load.

The flake was never recorded in `plans/`, and the CI E2E job is skipped on
pushes that do not touch `src/**` — so the repository had no visibility into
it at all.

### Local gate

- `pnpm test` — 3100+ passed
- `pnpm run test:e2e --project=chromium` — 216 passed, 1 skipped
- `./scripts/quality_gate.sh` — all gates green

## A wrong first diagnosis, recorded because it nearly shipped

The first hypothesis was that the hook's cleanup left `semanticBusy` stuck: a
teardown aborts the in-flight request, and the request's `catch` returns
early on `cancelled` without clearing the flag. That is true in isolation,
but it does not hold up, because **every** teardown is followed by a new
effect run that sets `busy` back to true and owns the state from there. The
last effect run always owns the flag.

The state machine that actually matters:

- The banner is stuck only when the **last** effect run's request never
  settles — not when an earlier one was superseded.
- A superseded request is always followed by a replacement, and the
  replacement sets `busy` again.
- So the stuck case is a request that **hangs** — which is what the cached
  pending promise produces.

The first attempt also wrote a test that passed with *and* without the
proposed fix, which is how the wrong hypothesis was caught. That test was
discarded rather than kept as a false guarantee.

The lesson matches the one already in `agents-docs/LESSONS.md` (LESSON-041):
a test that has not been seen to fail is not evidence.
