# ADR 032: BM25 Reference Cache for Local Search

## Status

Approved — implemented in `src/lib/search/retrieval.ts` (pull requests
647, 650, and 651).

## Context

The local BM25 retrieval engine re-tokenized the entire corpus and rebuilt
its index on every query. For a knowledge studio that grows to thousands of
entities and claims, that made chat/answer flows (which call `search` per
message) progressively slower.

A naive cache keyed by content hash would be expensive to compute (hashing
is itself a full corpus scan) and fragile. The store replaces the `entities`
and `claims` array references on every mutation (immutable updates), which
gives us a cheap, reliable invalidation signal.

## Decision

Cache the derived search index keyed by **reference identity** of the input
arrays:

1. `getIndex(entities, claims)` returns the cached `{ entityMap, entries,
   avgDl }` when both references are identical to the last build, otherwise
   rebuilds and stores the new index. Any store mutation that replaces
   `entities`/`claims` therefore invalidates the cache automatically with
   zero bookkeeping.
2. `MAX_CACHE_ENTRIES = 20_000` caps the combined entity + claim entry
   count. Corpora above the cap bypass the cache entirely and rebuild per
   query, bounding worst-case memory for very large knowledge bases.
3. `resetSearchCache()` is exported so callers (store import/reset actions,
   tests) can drop the cached index explicitly — releasing memory and
   guaranteeing a true cold start.
4. Complexity discipline: helpers stay under the DeepSource JS-R1005 medium
   band (threshold 6). The cache guard plus an extracted `buildEntityMap`
   keeps `getIndex` at complexity 5.
5. The store wires `resetSearchCache()` into `importData`,
   `importWithRollback`, and `resetStore` so a workspace change releases the
   previous corpus's index memory immediately.

## Measured Behavior (2026-08-12, Node 22, tsx + --expose-gc)

| Corpus (entities / claims) | Cache retained |
|----------------------------|----------------|
| 1,000 / 3,000              | ~4.6 MB        |
| 5,000 / 15,000             | ~22.8 MB       |
| 10,000 / 30,000 (over cap) | bypassed       |
| 20,000 / 60,000 (over cap) | bypassed       |

Query time: cold rebuild 16.12 ms vs cached average 0.79 ms on 1,000
entities / 3,000 claims (~20x); PR #647 reported ~84% reduction on the
original benchmark.

## Consequences

- Repeated queries on unchanged state are ~20x faster and the cache is
  invalidated correctly by any reference-changing store mutation.
- Worst-case cache memory is bounded to ~24 MB (20,000 entries x ~1.2 KB).
- `resetSearchCache` gives tests a deterministic cold start and lets the
  perf regression guard assert hot-queries beat cold rebuilds.
- Corpora over the cap lose the cache benefit; scoring is O(n) per query
  regardless, so this only affects very large local knowledge bases.
