# ADR 045: Sync Threat Model and Room Membership

**Status**: Implemented (Issue #1035; TURN section added by #1052)
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

## TURN relays (#1052)

A TURN relay is optional. When it carries a room, it carries the same
DTLS-protected media as a direct connection; what changes is who can observe the
connection and how it is paid for.

- The relay sees both peers' IP addresses, connection duration and traffic
  volume. It does not see document contents, and with a room password it does
  not see signaling payloads either.
- TURN credentials authorize traffic that is billed per gigabyte. They are
  stored encrypted with a session-scoped AES-GCM key (same codec as AI API
  keys), never written to localStorage, invites, QR codes, URLs, logs or
  analytics, and every displayed server list is redacted to URLs plus an
  "authenticated" flag.
- Configured URLs are validated: only `stun:`, `stuns:`, `turn:` and `turns:`
  are accepted; credentials embedded in a URL (`turn:user:pass@host`) are
  rejected because those strings reach invites and logs; plaintext `turn:` to a
  non-loopback host is refused unless the user explicitly allows it.
- Deployment defaults may arrive through `NEXT_PUBLIC_ICE_SERVERS`. Those are
  baked into the client bundle, so they are public: a shared credential is
  suitable for a self-hosted lab, not for a public deployment.
- A relay is an availability control, not an anonymity or identity control.
  Using one changes who sees connection metadata, not who can join a room.

## Non-goals

- Hiding the room topic or connection metadata from signaling.
- Authenticating peers, devices, or accounts.
- Protecting against a compromised endpoint or a peer that was legitimately
  admitted.

## XSS and exfiltration hardening (#1051)

The app stores encrypted API keys, the knowledge corpus and sync secrets
client-side, so XSS is the primary threat. The production CSP is the main
mitigation:

- `connect-src` is an explicit allowlist (`src/lib/security/csp.ts`): `self`,
  `https://openrouter.ai`, Hugging Face model hosts, `cdn.jsdelivr.net`,
  `wss://y-webrtc-eu.fly.dev`, and loopback / `*.local` for local Ollama and
  local signaling. The previous blanket `https:` / `wss:` would have let an
  injected script exfiltrate the library or a decrypted key anywhere.
- `img-src` is narrowed to `self` + model hosts + `data:` / `blob:`; remote
  tracking pixels via arbitrary `https:` images are rejected.
- `Permissions-Policy` disables camera, microphone, geolocation, payment, USB
  and serial. `Cross-Origin-Opener-Policy: same-origin-allow-popups` keeps
  OAuth/popup flows working; `CORP` is deliberately omitted because
  cross-origin model assets must remain loadable.
- Residual risks (documented, not ignored): `script-src` keeps `'unsafe-eval'`
  because `onnxruntime-web` compiles with `eval` in production (measured
  Chromium drive); dropping it ships a silently lexical fallback.
  `'unsafe-inline'` for scripts stays until Next emits nonces without breaking
  the precache/offline contract (ADR 041). `e2e/csp-violations.spec.ts` fails
  on any violation across all primary views, including offline mode.
