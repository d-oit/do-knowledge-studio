# ADR 055: File-based sync bundle

**Status**: Accepted
**Date**: 2026-11-14
**Issue**: #1133 (completes the file fallback promised in #1052)

## Context

Peer-to-peer sync needs WebRTC signaling. On networks that block it, the
diagnostics panel already reports `recommendFileFallback: true`, but there was
nothing to offer: the only file path was a full backup/restore, which replaces
the library instead of merging it.

## Decision

Add a portable **sync bundle** (`.dksb`) that carries entities and claims and is
merged with the same conflict-aware logic the room join uses.

### Format

```json
{
  "format": "dks-sync-bundle",
  "version": 1,
  "roomId": "room-alpha",
  "createdAt": "2026-11-14T12:00:00.000Z",
  "encrypted": false,
  "entities": [],
  "claims": []
}
```

An encrypted bundle replaces `entities`/`claims` with
`"encrypted": true, "envelope": { v, alg, iv, data }` from
`encryptRoomPayload`. The header stays readable so a user can tell which room a
file belongs to.

### Rules

- **Header is bound to the ciphertext.** The room id is AES-GCM additional data,
  so a tampered header fails to decrypt instead of merging into the wrong room.
- **Import merges, never replaces.** `mergeSyncBundle` runs `mergeEntities` /
  `mergeClaims` with the local corpus as the base, then `commitMergedState`
  writes the result and pushes one history entry.
- **Idempotent.** Records match by id and resolve by timestamp, so importing the
  same file twice is a no-op.
- **Bounded.** `MAX_SYNC_BUNDLE_BYTES` (32 MiB) is checked before parsing.
- **Validated.** Every record passes `validateInboundEntity` /
  `validateInboundClaim`; a single invalid record rejects the bundle.
- **Conflicts surface.** Field disagreements go to the existing conflict UI, the
  same as a room join.

## Consequences

- Two devices can sync without any network path between them.
- The bundle is not a backup: it carries no graph, mind-map, tag or revision
  data. Use the backup archive for that.
- Attachments are out of scope until the blob store lands (#1135); the format
  can add an `attachments` array in a later version.
- Large corpora produce large files; chunked/QR transfer is a later option.

## Files

- `src/lib/sync/file-bundle.ts` — build, parse, merge
- `src/components/studio/views/sync-file-panel.tsx` — export/import UI
- `src/lib/i18n/messages/sync.ts` — `syncFile.*` messages
