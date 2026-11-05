# ADR 053 — Entity revision history storage

- Status: Accepted
- Date: 2026-11-05
- Issue: #1060
- Related: Plan 199, ADR 028 (canonical storage), Plan 157 (undo history)

## Context

The only history in the product was the in-memory undo stack: a corpus snapshot
per commit, discarded on reload. A sync merge, an import, or a mistaken save
left no durable way back to an earlier note. The canonical corpus is a single
IndexedDB record (`dks-canonical`, store `state`), written atomically by Zustand
persist; localStorage carries only schema metadata and recovery copies.

Adding history to that record would make every save serialize the whole history,
turn a 1 kB note edit into a multi-megabyte write, and let a corrupt history
record take the corpus with it.

## Decision

1. **A separate object store in the same database.** `dks-canonical` moves to
   schema version 2 and gains store `revisions` (keyPath `id`, indexes
   `by-entity` and `by-created`). The canonical envelope is untouched: one
   record, one atomic write.
2. **Bounded history.** Per entity: newest 20 revisions plus one daily milestone
   for up to 14 further days, and a 4 MiB byte budget for the whole store,
   evicted oldest-first.
3. **Throttled, fail-closed capture.** Saves are captured at most once per
   5 minutes per entity; merge/import/restore events are always captured when
   the content changed. Storage errors are logged and dropped — history never
   fails a save.
4. **Restore is a corpus write.** Restoring writes through the store so it is
   undoable, and records the pre-restore text as a revision.
5. **History is local-only.** It is not part of the canonical envelope, OKF
   export, or `.dksb` backups.

## Consequences

- A save's cost is unchanged: capture is fire-and-forget and the envelope write
  does not include history.
- History survives reloads and is bounded in both count and bytes; the trade-off
  is that a revision older than the window or the budget is gone — this is
  retention, not deletion by the user.
- The two stores can drift: a corpus restored from a `.dksb` backup has no
  revisions, and revisions may reference entity ids that no longer exist. Reads
  are per entity, so orphans are inert; there is no cascade on entity delete.
- The database upgrade runs on first open after this change. It only adds a
  store, so a downgrade to a version-1 build is refused by IndexedDB rather than
  corrupting the envelope.
- A future backup-inclusion option must copy revisions explicitly and validate
  them with the same schema; nothing currently reads them as canonical data.

## Alternatives considered

- **History inside the canonical envelope**: rejected — write amplification and
  a single corruption point for the corpus.
- **A second database**: rejected — a second upgrade/blocked/version-change
  surface for no isolation benefit; the stores are independent anyway.
- **Unbounded history with user-managed clearing**: rejected — the local-first
  product has no server quota recovery, so an unbounded store would eventually
  fail every write.
- **Reusing Yjs history**: rejected — Yjs is the collaboration replica, not a
  per-note version list, and it is unavailable with sync disabled.
