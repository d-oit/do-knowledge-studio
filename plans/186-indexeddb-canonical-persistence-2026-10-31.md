# Plan 186: IndexedDB Canonical Persistence (#1036)

**Status**: Implemented.

## Problem

Zustand persisted the entire corpus through synchronous `localStorage`. That
store has a small quota, serializes the whole library on routine edits, and
cannot represent attachments. It was also the only copy, so a failed write could
destroy the library.

## Decision

`src/lib/studio/canonical-storage.ts` supplies a `PersistStorage<unknown>`
adapter:

- canonical `{ state, version }` envelope in IndexedDB (`dks-canonical`) via
  structured clone;
- small localStorage metadata envelope (`do-knowledge-studio-store-meta`) with
  schema version, counts, timestamp, storage engine;
- one-time atomic migration from the legacy localStorage envelope: write, read
  back, verify deep equality, write metadata, then remove the legacy live key;
- version mismatches are **not** migrated eagerly — zustand's migrate/refusal
  path decides, and a successful migrated write moves the envelope;
- migration/write failures keep the previous IDB record or the legacy bytes and
  surface a storage status; nothing falls through to a second stale copy;
- refusal writes remain blocked through `hydration-guard`;
- IndexedDB-unavailable/SSR falls back to the legacy adapter unchanged.

Zustand remains the in-memory UI store. Cross-tab coordination stays on
BroadcastChannel; the storage-event listener remains for legacy fallback only.

## Failure matrix

| Failure | Behaviour |
|---|---|
| Legacy JSON unreadable | reject hydration; keep bytes; fail closed |
| Version mismatch | leave legacy; let migrate/refuse decide |
| IDB write/read-back mismatch | keep legacy; session fallback |
| IDB quota / transaction abort | keep previous IDB record; report `write-failed` |
| IDB unavailable, legacy present | serve and write legacy for the session |
| Refused hydration | block all canonical writes |

## Verification

- `src/lib/studio/canonical-storage.test.ts`: migration, future-version
  deferral, malformed bytes, failed migration fallback, failed later write
  preserving the prior record, full reload parity, reset.
- Existing persistence/refusal/cross-tab tests stay green on the legacy adapter
  in jsdom (no IndexedDB) and are complemented by the fake-IndexedDB tests.
- `e2e/helpers/store.ts` reads the canonical record from IndexedDB; canvas and
  recovery E2E assertions use that boundary.
- Benchmark: `src/lib/studio/canonical-storage.bench.test.ts` (1k/5k/10k)
  measures legacy stringify/parse versus structured IDB write/read. Run with
  `pnpm run test:bench`. Measured on the development workstation with
  `fake-indexeddb`:

  | Records | JSON stringify | JSON parse | IDB write | IDB read |
  |---:|---:|---:|---:|---:|
  | 1k | 2.4 ms | 2.3 ms | 12.3 ms | 9.5 ms |
  | 5k | 10.2 ms | 15.6 ms | 62.1 ms | 37.1 ms |
  | 10k | 37.5 ms | 27.3 ms | 104.4 ms | 80.9 ms |

  The fake-IDB harness includes test-shim overhead; the important production
  change is transactional durability and quota headroom, not a lower wall-clock
  number on this synthetic corpus. Routine UI state still goes through the
  existing debounced store path; the metadata envelope remains small.

## Residual risk

Browser storage can be evicted. IndexedDB removes the routine whole-corpus
main-thread `JSON.stringify`, but a browser may still serialize structured
clones internally. The verified `.dksb` backup is the durable copy.
