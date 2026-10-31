# Plan 187: Incremental Semantic Index (#1037)

**Status**: Implemented.

## Problem

The semantic vector store cleared and re-embedded the whole corpus on every
change, ranked across all vectors synchronously, and kept vectors only in memory.
Large libraries paid a full rebuild for a one-note edit.

## Design

- `src/lib/search/vector-index.ts`: pure `VectorStore` with normalization,
  snapshots, memory accounting, and top-K ranking.
- `src/lib/search/vector-store.ts`:
  - deterministic document fingerprint = type + entity context + name + text;
  - SHA-256 corpus digest over sorted ids/fingerprints;
  - diff: remove deleted ids immediately; embed only changed/new docs;
  - changed vectors staged in a map and committed only after every batch
    succeeds, so cancellation/failure keeps the previous valid index;
  - bounded 32-document cooperative batches with event-loop yields;
  - 64 MiB approximate index budget (text + float vectors),
    `SEMANTIC_INDEX_MAX_BYTES`; over-budget falls back to lexical with a reason;
  - progress (`idle/loading-cache/indexing/ready/cancelled/error`) exposed
    through `semantic-progress.ts`;
  - explicit reset clears vectors, fingerprints, digest, dimensions, progress,
    and the cache.
- `src/lib/search/semantic-cache.ts`: IndexedDB (`dks-semantic-cache`) record
  accepted only when model/preprocessing fingerprint, dimensions, cache format
  version, and corpus digest match. Corrupt/mismatched records are deleted.
- Library hook renders indexing progress without blocking lexical search.

## Invariants

- A deleted id is removed before embedding starts and cannot be returned.
- A failed or cancelled build never exposes staged vectors.
- A later query after cancellation rebuilds normally (no wedged promise).
- Cache restore cannot smuggle vectors for a different model or corpus.

## Tests

- `vector-store.test.ts` (existing API/ranking/fallback).
- `vector-store-incremental.test.ts`: single-document re-embed, deletion,
  abort-then-recover, memory-budget fallback, monotonic progress.
- `semantic-cache.test.ts`: match, digest/model mismatch, corrupt-record
  deletion, explicit clear.
- `vector-store.bench.test.ts`: cold/warm/single-edit at 1k/5k/10k with fake
  embeddings (`pnpm run test:bench`). Measured on the development workstation:

  | Documents | Cold build | Warm query | Single edit |
  |---:|---:|---:|---:|
  | 1k | 59 ms | 3 ms | 28 ms |
  | 5k | 228 ms | 22 ms | 67 ms |
  | 10k | 297 ms | 22 ms | 101 ms |

  These isolate index overhead from model inference: a single edit costs one
  changed-document batch plus cache write, not a corpus rebuild.
