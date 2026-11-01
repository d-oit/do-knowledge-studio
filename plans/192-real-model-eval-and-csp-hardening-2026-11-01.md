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

## Follow-ups

- **#1051 stays open** until a browser run with a reachable model CDN loads the
  embedder under the tightened policy. Re-run the drive; if it fails with a
  `wasm-unsafe-eval` violation rather than a network error, restore
  `'unsafe-eval'` and record that the runtime needs it.
- **#1065** needs a larger labelled set than eight authored queries before any
  claim about semantic retrieval quality can be made. The current corpus is
  saturated for BM25.
