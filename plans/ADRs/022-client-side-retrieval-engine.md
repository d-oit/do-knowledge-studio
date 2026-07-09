# ADR 022 — Client-Side Retrieval Engine for Chat & Search

**Date**: 2026-07-09
**Status**: Proposed
**Related**: GOAP action C1; ADR 017 (chat unification), ADR 019 (AI provider)

## Context

The "Ask" chat retrieval lives in `src/lib/studio/store.ts` `sendMessage`: it
lowercases the query, strips stopwords, and scores entities by naive substring
word-overlap, then replies after `setTimeout(700)`. There is no ranked index, no
claim-level retrieval, and the library search is a separate simple filter. The
retired SPA used Orama + SQLite FTS5; neither exists in the Next.js app. `zod`
ships but is unused, so retrieved/ imported data is never validated.

## Decision

Introduce a single **in-browser retrieval engine** shared by Chat and search:

1. **Algorithm.** Build a lightweight **BM25 / TF-IDF** index over entities and
   claims (name, description, content, tags, claim statements). Keep it in
   `src/lib/search/retrieval.ts`, rebuilt from the store on data change.
2. **Ranked results.** Return scored, ranked matches with per-result snippets;
   Chat uses the top-k as grounded citations (aligns with ADR 017 "Ask" being
   local-only and offline).
3. **Augmentation source.** The same top-k feeds the ADR 019 prompt when "Augment
   with local knowledge" is enabled.
4. **Replace the fake delay.** `sendMessage` calls the engine synchronously; the
   `setTimeout` simulation is removed. Any latency shown is real (e.g. LLM call).
5. **Local-first.** No server, no network for retrieval. A WASM vector index is a
   possible future upgrade behind a new ADR; BM25/TF-IDF is the v1 baseline.
6. **Validation.** Pair with zod schemas (GOAP T4) so the index is built over
   validated `Entity`/`Claim` data.

## Consequences

- Chat citations become genuinely relevant instead of substring-lucky.
- Library search and Chat share one ranking implementation (less drift).
- Fully offline; no dependency on the retired Orama/SQLite stack.

## Alternatives Considered

1. **Re-add Orama.** Possible, but a small hand-rolled BM25 avoids a dependency
   and matches the modest dataset size (localStorage-bound).
2. **Embeddings + vector search.** Deferred: needs a model or provider call,
   which breaks the offline-only contract for the "Ask" surface.
3. **Keep substring scoring.** Rejected: poor relevance and a fake latency that
   misrepresents system behavior.
