# Plan 191: External Proposal Triage — Eight Recommendations (2026-10-31)

**Status**: Triage complete; follow-ups for proposals 1, 2 and 8 delivered (see below).
**Input**: an external proposal set submitted 2026-10-31, framed as eight GitHub
issues: SQLCipher encryption at rest, sqlite-vec hybrid search, Yjs + y-websocket
collaboration, FTS5 tuning, a Node plugin loader, OpenAPI for the agent harness,
a VitePress/TypeDoc site, and CI performance benchmarking.

## Why this document exists

Every one of those proposals assumes a SQLite database and an HTTP server. This
build has neither, by design: the canonical corpus is IndexedDB behind Zustand
(`README.md:11`, `README.md:148`), and `AGENTS.md` forbids a required backend.
Two proposals describe features that already shipped under different technology.
Acting on the set as written would mean deleting working subsystems to install
their assumptions.

So this plan records what is actually in the repository, one verdict per
proposal, and the two items worth doing. It is written as a *rejection record*:
the excluded items are listed explicitly so they are not re-proposed later.

## Method

Each claim was checked against live code and `package.json`, not against the
proposal's description of the project. A proposal survives only if (a) the
subsystem it targets exists here, and (b) it does not contradict the hard rules
in `AGENTS.md`. Line references below are to the current working tree.

## Verdicts

| # | Proposal | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | SQLCipher + Argon2 encryption at rest | Reject as written; narrow kernel recorded | No SQLite dependency in `package.json`; corpus is IndexedDB (`canonical-storage.ts`); browser-only runtime cannot load a native SQLite build |
| 2 | sqlite-vec hybrid search | Adapt — the *fusion* gap is real, the storage is not | BM25 in `retrieval.ts`; semantic search in `vector-store.ts:447`; `sqlite-vec` requires SQLite |
| 3 | Yjs CRDT + y-websocket | Already shipped; transport differs deliberately | `yjs`, `y-webrtc`, `y-indexeddb` in `package.json`; `src/lib/sync/`; ADR 045; Plan 185 |
| 4 | FTS5 external content + bm25 weights | Reject as written; no target subsystem | No FTS5 anywhere; lexical scorer is hand-rolled `bm25Score` (`retrieval.ts:245`) |
| 5 | Node plugin loader + worker sandbox | Reject design; existing registry is the extension point | `src/lib/studio/entity-types.ts` `registerEntityType`; `node:fs` / `worker_threads` are unavailable in-browser |
| 6 | OpenAPI 3.1 + Swagger UI for agent tools | Reject — documents a surface that does not exist | No HTTP API by rule (`AGENTS.md`); tool I/O is already Zod-validated |
| 7 | VitePress + TypeDoc docs site | Not now — adds a second corpus that can drift | Docs are README/`plans/`/`agents-docs/`, guarded by `pnpm run docs:check` (Plan 190) |
| 8 | Vitest benchmarks in CI with regression gate | Genuine gap — benches exist, CI does not run them | `vitest.bench.config.ts` lists 8 bench files; `pnpm run test:bench`; no workflow invokes it |

## Detail

### 1. Encryption at rest

What already exists, and is verified: passphrase-encrypted portable backups use
PBKDF2-HMAC-SHA256 (310,000 iterations) plus AES-256-GCM with an authenticated
header (`src/lib/backup/archive-crypto.ts`, Plan 188); export encryption uses
PBKDF2 at 600,000 iterations (`src/lib/export/encrypt.ts`); API keys are stored
session-encrypted and migrated out of plaintext (`src/lib/studio/ai-settings.ts`).

What is genuinely missing: the live canonical IndexedDB record is a plaintext
structured clone (Plan 186). SQLCipher cannot address that — it is a SQLite
extension, and there is no SQLite. Argon2id would also need a WASM/native
implementation with no current dependency.

