# ADR 045: Sync Threat Model and Room Membership

**Status**: Implemented (Issue #1035)
**Applies to**: `y-webrtc` 10.3.0 as installed in this repository.

## Context

The Sync view offers password-based WebRTC rooms. Encryption is only a useful
control if users know what it protects and what it does not.

## What the installed provider does

| Channel / data | Protection with a room password |
|---|---|
| Signaling `publish` payloads (announce, offer, answer, ICE candidates, peer ids) | AES-256-GCM; the base64 ciphertext is the `data` field |
| BroadcastChannel messages | AES-256-GCM |
| WebRTC data-channel Yjs/awareness payloads | DTLS transport; **no additional AES-GCM layer** from y-webrtc |
| Room topic on the signaling server | Visible (needed to route) |
| Connection timing, message sizes, peer IP addresses | Visible to signaling / peers |

The key is `PBKDF2-HMAC-SHA256(password, salt = UTF-8 room name, 100000
iterations)` → AES-256-GCM 256-bit key, random 12-byte IV per encryption. The
room name is part of both the topic and the salt, so the same password in two
rooms yields different keys.

## Trust boundaries

- `y-webrtc` password encryption is **room membership**, not peer identity or
  attestation. Anyone who knows the room id and password can join and modify the
  replicated document.
- A joining peer cannot prove it is the intended device. The app exposes a room
  key fingerprint so users can compare out-of-band and detect a password typo;
  it does not authenticate a person or device.
- The signaling service sees metadata even when payloads are encrypted. IP
  addresses are exposed by WebRTC to peers and to the signaling connection.
- Wrong-password peers cannot decrypt signaling payloads and therefore cannot
  establish a data-channel connection. There is no authenticated failure signal;
  the room simply stays without peers.
- Replay is not prevented at the transport layer. Yjs updates are idempotent, and
  causal clocks/tombstones resolve stale writes; there is no server nonce
  registry.

## Invitations and revocation

- Room ids use 128 bits of `crypto.getRandomValues` entropy (22 URL-safe chars).
- Invite tokens contain only `roomId`, `createdAt`, `expiresAt`. Expiry is
  enforced at join time.
- Passwords and derived keys never appear in QR codes, URLs, logs, analytics, or
  persisted room state.
- The protocol has no room deletion or server-side revocation. The supported
  rotation is: leave the room, create a new random room id, and share the new
  password separately. Treat a leaked room id + password as membership for as
  long as that room is used.

## Non-goals

- Hiding the room topic or connection metadata from signaling.
- Authenticating peers, devices, or accounts.
- Protecting against a compromised endpoint or a peer that was legitimately
  admitted.
