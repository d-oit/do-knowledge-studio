# Plan 189: Independent-Peer Multi-Device Acceptance (#1041)

**Status**: Implemented.

## Problem

Existing P2P tests opened two contexts on the same origin and asserted room
status, not data exchange. `y-webrtc` can connect same-origin tabs through
`BroadcastChannel`, so a green test did not prove WebRTC.

## Test topology

- `e2e/multi-device-sync.spec.ts` opens two Chromium contexts on
  `http://localhost:3000` and `http://127.0.0.1:3000`. Distinct origins mean
  distinct IndexedDB/localStorage/service-worker partitions and no
  BroadcastChannel shortcut.
- `playwright.config.ts` starts the installed y-webrtc signaling server on
  `127.0.0.1:4444` and points the app at it through
  `NEXT_PUBLIC_YJS_SIGNALING_SERVERS`.
- `src/lib/sync/discovery.ts` accepts plaintext `ws://` only for loopback
  hosts; remote plaintext remains rejected.
- `e2e/helpers/sync.ts` drives the real UI and reads the canonical IndexedDB
  envelope for equality checks.

## Scenarios

1. Pre-existing corpora merge on join; create on A reaches B; update on B
   reaches A.
2. A disconnected edit is persisted locally and propagates after explicit
   rejoin; a disconnected deletion becomes a tombstone and does not resurrect.
   Chromium's `setOffline` does not reliably restore WebRTC ICE state, so the
   suite models transport loss by leaving the room and re-joining; reload at the
   end compares the canonical IndexedDB corpora without depending on a live
   provider.
3. Concurrent same-field edits converge to one deterministic value with no
   duplicate records.
4. Wrong-password peers exchange no data; expired invitations are refused.
5. Optional `SYNC_STRESS=1` 1k+1k corpus with bounded time (skipped by default).

No note content or secrets are logged. Assertions use visible text or canonical
record counts.
