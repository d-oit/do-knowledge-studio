# ADR 038 — Cross-Tab Sync Session Tombstones

**Date**: 2026-09-08
**Status**: Implemented (session-scoped); durable variant deferred
**Related**: ADR 028, Plan 134 F4, Plan 135, PR #758

## Context

Cross-tab store coordination (PR #758, Plan 134 F4) propagates deletions over
BroadcastChannel through per-message deleted-id lists. The window `storage`
fallback path carries no tombstones — an absent id is indistinguishable from one
never seen — so a tab holding a deleted item could resurrect it in the deleting
tab via a stale snapshot:

1. Tab A deletes `ent-a`, writes localStorage without it, broadcasts D.
2. Tab B still holds `ent-a` and processes A's storage snapshot first; its next
   persist write includes `ent-a`.
3. A receives B's snapshot, union-merges `ent-a` back (no tombstone), and D is
   already spent. Tabs permanently diverge: A keeps `ent-a` forever.

The receive path also proved unable to distinguish a cleared canvas field
(`undefined`) from an omitted one after Zod sanitization, so reset/import clears
never reached other tabs.

## Decision

### 1. Session-scoped tombstone registry (implemented)

New module `src/lib/studio/cross-tab-tombstones.ts`:

- Records every deletion observed — locally (from the store subscription diff)
  or remotely (from BroadcastChannel message metadata) — as `id → deletion time`
  in two namespace maps (`entity`, `claim`).
- `mergeCorpus` applies the registry to **both** merge sides with per-id
  timestamps: an item whose id is tombstoned is dropped unless its `updatedAt`
  is later than the tombstone (re-creation arbitration).
- Every inbound path — BroadcastChannel and `storage` events — runs through the
  aggregated registry, so a stale snapshot cannot re-enter deleted items from
  either transport.
- Canvas fields use an explicit `null` "cleared" sentinel in the persisted
  envelope (`.nullable().optional()` in `PersistedEnvelopeSchema`), normalized
  back to `undefined` at the store boundary by `normalizeCanvasNulls`. Deletions
  also cascade: claims whose entity was deleted are dropped, and surviving
  entities have `links` targeting deleted entities removed (matching local
  `deleteEntity`, ADR 028).

Registry lifecycle is session-scoped: `stopCrossTabSync()` clears it.

### 2. Durable envelope tombstones (deferred)

The session registry does not survive tab reopen. If the session ends between a
cross-tab deletion and another tab's reopen, hydration loads the last persisted
union and can still resurrect the item.

Alternative (evaluated, not implemented): persist tombstone lists in the
persistence envelope (`deletedEntityIds`/`deletedClaimIds` on
`partializePersistedState` + `PersistedEnvelopeSchema`, migration-friendly
optional keys). Trade-off: the envelope grows with deletion history, schema
migration for existing envelopes, and the tombstone semantics become durable
across sessions. Not worth it for the local-first single-user flow until
multi-user sync (Yjs/WebRTC, ADR 026/027) needs it.

## Consequences

- Deletions are safe across both transports within a session; recreation
  (newer `updatedAt`) always wins.
- Memory: registry grows with the number of distinct deletions in a session —
  bounded by corpus churn in practice; cleared on teardown.
- Reopened tabs can still resurrect (Section 2) — documented limitation, not a
  data-loss risk.
- Envelope format gained nullable canvas fields — backward compatible (optional
  keys), hydration normalizes `null` → `undefined`.