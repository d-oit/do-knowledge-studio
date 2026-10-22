# Plan 182 — A hung model load wedges every later semantic query

**Date:** 2026-10-21
**Status:** Done — reproduced deterministically, fixed, covered by regression tests
**Owner:** integration owner for this sweep
**Found during:** the post-merge sweep, chasing an e2e flake observed in the Plan 179/181 work

## Summary

The embedding runtime caches the *promise* of a model load. A load that never
settles stays cached forever, so every later query inherits that pending
promise instead of starting its own. The UI stays on "Loading semantic
model…" with no result and no error.

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

`loadEmbedder` drops the cached promise when the load **fails**:

```ts
embedderPromise = null
```

so a failed load is retried on the next query. But a load that never settles
is not a failed load — it has no failure to observe, and nothing dropped the
cached promise. Every later query then awaited that same pending promise.

`embedTexts` does not help either: it races the load against the query's
abort signal, so a *superseded* query rejects promptly — but the load itself
keeps running and the cached promise stays pending.

## The fix

Bound the load itself, so a load that never settles fails cleanly and
releases every waiter:

```ts
export const EMBEDDER_LOAD_TIMEOUT_MS = 120_000
```

`loadEmbedder` wraps the `pipeline(...)` call in `withLoadTimeout`. On
timeout the load rejects through the existing failure path — which sets
`embedderStatus = 'error'`, records the failure, and drops the cached
promise — so the next query starts a fresh load.

The bound belongs on the load, not on the query, because the load is shared:
failing it cleanly releases every waiter at once.

## The squash commit message is stale

PR #1012 was squashed, and GitHub takes the PR title and the first commit's
message — both of which described the *abandoned* first attempt ("drop the
cached embedder promise when a query is aborted"). The code in `main` is the
reworked version; only the message is wrong.

Correcting it would need a force-push to `main`, and the branch protection
rejects that (`GH013: Changes must be made through a pull request`). A
follow-up PR cannot fix it either: the message belongs to the commit that
already exists. The commit history therefore reads "drop the cached embedder
promise", while the diff it contains bounds the load instead.

Worth remembering for the next squash: when a PR's approach changes after
its first commit, the squash message follows the first commit, not the final
state.

## Verification

### Regression coverage

Two tests in `src/lib/search/embeddings.test.ts`:

| Test | Asserts |
|---|---|
| fails a model load that never settles instead of caching a pending promise | a hung load fails cleanly, and the next query starts a fresh load |
| shares one model load across superseded queries | five superseded queries start **one** download, not five |

Both were verified to fail against the unfixed code and pass against the
fix.

### Local gate

- `pnpm test` — 3100+ passed
- `pnpm run test:e2e --project=chromium` — 216 passed, 1 skipped
- `./scripts/quality_gate.sh` — all gates green

## The e2e flake

`e2e/semantic-search.spec.ts` — "surfaces a lexical fallback hint when the
semantic model is unavailable" — failed intermittently during the Plan 179
sweep and again during the Plan 181 work. It passed 5/5 in isolation and
216/216 in a full-suite run, so the flake is rare and timing-dependent: it
needs the model load to be in flight when a query is superseded, which is a
narrow window that widens under CI load.

The flake was never recorded in `plans/`, and the CI E2E job is skipped on
pushes that do not touch `src/**` — so the repository had no visibility into
it at all.

## Two wrong diagnoses, recorded because both nearly shipped

### The first: the hook's cleanup left `busy` stuck

The hypothesis was that a teardown aborts the in-flight request, and the
request's `catch` returns early on `cancelled` without clearing
`semanticBusy`.

That is true in isolation but does not hold up, because **every** teardown is
followed by a new effect run that sets `busy` back to true and owns the
state. The last effect run always owns the flag, so the banner is stuck only
when the **last** run's request never settles — a hang, not a cancellation.

The first attempt also wrote a test that passed with *and* without the
proposed fix, which is how the wrong hypothesis was caught. That test was
discarded rather than kept as a false guarantee (LESSON-041).

### The second: dropping the cached promise on abort

The first implementation dropped `embedderPromise` in `embedTexts` when the
race was lost to an abort. It fixed the wedge, and the code review found two
P1s in it:

1. **It evicted an already-loaded model.** The drop was unconditional, so an
   abort while the model was ready forced the next query to re-import,
   re-download and re-initialize the whole pipeline. Measured: the pipeline
   call count went from 1 to 2 across an abort with a warm model.
2. **It broke the lazy-singleton contract.** The load is not cancellable, so
   dropping the cache started a *second* concurrent load with the same
   generation index. The first load's failure path could then wipe the
   second load's cached promise and set `embedderStatus = 'error'` while it
   was still loading.

A third finding was a P2: because the search input is debounced and every
keystroke supersedes the previous query, dropping the promise mid-download
would spawn an independent ~25 MB download per keystroke.

All three are fixed by bounding the load instead of evicting the cache. The
measurement that settles it: five superseded queries now start **one**
pipeline call, and a warm model survives an abort untouched.

The lesson is the same one as before, in a new costume: the first fix made
the failing test pass, but a fix that breaks a shared resource is not a fix.
The review's counter-measurements — a warm model surviving an abort, five
queries sharing one download — are what distinguish the second attempt from
the first.

### A third problem, found by the quality gate

The second attempt passed its own tests but failed `./scripts/quality_gate.sh`
with an unhandled rejection. The cause was in the test, not the product: it
advanced the fake timer to trigger the timeout and *then* attached the
rejection handler, so the rejection landed with no handler attached.

The production chain has no such window — `embedTexts` → `vector-store` →
the UI's `await` — so a failed load is always handled there. The test now
attaches the handler before advancing the timer.

The underlying cause is worth stating because it applies to any timeout
built on `Promise.withResolvers()`: the timer rejects a promise that may
already have no waiter, so the promise needs its own no-op handler.
