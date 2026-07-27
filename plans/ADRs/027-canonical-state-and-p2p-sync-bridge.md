# ADR 027 — Canonical State and P2P Synchronization Bridge

**Date**: 2026-07-19  
**Status**: Implemented  
**Related**: ADR 018, ADR 026, Plan 071  
**Supersedes**: ADR 026 statements that make Yjs primary or Zustand read-only

## Context

ADR 018 establishes Zustand plus `localStorage` as the canonical local-first
persistence layer. ADR 026 later describes Yjs/IndexedDB as primary and Zustand
as a read-only view. The implementation currently follows neither complete
model:

- normal CRUD writes to Zustand only;
- joining sync copies a snapshot from Zustand into Yjs;
- no production lifecycle subscribes Yjs changes back into Zustand;
- deletions have no tombstone/version semantics;
- manual conflict choices are dismissed without being applied.

This split ownership creates false-success states and makes it unclear which
copy wins after reconnect, reload, or concurrent deletion.

## Decision

### 1. Zustand remains canonical application state

Zustand is the only state read and mutated by product features. Its validated,
versioned persisted subset remains the local source of truth. Yjs is an opt-in
replication transport and collaboration log, not a second canonical database.

This preserves ADR 018, avoids rewriting every feature around CRDT types, and
keeps the app fully useful when collaboration is disabled or unavailable.

### 2. One lifecycle owner bridges canonical state and Yjs

The sync session owns one bidirectional adapter:

```text
validated Zustand transaction
          │
          ▼
   outbound Yjs update
          │
          ▼
  WebRTC / IndexedDB replica
          │
          ▼
 validated inbound projection
          │
          ▼
atomic Zustand transaction
```

The adapter must:

1. seed an empty sync document from canonical state on first join;
2. subscribe to canonical create/update/delete operations while connected;
3. subscribe to Yjs changes and validate them before store mutation;
4. tag transaction origins to prevent echo loops;
5. commit batches atomically so history and persistence observe one change;
6. unsubscribe and release resources when the session ends.

### 3. Deletes are versioned operations

Absence is not interpreted as deletion. Entities and claims use tombstones (or
an equivalent explicit delete operation) containing record ID, deletion time,
device identity, and logical/version ordering information. Tombstones are
retained long enough for offline peers to converge and are compacted only under
a separately tested retention rule.

Concurrent edit-versus-delete behavior must be deterministic. The default is
delete-wins when the deletion is causally later; unresolved concurrent changes
are surfaced as a conflict rather than silently resurrecting data.

### 4. Conflict resolution is a canonical transaction

Manual choices are validated, applied to the merged record, persisted to
Zustand, and propagated to Yjs before the dialog reports success. Dismissal
without applying a choice does not mutate data or claim resolution.

### 5. Sync status describes canonical commit state

“Synced” means all acknowledged inbound changes passed validation and committed
to canonical state, and all local operations were submitted to the active Yjs
document. Transport connection alone is not sufficient.

## Consequences

### Positive

- Local-only behavior remains simple and independent of sync infrastructure.
- Every feature observes one application state model.
- Peer data crosses a runtime-validation boundary before persistence.
- Create, update, delete, reload, and conflict behavior can be integration
  tested deterministically.
- The false distinction between two primary stores is removed.

### Negative

- The adapter must maintain origin metadata and guard against update loops.
- Tombstones require retention and compaction policy.
- Whole-record Zustand updates cannot expose character-level collaborative
  editing; that would require a future editor-specific ADR.
- IndexedDB Yjs state is a replica and must be reconciled against the canonical
  persisted schema during upgrades.

## Alternatives Considered

1. **Make Yjs canonical and Zustand read-only.** Rejected for the current phase:
   it contradicts ADR 018 and requires broad application/store migration.
2. **Keep manual snapshot synchronization.** Rejected: it cannot provide
   ongoing collaboration and encourages false-success UI.
3. **Mirror writes independently in every store action.** Rejected: lifecycle,
   error handling, and echo prevention would be scattered across the product.
4. **Treat absence as deletion.** Rejected: offline merging resurrects deleted
   records or deletes records a peer has not received yet.

## Implementation Requirements

- Add a single sync-session bridge at the collaboration boundary.
- Reuse complete Zod record schemas for inbound peer validation.
- Add explicit canonical batch actions rather than mutating store internals.
- Define tombstone schema, ordering, retention, and compaction.
- Apply conflict selections before clearing conflict state.
- Do not add an offline queue claim until convergence and retry semantics are
  implemented.

## Verification

- Two independent documents/stores converge after create, update, and delete.
- Offline peer reconnect converges without resurrection.
- Concurrent different-field edits merge as specified.
- Edit-versus-delete follows the documented deterministic rule.
- Invalid peer records never enter canonical state.
- Manual conflict selection produces the selected field values on both peers.
- Disconnect/reconnect does not duplicate observers or operations.
- Reload restores canonical state and reconnects the replica without data loss.
