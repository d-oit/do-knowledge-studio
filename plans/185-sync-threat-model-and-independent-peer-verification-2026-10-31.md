# Plan 185: Sync Threat Model and Independent-Peer Verification (#1035)

**Status**: Implemented.

## Problem

`y-webrtc` room passwords are reachable from the Sync view, but the protection
boundary was undocumented: which messages are encrypted, what signaling still
sees, and whether a password proves peer identity. Invitations had no entropy or
expiry contract, and room secrets had no rotation guidance.

## Decisions

- Publish `plans/ADRs/045-sync-threat-model.md` as the authoritative contract.
- Mirror the installed y-webrtc derivation in `src/lib/sync/security.ts` so the UI
  can show a room-key fingerprint. The fingerprint is explicitly labelled as
  proof of a matching password, **not** identity.
- Generate 128-bit URL-safe room ids in `src/lib/sync/invite.ts`; acceptance of
  legacy raw ids is preserved.
- Versioned invite tokens contain only `roomId`, `createdAt`, and `expiresAt`.
  Passwords and derived keys never appear in tokens, QR codes, URLs, logs, or
  component state after join.
- Expiry is enforced client-side. Revocation is leaving the room and rotating the
  room id; the signaling protocol has no server-side delete operation.
- The Sync view discloses protections, metadata exposure, membership semantics,
  and fingerprint limits.

## Tests

- `src/lib/sync/security.test.ts`: deterministic derivation, room/password
  separation, round-trip, fresh IVs, wrong password/room/corruption/version
  rejection, and Yjs duplicate-update idempotence.
- `src/lib/sync/invite.test.ts`: 128-bit entropy, round-trip, expiry, malformed
  tokens, legacy ids.
- `e2e/multi-device-sync.spec.ts`: two independent origins with mismatched
  passwords exchange no data; expired invitations are refused.

## Residual risk

Signaling metadata (room topic, timing, sizes, IP addresses) remains visible to
the signaling service. Replay is possible at the transport layer; Yjs updates are
idempotent and causal clocks, not transport replay protection, resolve conflicts.