If at-rest encryption is ever wanted, it is a persistence change: WebCrypto over
the canonical envelope, an explicit key lifecycle (passphrase-derived key held
in memory, session-scoped), fail-closed behaviour on a missing or wrong key, and
no silent fallback to a plaintext write. Per `DELIVERY-LIFECYCLE.md` that needs
shadow and canary, not a one-line `pragma`. Not scheduled here.

### 2. Hybrid search

The two retrievers exist. `retrieval.ts` implements BM25 with `K1`/`B` constants
and `Intl.Segmenter` tokenization. `vector-store.ts` implements semantic search
with locally-run embeddings (`@huggingface/transformers`), an incremental index,
a 64 MiB budget, and an IndexedDB vector cache (Plan 187).

The real gap is *composition*, and it is worth stating precisely:
`semanticSearch` (`vector-store.ts:447`) returns semantic results when the index
is available and falls back to lexical BM25 only on failure. It never merges a
lexical ranking with a semantic ranking. So a query that is strong lexically and
weak semantically is served worse than it needs to be, and vice versa.

`sqlite-vec` is not applicable. The applicable work is a fusion stage: run both
retrievers, then combine with reciprocal-rank fusion or a weighted score, under
the existing semantic toggle. That needs relevance tests, not a new datastore.

### 3. Yjs collaboration

Already implemented, including the parts the proposal lists as new: `yjs`,
`y-webrtc`, and `y-indexeddb` are dependencies; `src/lib/sync/` contains the
bridge, merge, conflict, tombstone, presence, cursor and security modules; ADR
045 documents the threat model; `e2e/multi-device-sync.spec.ts` exercises two
independent origins.

The proposal's `y-websocket` transport is a regression for this product: it
requires a relay server, which the local-first rule forbids as a requirement.
WebRTC signaling already works without one, with room-password encryption and a
documented metadata exposure boundary.

### 4. FTS5 tuning

There is no SQLite and no FTS5 table, so external-content tables, sync triggers,
`INSERT INTO ... VALUES('optimize')`, and `bm25(notes_fts, ...)` column weights
have nothing to act on. The lexical engine is a single-token-stream BM25 over
entities and claims. Any relevance work here is a change to `bm25Score` with
retrieval tests — a different task from the one proposed.

### 5. Plugin system

The only extension point is the custom entity-type registry:
`registerEntityType` validates with Zod, refuses to override built-ins, and is
idempotent by id (`src/lib/studio/entity-types.ts`). That is a runtime,
in-browser registry — not a code-loading plugin system.

The proposed loader cannot run here. `node:fs/promises`, `pathToFileURL`, and
`worker_threads` are not available in the browser bundle, and adding a server to
host them contradicts the hard rules. Separately, dynamically importing
third-party ES modules into an app that holds the user's plaintext knowledge is a
trust boundary this project should not open without a dedicated security design.

If extensibility grows, extend the registry pattern (declarative definitions,
validated at the boundary), not arbitrary code execution.

### 6. OpenAPI for the agent harness

OpenAPI describes HTTP endpoints. This application has no HTTP surface to
describe: the harness is a client-side module set that calls provider APIs
directly (OpenRouter, Ollama), and `AGENTS.md` requires no backend. Tool inputs
and outputs are already Zod schemas, so they are runtime-validated at the
boundary; a Swagger UI would document routes that do not exist.

If MCP-style interoperability is wanted later, the cheap correct move is to
derive JSON Schema from the existing Zod schemas. No server, no spec drift.

### 7. Documentation site

Docs today are `README.md`, `plans/`, and `agents-docs/`, and Plan 190 added
`scripts/check-doc-consistency.mjs` so claims are checked against source
(`pnpm run docs:check`, wired into the quality gate). VitePress would introduce a
second documentation corpus whose claims the checker does not cover, plus a
Pages deployment. TypeDoc also expects a library entry point; this is an
application, not a published package.

