# ADR 046: IndexedDB Canonical Persistence

**Status**: Implemented (Issue #1036)
**Supersedes**: the storage-medium portions of ADR 028 (validation and
fail-closed semantics are unchanged).

## Context

Zustand persisted one JSON blob in `localStorage`. The medium has a small quota,
synchronous serialization, and no realistic attachment path. The corpus is also
the only copy, so a failed write could destroy it.

## Decision

- Zustand remains the in-memory UI store.
- The canonical `{ state, version }` envelope lives in IndexedDB
  (`dks-canonical`, object store `state`, key `studio-corpus`) and is written as
  a structured object, not a main-thread JSON string.
- A small localStorage metadata envelope
  (`do-knowledge-studio-store-meta`) records format/schema version, record
  counts, update time, and storage engine. Recovery snapshots and quarantine
  remain separate localStorage records.
- The legacy localStorage envelope is migrated once: parse → IDB write → IDB
  read-back deep equality → metadata write → remove legacy key. Any failure
  leaves the legacy bytes untouched and uses them for the session.
- Version-mismatched envelopes are **not** migrated eagerly. Zustand's
  migration/refusal path decides; a successful migrated write moves the
  envelope to IndexedDB.
- IndexedDB write failures keep the previous canonical transaction result; they
  do not fall through to a possibly stale localStorage copy. Refused hydration
  blocks canonical writes exactly as it blocked localStorage writes.
- IndexedDB-unavailable/SSR sessions retain the legacy/local-only behavior.
- Cross-tab synchronization remains BroadcastChannel-first. `storage` events are
  retained only for legacy-fallback compatibility and ignore the metadata key.

## Consequences

- Routine edits no longer serialize the whole corpus with `JSON.stringify` on
  the main thread. Browser structured-clone costs still exist and are measured.
- The canonical store is still browser storage and can be evicted. Durable
  recovery is the verified `.dksb` backup (ADR 047).
- A migration failure degrades to the legacy store for the session rather than
  risking data loss.
