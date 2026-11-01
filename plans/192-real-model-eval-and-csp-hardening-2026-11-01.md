# Plan 192 — Real-model retrieval evaluation and production CSP hardening (2026-11-01)

Follow-up to [Plan 191](191-proposal-triage-2026-10-31.md). Plan 191 closed with two
open questions it could not answer with the concept stand-in: whether **real
embeddings** change retrieval on the shipped corpus (#1065), and whether the
**browser** can load the model under a CSP without `'unsafe-eval'` (#1051).

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Score the shipped corpus with the real embedding model | Done | Harness runs in Node, saturates at 1.000 — a limit of the labels, not a result about the model |
| 2 | Make the embedder loadable outside the browser | Done | Test-only device override; Node rejects `wasm` outright |
| 3 | Remove `'unsafe-eval'` from the production CSP | Done, partially verified | Header served correctly; model load in-browser blocked by an upstream 503, not by the policy |

## Wave 1 — model-backed evaluation (#1065)

`src/lib/search/eval/model-eval.test.ts` runs the same eight labelled queries,
the same `evaluateStrategy` metrics, and the same fusion step as
`seed-corpus.test.ts`, but ranks the semantic arm with the model the app actually
ships (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384 dims, q8) instead of
the hand-written concept table.

The labels were extracted to `seed-queries.ts` and are imported by **both**
harnesses, so a difference between the two semantic arms can only come from the
retriever. `strategies.ts` gained `fuseWithSemanticIds` (fusion takes ranked ids,
not a ranker) with `hybridRankIds` expressed in terms of it — the concept arm and
the model arm cannot diverge in fusion code.

**Opt-in, and not a gate.** The file is `describe.skipIf(RUN_MODEL_EVAL !== '1')`
because a first run downloads ~25 MB of ONNX weights. It never runs in CI, and
must not be cited as CI evidence. It is a measurement to run when the retrieval
stack changes:

```bash
RUN_MODEL_EVAL=1 pnpm exec vitest run src/lib/search/eval/model-eval.test.ts
```

Measured (8 labels, 8 entities, real embeddings):

| Strategy | recall@5 | MRR |
| --- | ---: | ---: |
| lexical (BM25) | 1.000 | 1.000 |
| embedding | 1.000 | 1.000 |
| hybrid | 1.000 | 1.000 |

**This is a ceiling, not a win.** BM25 already answers every labelled query at
k=5, so an embedding arm cannot show a gain on this label set — the same honest
limit Plan 191 recorded, now measured rather than assumed. What the test asserts
is therefore a property, not a score: every label stays reachable through the
fused path, and hybrid recall/MRR never fall below the better single retriever.

## Wave 2 — Node backend override

First run failed with `Unsupported device: "wasm". Should be one of: cuda,
webgpu, cpu`. `EMBEDDING_DEVICE` is pinned to `wasm` for the browser, which is
correct for the app and wrong for Node.

`embeddings.ts` now holds a module-level `embeddingDevice` seeded from that
constant, plus `setEmbeddingDeviceForTests('cpu')`, which disposes the loaded
pipeline so the next call reloads. Deliberately mirrors
`setSemanticIndexBudgetForTests` in `vector-store.ts`: an override for tests and
tooling that application code never toggles.

Second failure was the test realm, not the code: onnxruntime validates tensors
with a cross-realm `instanceof Float32Array` against Node's native constructor,
so under jsdom every tensor is rejected. The file is
`// @vitest-environment node`.

## Wave 3 — production CSP (#1051)

`next.config.ts` now builds the policy per environment:

- **production**: `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` —
  no `'unsafe-eval'`. React's production build does not need it; WASM
  compilation is covered by `'wasm-unsafe-eval'`, which is what the embedding
  runtime asks for.
- **development**: keeps `'unsafe-eval'` for Fast Refresh's eval-based module
  wrapper.

Also removed: the `http://[::1]:*` source in `connect-src`. It is not a valid CSP
source expression, so the browser ignored it and logged an invalid-source error on
**every page load** — a pre-existing defect independent of the eval question, and
the reason the dev banner was noisy.

### Verified

- Served header, from `curl -sI http://127.0.0.1:3124` against a production
  build newer than the config:
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` — no `'unsafe-eval'`.
- Production build boots, hydrates, navigates Library, runs search, and opens the
  chat with **zero** `securitypolicyviolation` events and **zero** console CSP
  errors across repeated drives.
- `http://[::1]:*` is gone from the header.

### Not verified, and why

- **The embedding model did not load in the browser.** `huggingface.co` returned
  **HTTP 503** for `tokenizer_config.json` on both driven attempts. The UI fell
  back to lexical with its surfaced reason, which is the designed behaviour, but
  it means this plan does **not** establish that `'wasm-unsafe-eval'` alone is
  sufficient for `onnxruntime-web`. That remains open on #1051.
- **The in-page eval probe was invalid.**
  `page.evaluate(() => new Function('return 1')())` succeeded under a policy with
  no `'unsafe-eval'`. Playwright evaluates over CDP, and Chrome exempts
  protocol-initiated evaluation from the CSP script checks, so the probe could
  not fail. It is recorded here rather than presented as evidence; the header is
  the evidence. See LESSON-057.

Risk if `onnxruntime-web` ever does need `'unsafe-eval'`: semantic search degrades
to BM25 with a visible status message — degraded, not silent.

## Verification

- `RUN_MODEL_EVAL=1 pnpm exec vitest run src/lib/search/eval/model-eval.test.ts`
  — passes; prints the table above; ~8 s with the model warm.
- `pnpm run build` — clean; `.next` rebuilt after the CSP edit.
- Browser drive against `next start`: app ready, nav, search, chat, no CSP errors.
- `pnpm typecheck`, `pnpm typecheck:test`, ESLint on touched files, `markdownlint`,
  `pnpm run docs:check` — exit 0.

## Round 2 — the open questions answered (2026-11-01)

### #1051 settled: `'unsafe-eval'` cannot be removed

A second drive against the production build, this time with a
`securitypolicyviolation` listener attached **before** hydration, captured a
real violation while the semantic path initialised:

```text
script-src -> eval
```

`onnxruntime-web` (loaded through transformers.js) compiles code with `eval`.
`'wasm-unsafe-eval'` permits WebAssembly *compilation* and does not cover that,
so it is an addition to `'unsafe-eval'`, never a substitute. Removing the
directive would have shipped a permanently lexical search behind a toggle that
looks enabled — degraded, and until now silent.

Decision: production restored to
`script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'`, keeping the
per-environment constant and the IPv6 fix. Re-drive with the directive back:
**zero** violations. #1051 keeps only the `'unsafe-inline'` half (needs a nonce
pipeline Next does not emit).

Note the asymmetry with LESSON-057: `page.evaluate` could not test the policy,
but a `securitypolicyviolation` listener registered via `addInitScript` can, and
did — it caught what booting the app never would.

### #1065 de-saturated: the labels, not the model, were the problem

Eight paraphrase labels were added, chosen for lexical *mismatch* rather than
for what the model is known to get right (authoring labels the retriever already
answers measures the label). 16 labels, 8 entities:

| Strategy | recall@5 | MRR |
| --- | ---: | ---: |
| lexical (BM25) | 0.813 | 0.708 |
| embedding | 1.000 | 0.865 |
| hybrid (fused) | 1.000 | 0.859 |

This is the first measurement in this repository that shows a semantic gain:
BM25 misses 3 of 16, embeddings miss none. The concept stand-in still scores
0.000 — its vocabulary was the issue all along.

**A finding fell out of it.** Fusion's MRR (0.859) is *below* pure embedding
(0.865): reciprocal rank fusion promotes a hit the weaker lexical list also
matched, costing a fraction of a rank. Asserting `hybrid >= max(lexical,
semantic)` on MRR therefore encoded a claim the data refutes, so that assertion
was replaced with two that can fail — fusion must not trail the weak arm it is
built from, and must stay within `FUSION_MRR_TOLERANCE` (0.05, ~10x the measured
0.005 gap) of the strong one. Recall keeps the `>= max` claim, where it holds.

The reachability guard in `seed-corpus.test.ts` was also corrected rather than
weakened: it asserted the *concept arm* reached every label, which was only true
while labels were tuned to it. It now asserts every label names a document the
corpus still contains (a deleted document or typo'd id still fails), and "a
retriever reaches it" lives in the model harness, which can.

Recorded limits: the labels are authored, so this is a regression signal, not
ground truth; 8 documents is a small corpus; and the model still could not be
loaded from the CDN in the browser (HTTP 503, see below), so the browser-side
numbers remain unmeasured — the Node run uses the same weights on the `cpu`
backend.

### Fallback made visible

`SemanticStatusBanner` rendered "Semantic search unavailable — showing keyword
results instead" whenever the outcome was still `null` — that is the *idle*
state, so with the toggle on and an empty box the UI claimed the feature was
broken before any search had run. It now renders that notice only when an
outcome actually came back as `source: 'lexical'`, in a bordered callout, with
the fallback's own `reason` underneath. Observed live during the re-drive:

```text
Semantic search unavailable — showing keyword results instead.
Semantic embedding model failed to load (…MiniLM-L12-v2): Service unavailable
while trying to load …/tokenizer_config.json
```

Still upstream: `curl` reaches that file (200 after redirect) while the browser
receives 503, so the CDN is refusing the browser's fetch specifically. The UI now
says so instead of implying the app is broken.

### Round 2 verification

- `RUN_MODEL_EVAL=1` passes with the corrected assertions; prints the table above.
- `seed-corpus.test.ts` (concept arm) passes: lexical 0.813/0.708, concept 0.000,
  hybrid 0.813/0.708 — no longer saturated, and fusion loses no lexical recall.
- Focused suite: 19 tests across the eval harnesses and the library semantic view.
- `pnpm run build` clean; served header re-read from the build.
- Production drive: **0** CSP violations; fallback reason rendered in the banner.
- `pnpm typecheck`, ESLint on every touched file — exit 0.

## Follow-ups

- **#1051** keeps only its `'unsafe-inline'` half. Removing that needs a nonce
  pipeline Next does not emit today; until then the directive stays documented
  as required rather than aspirational.
- **#1065** would benefit from a corpus larger than 8 documents and labels from
  someone other than the person who wrote the retrievers. The current numbers
  are directional, not a benchmark.
- **Upstream**: the browser fetch of the model gets 503 while `curl` gets 200;
  worth a separate look if semantic search is meant to work on a cold cache.

## Round 3 — the follow-ups themselves (2026-11-01)

### CSP: one constant instead of two identical branches

The per-environment shape outlived its purpose once both branches allowed
`eval`. Keeping it would keep advertising a production/dev difference that no
longer exists — and an invitation to "tighten" production into the exact defect
measured in round 2. It is now a single `scriptSrc` constant with the reason
beside it. Header and app behaviour unchanged.

### Service worker: the model survives a cold cache

The browser's 503 was not fixable here, but the *dependency* was: once the model
is on disk, a reload should never need the CDN. `public/sw.js` gained a
`dks-model-v1` cache with a cache-first strategy for the hosts transformers.js
downloads from (`huggingface.co`, `cdn-lfs.huggingface.co`, `cdn-lfs.hf.co`).

Routing is by **host, before the static-asset branch**, and that ordering is the
whole fix. `.json` is in `STATIC_EXTENSIONS`, so the tokenizer would otherwise be
filed under the shell cache that every deploy wipes; `.onnx` is not in that list
at all, so weights would never be cached. The model cache is also excluded from
nothing on activate — it is added to `validCaches` — so a new build does not
force a 25 MB re-download.

Failed fetches (the 503 included) are **not** cached, so the next attempt still
retries the network rather than pinning an error for the cache's lifetime.

`pwa-cache.ts` mirrors the host list and cache name for the app and the tests,
and `pwa-cache-policy.test.ts` reads `public/sw.js` and asserts both match — a
drift between the two would only surface offline, on the one path nobody
exercises.

### A larger corpus, and a stronger result

`large-corpus.ts` adds 24 documents across the studio's subsystems and 16 labels:
8 that share vocabulary with their document, 8 paraphrases that avoid it. Both
halves are deliberate — only-paraphrase labels would make BM25 look broken rather
than weak, and only-keyword labels reproduce the saturation the corpus exists to
escape.

| Corpus | Mode | recall@5 | MRR |
| --- | --- | ---: | ---: |
| seed (8 docs) | lexical | 0.813 | 0.708 |
| seed (8 docs) | embedding | 1.000 | 0.865 |
| seed (8 docs) | hybrid | 1.000 | 0.859 |
| large (24 docs) | lexical | 0.875 | 0.755 |
| large (24 docs) | embedding | 1.000 | 0.919 |
| large (24 docs) | hybrid | 1.000 | **0.938** |

At 24 documents with real distractors the fusion gain is unambiguous: hybrid MRR
*exceeds* both single modes (0.938 vs 0.919 and 0.755), rather than trailing pure
embedding as it does on the 8-document set where every query has one obvious
target. Both corpora go through the same `scoreCorpus` helper and the same fusion
step, so the difference is the corpus, not the code.

The model-backed test asserts the *property* that matters at scale — BM25 is not
already saturated (`recall < 1`) and embeddings beat it — instead of a threshold,
and `FUSION_MRR_TOLERANCE` still bounds fusion's cost where it exists.

Honest limit: these labels were written by the person who wrote the retrievers.
They were written from the documents, before running anything, and the paraphrase
half is structurally harder — but they are not independent and 24 authored
documents are not a benchmark.

### Round 3 verification

- `node --check public/sw.js` — exit 0.
- 27 deterministic tests pass across the large-corpus fixture, the PWA cache
  policy (including the SW parity assertions) and the seed corpus.
- `RUN_MODEL_EVAL=1` — 2 passed, printing both tables above.
- `pnpm typecheck`, ESLint on every touched file — exit 0.

## Round 4 — semantic search actually runs in the browser (2026-11-01)

The 503 was never Hugging Face. Instrumenting `window.fetch` and reading the
response body settled it in one run:

```json
{ "file": "tokenizer_config.json", "status": 503,
  "type": "basic", "body": "Offline — model not cached" }
```

That body is **this repository's own service worker**. `cache.put` rejects
responses the Cache API refuses to store, and every strategy had the write inside
the same `try` as the fetch — so a storage rejection was caught and reported as a
network failure. transformers.js surfaced it as "Service unavailable" and the
model never loaded, while the bytes had arrived fine. The same shape existed in
`cacheFirst` (where `.json` model files went before the host routing),
`networkFirst` and `navigationFallback`.

Fix: `cacheWrite()` in `public/sw.js` swallows and logs the write failure and the
response is returned regardless. A 503 now means only that the fetch failed.

Then the next layer appeared, which is the point of driving iteratively:

```text
script-src-elem -> blob
no available backend found … Failed to fetch dynamically imported module: blob:…
```

`onnxruntime-web` imports its WASM loader as a **blob module**, which CSP
classifies as a script element; `worker-src` already allowed `blob:`, and the
import needed it in `script-src` too. With that, in a production build:

```text
outcome: "hybrid", violations: [], badResponses: [],
caches: ["dks-static-v6", "transformers-cache", "dks-model-v1"]
badges: 1 × "Keyword + meaning", 7 × "Meaning"
```

First verified end-to-end semantic search in this repository: the model
downloads, the vector index builds, both retrievers contribute, and the badges
say which.

### Fusion weighting: measured, then declined

With the semantic path real, the weighting question became measurable. Sweep over
lexical weight (recall stayed 1.000 throughout):

| lexical weight | seed MRR | large MRR |
| --- | ---: | ---: |
| **1.00 (plain RRF, shipped)** | **0.859** | **0.938** |
| 0.75 | 0.865 | 0.938 |
| 0.50 | 0.865 | 0.938 |
| 0.25 | 0.896 | 0.938 |

Discounting lexical does close the seed-corpus gap against pure embeddings
(0.865), and 0.25 beats even that. It is nevertheless **not shipped**, because
the gain is 0.006 MRR on eight authored documents and the cost is a guarantee:
with lexical at 0.5, a document only BM25 found drops below semantic-only hits,
and out of a tight result cut. `vector-store.test.ts` caught exactly that — its
lexical-only hit fell from second place to third — and that is the
identifier-query shape ("TRIZ-42"), where BM25 is the only engine with anything
to say.

The capability stays (`RankedList.weight`, plus a `lexicalWeight` parameter on
the harness fusion and a printed sweep), so this is revisitable with identifier
labels and a wider cut than two results. `FUSION_LEXICAL_WEIGHT` is 1 and
carries the whole measurement, including why it is not 0.5.

### Round 4 verification

- `node --check public/sw.js` — exit 0.
- Production drive: `hybrid`, 0 CSP violations, 0 failed model responses, model
  cache populated, both badge kinds rendered.
- `RUN_MODEL_EVAL=1` — 3 passed; the sweep prints both tables above.
- Focused suites for fusion, both eval corpora, the PWA policy and the seed
  corpus — all green. ESLint — exit 0.

### Codacy found the same defect one layer up

The first push of this round failed Codacy on `public/sw.js:237`
(`detect-unhandled-async-errors`) — and it was right, not a false positive.
`evictModelCacheOverBudget` awaits `cache.keys()`, `cache.match()` and
`cache.delete()`, all of which can reject, and it runs inside
`event.respondWith`: an unhandled rejection there breaks the response the model
load depends on. That is the failed-write-masks-a-fetch bug, moved up a level.

Fixed at the class, not the line: eviction is wrapped and logged, and `caches.open`
goes through an `openCache()` helper that returns null when storage is blocked so
every caller falls through to the network. Five call sites now share it.