Defer. If adopted, the consistency checker must be extended to the new surface in
the same change, or the drift returns in a new place.

### 8. CI benchmarks

Closer to done than the proposal assumes. `vitest.bench.config.ts` registers eight
benchmark files (retrieval, vector store, context assembly, claim parsing, TRIZ
data, graph layout, canonical storage, NLP), `pnpm run test:bench` runs them, and
`plans/perf-baselines.md` records baselines.

The missing piece is enforcement: no workflow invokes `test:bench`, so a
regression merges silently. Two decisions are needed before adding the job —
shared CI runners are noisy, so either gate on a median of several runs against a
`main` baseline with a tolerance, or publish the comparison as advisory and only
fail on a large, repeated regression. An advisory job is the cheaper first step
and cannot produce a false red build.

## Recommended sequence

1. **Advisory benchmark job** (#8) — cheap, no product risk, makes regressions
   visible.
2. **Lexical/semantic rank fusion** (#2) — the only proposal with a user-visible
   quality gain that is not already shipped.
3. **Revisit at-rest encryption** (#1) only as a designed persistence change
   with its own ADR and shadow/canary evidence.

## Follow-ups delivered (2026-10-31)

- **Proposal 2 — rank fusion.** `src/lib/search/fusion.ts` implements reciprocal
  rank fusion; `semanticSearch` now ranks the BM25 and vector lists together and
  reports `source: 'hybrid'` instead of discarding the lexical ranking. Fallback
  behaviour is unchanged: when the embedder is unavailable the outcome is still
  `source: 'lexical'` with the reason attached. Covered by `fusion.test.ts` and
  an integration case in `vector-store.test.ts` that drops the lexical list and
  is observed to fail.
- **Proposal 8 — benchmarks in CI.** `.github/workflows/bench.yml` runs the
  existing `pnpm run test:bench` guards on pull requests touching `src/**`, a
  manifest, or the bench config, then compares their durations with
  `plans/bench-baselines.json` through `scripts/check-bench-baseline.mjs`.
  Regressions at or above `MAX_REGRESSION_FACTOR` (10x) are warnings, not a red
  build: shared runners cannot support a tighter bound. Running the probe for
  this exposed a latent defect — `*.bench.test.ts` files are invisible to
  `vitest bench` (its include pattern is `*.bench.ts`) and `vitest run` does not
  execute `bench()`, so the repository's `bench()` blocks never measured
  anything. The `it()` perf guards do run; the baseline covers those, and the
  inert blocks are recorded in `plans/perf-baselines.md` rather than silently
  trusted.
- **Proposal 2 e2e — not added, deliberately.** The existing
  `e2e/semantic-search.spec.ts` forces a 404 for every Hugging Face route, so the
  model never loads and only the lexical fallback is observable. A semantic-
  success e2e would require shipping model weights or a fake ONNX runtime, and a
  test that cannot reach the fused path would be a check that cannot fail. The
  fusion contract stays covered by `fusion.test.ts` and the injected-defect
  integration case.
- **Proposal 1 — encryption at rest.** `plans/ADRs/048-at-rest-encryption.md`
  records the constraint set (WebCrypto, key lifecycle, fail-closed writes, and
  an inventory of the stores that would stay plaintext) and keeps the decision
  at Proposed. A standalone prototype now exists — `at-rest-crypto.ts` (versioned
  AES-256-GCM envelope, PBKDF2 at 600,000 iterations, header bound as AAD,
  discriminated refusals) and `at-rest-session.ts` (default-off
  `dks-at-rest-encryption` flag, in-memory-only key) — but nothing reads it from
  `canonical-storage.ts`. Wiring it in needs an unlock UI and the browser
  shadow/canary evidence in ADR 048, so the live store still writes plaintext.

## Second follow-up round (2026-10-31)

- **Per-hit match signals (proposal 2, #1065 acceptance criterion).**
  `reciprocalRankFusion` now takes labelled lists (`{ signal, results }`) and
  returns `FusedSearchResult` entries carrying `signals`, so a result can say
  whether keywords, meaning, or both ranked it. `buildMatchSignals` resolves
  those to entity ids the same way the grid does (claims fold into their owning
  entity, the type filter applies), and `library-entities.tsx` renders a text
  badge — "Keyword", "Meaning", "Keyword + meaning" — in both the card and the
  table row. Text, not colour, so the distinction survives greyscale.
- **Evaluation harness (proposal 2, #1065).** `src/lib/search/eval/metrics.ts`
  implements recall@k and MRR over ranked id lists, and
  `eval/harness.test.ts` scores BM25, a deterministic concept-overlap ranker
  (`eval/concept-ranker.ts`, standing in for the ONNX model the unit suite
  cannot load), and their fusion on one fixture corpus. The fixture gives each
  single mode a query the other cannot answer — a paraphrase with no shared
  content token, and a literal identifier outside the concept space — so the
  harness asserts `hybrid >= max(lexical, semantic)` on both metrics and strictly
  beats lexical-only. Metrics are deterministic, so this is a regular test, not a
  timing baseline: no new CI job and no sampling noise.

  Measured on the committed fixture (5 labelled queries, `k = 5`):

  | Strategy | recall@5 | MRR |
  | --- | ---: | ---: |
  | lexical (BM25) | 0.800 | 0.800 |
  | semantic (concept ranker) | 0.800 | 0.800 |
  | hybrid (RRF) | **1.000** | **1.000** |

  Each single mode misses exactly the query the other answers, so fusion recovers
  the only remaining gap. These are fixture numbers on a five-query control set,
  not a claim about real-corpus retrieval quality; the fixture exists to catch a
  fusion regression, and the real corpus is the follow-up in #1065.
- **Real benchmark measurements (proposal 8).** The earlier note claimed the
  repository's `bench()` blocks never execute. A `grep -c "bench("` over all
  eight `*.bench.test.ts` files returns **0** — there were no `bench()` blocks to
  be inert. Those files are `it()` guards, and the baseline covers them
  correctly. The actual gap was that nothing in the tree measured anything under
  bench mode. `src/lib/search/fusion.bench.ts` now holds two `bench()` blocks for
  reciprocal rank fusion, run by `pnpm run bench:measure` and by an added step in
  `bench.yml`; `plans/perf-baselines.md` carries the correction. Measured here:
  53,574 hz fusing two disjoint 100-item rankings, 66,119 hz for the
  half-overlapping case (mean 0.0187 ms / 0.0151 ms). The measurements are an
  artifact, not a gate: one shared-runner sample cannot distinguish a regression
  from noise.

## Third follow-up round (2026-11-01)

- **Real-corpus evaluation, and what it found.** `eval/seed-corpus.test.ts`
  scores the shipped seed library with the same metrics and the same strategy
  code as the fixture (`eval/strategies.ts` is now shared by both, so the two
  harnesses cannot diverge). Measured: **lexical 1.000 / 1.000, concept
  stand-in 0.000 / 0.000, hybrid 1.000 / 1.000** (recall@5 / MRR, 8 authored
  labels over 8 entities).

  Two findings, both useful:

  1. BM25 already answers every labelled query on this corpus, so a real-corpus
     semantic gain cannot be demonstrated with this label set. The test asserts
     the regression property that *does* hold rather than inventing a number:
     fusion must not lose a hit BM25 found (a fusion that discarded the lexical
     ranking would drop hybrid to 0.000 here).
  2. The concept stand-in scores 0.000 on real prose — its vocabulary is tuned
     to the synthetic fixture and does not generalise. That is the harness's own
     limit surfacing, and it is recorded rather than patched by widening the
     table until the number improves. Real-corpus semantic numbers need the
     actual embedding model; that stays open under #1065.
- **Hybrid retrieval reaches the assistant.** `chat-slice.ts` uses
  `searchSemantic` when the semantic search toggle is on and the worker-backed
  BM25 path otherwise, so the fused ranking only pays a model download for users
  who asked for it. `context.ts` gained a `retrieval: 'lexical' | 'hybrid'`
  option (default `lexical`) on the async builder, and the AI harness passes
  `hybrid` when the same toggle is on — dashed through `use-ai-harness-chat` and
  `ai-harness-view`. Every failure path is unchanged: `semanticSearch` falls back
  to BM25 internally with a surfaced reason, and the chat slice's synchronous
  fallback still answers if the async path rejects.
- **Lessons recorded.** `agents-docs/LESSONS.md` LESSON-055 (a documented
  finding is a hypothesis until a command proves it — the `bench()` case) and
  LESSON-056 (Codacy reads `<placeholder>` in CLI usage text as an HTML tag).

## Excluded by this triage

SQLCipher and Argon2id at rest, `sqlite-vec`, `y-websocket` relay transport, FTS5
external-content tables and column weights, a `node:fs` plugin loader with
`worker_threads` sandboxing, and OpenAPI/Swagger documentation. Each either
targets a subsystem this build does not have or contradicts the local-first,
no-required-backend rule.

## Verification

- Read `package.json` (no SQLite-family dependency; `yjs`, `y-webrtc`,
  `y-indexeddb`, `@huggingface/transformers` present).
- Read `src/lib/search/retrieval.ts` (BM25, `bm25Score` at line 245),
  `src/lib/search/vector-store.ts` (`semanticSearch` at line 447, lexical only as
  failure fallback).
- Read `src/lib/sync/{doc,security}.ts`, `src/lib/studio/entity-types.ts`,
  `src/lib/backup/archive-crypto.ts`, `src/lib/export/encrypt.ts`.
- Searched `.github/workflows/` for benchmark invocations: only a Jules
  issue-generation script mentions benchmarks; none runs `test:bench`.
- `node scripts/check-doc-consistency.mjs` scope confirmed: it scans `README.md`,
  `plans/ARCHITECTURE.md`, `plans/GOAL.md`, `plans/PHASES.md`, not this file.

Follow-up verification (2026-10-31):

- Focused Vitest run green — 49 tests across `fusion.test.ts`, `vector-store.test.ts`,
  `vector-store-incremental.test.ts`, `search-worker.test.ts`, and
  `library-view-semantic-search.test.tsx`.
- The fusion integration test was verified by defect injection: removing the
  lexical list from the fusion call made it fail with `['triz-a','triz-b']`
  instead of `['triz-a','triz-c']`; restoring the list made it pass.
- `pnpm typecheck`, `pnpm typecheck:test`, ESLint on every touched source,
  `markdownlint`, and `pnpm run docs:check` all exit 0. `bench.yml` parses and
  has no line over 120 characters; yamllint/actionlint were not available
  locally and run in CI.

Second follow-up round (2026-10-31):

- Focused Vitest: **76 passed** across `fusion.test.ts`, `vector-store.test.ts`,
  `vector-store-incremental.test.ts`, `search-worker.test.ts`,
  `eval/harness.test.ts`, `library-view-semantic-search.test.tsx`, and
  `library-view.test.tsx`.
- Harness output on the committed fixture: lexical 0.800 / 0.800, semantic
  0.800 / 0.800, hybrid 1.000 / 1.000 (recall@5 / MRR).
- `pnpm run bench:measure` executes both `bench()` blocks — the command that
  previously matched no files. `pnpm run test:bench` (guards) is unchanged.
- `pnpm typecheck` and `pnpm typecheck:test`: exit 0, after narrowing the
  `SemanticSearchOutcome` union before reading per-hit `signals`.
- ESLint on every touched file, `markdownlint`, `pnpm run docs:check`, and YAML
  parse + line length: exit 0.
