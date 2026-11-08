# Plan 200 — ICE/TURN configuration, connection diagnostics and file fallback (#1052)

**Status**: Implemented
**Issue**: #1052
**ADRs**: 045 (TURN section added), 053 (unrelated; shares the encrypted-storage pattern)

## Problem

`y-webrtc` was constructed with only its default STUN configuration, so peers
behind symmetric NAT or a strict corporate firewall could never connect, and the
Sync view could not say why. Recovery was trial and error: retry, change
password, give up.

## Scope

1. Validated ICE server configuration (STUN/TURN) with credentials stored the
   same way as AI API keys (AES-GCM, session-scoped key) and deployment defaults
   from `NEXT_PUBLIC_ICE_SERVERS`.
2. A connection diagnostics panel: signaling reachable, peers discovered, ICE
   state, selected candidate type, and a plain-language hint.
3. A file-based fallback reachable from the failure state.
4. Self-hosting documentation for signaling + coturn, and a docker-compose
   example.
5. TURN metadata exposure documented in ADR 045.

## Design

### Configuration (`src/lib/sync/ice-config.ts`)

- Shape: `{ urls: string[]; username?: string; credential?: string }`.
- `validateIceServers(input, { allowInsecureTurn })` returns a discriminated
  result. Rejections: malformed URLs, schemes other than `stun`/`stuns`/`turn`/
  `turns`, credentials inside a URL, plaintext `turn:` to a non-loopback host,
  TURN without a username+credential pair, more than 8 servers, more than 4 URLs
  per server.
- ICE URLs are parsed by hand: `stun:`/`turn:` are not WHATWG special schemes, so
  `new URL()` yields an empty hostname and would accept nonsense.
- `redactIceServers` is the only shape allowed to reach the UI or a log; it keeps
  URLs and a boolean `authenticated` flag, never the username or credential.
- `parseIceServersEnv` validates `NEXT_PUBLIC_ICE_SERVERS` and ignores invalid
  configuration with a warning instead of failing boot.

### Persistence (`src/lib/sync/ice-settings.ts`)

- IndexedDB `dks-ice-settings-db` / store `ice`, record
  `{ format, formatVersion, ciphertext }`; the whole list is encrypted, so a
  stolen copy does not even reveal which relay is used.
- The codec lives in `src/lib/studio/session-crypto.ts`, extracted from
  `ai-settings.ts`, so the two credential stores cannot drift apart.
- A new session cannot decrypt the record; `loadIceServerSettings` then returns
  the deployment defaults rather than failing. The user re-enters the credential
  in the same way they re-enter an API key.

### Provider wiring (`src/lib/sync/doc.ts`)

- `joinRoom` takes `RoomJoinOptions` (`signaling`, `password`, `iceServers`).
- `peerOpts.config.iceServers` is passed **only** when servers are configured:
  passing `peerOpts` replaces simple-peer's defaults, so the unconfigured path
  stays byte-for-byte what it was.
- Option equality includes the ICE list, so a changed relay recreates the
  provider on the next join or Re-sync.

### Diagnostics (`src/lib/sync/diagnostics.ts`)

- Reads `provider.connected`, `provider.signalingUrls` and, per peer connection,
  `iceConnectionState` plus the selected `candidate-pair` stats entry.
- `candidateType` is reported as `host` / `srflx` / `prflx` / `relay` /
  `unknown`.
- Hints: `idle`, `signaling-unreachable`, `no-peers`, `negotiating`,
  `connected-direct`, `connected-relay`, `nat-blocked`. The last two failure
  states set `recommendFileFallback`.
- `nat-blocked` is reported only when peers were discovered, so a working
  signaling path is never blamed for a media-path failure.
- Never rejects: a `getStats()` rejection during teardown still yields the ICE
  state.

### UI (`src/components/studio/views/sync-connection-panel.tsx`)

- Diagnostics rows + hint, re-read every 3 s while a room is active.
- Failure state shows the self-hosting link and "Sync via file", which switches
  to the export view where the `.dksb` archive is previewed and merged with the
  existing conflict UI — no second import path was added.
- ICE editor validates before saving, shows the issues, and never renders a
  credential.

## Verification

- `src/lib/sync/ice-config.test.ts` — schemes, plaintext TURN, credentials in a
  URL, missing credentials, limits, dedupe, redaction, env parsing.
- `src/lib/sync/ice-settings.test.ts` — round-trip, ciphertext-only at rest
  (asserts the raw record contains no URL or credential), invalid config
  rejected, new-session fallback, malformed envelope ignored.
- `src/lib/sync/doc-ice.test.ts` — `peerOpts.config.iceServers` reaches the
  provider, absent when unconfigured, provider replaced when the list changes,
  preserved across reconnect.
- `src/lib/sync/diagnostics.test.ts` — candidate mapping, every hint, relay vs
  direct, failed negotiation, stats failure.
- `src/components/studio/views/sync-connection-panel.test.tsx` — stages, blocked
  notice and file fallback, validation refusal, save, removal without exposure.
- Manual/E2E: a coturn relay is not available in CI. The E2E acceptance criterion
  is replaced by the documented manual test in `docs/sync-self-hosting.md`
  ("Verify"), which uses the diagnostics panel to confirm the candidate type. The
  **Sync via file** path is already covered by the existing `.dksb` backup E2E —
  the panel only navigates to it.

## Deliberate omissions

- No delta export for file sync: the `.dksb` archive is full-state and its
  conflict preview is the reviewed path. A delta format needs its own ADR.
- No signaling-server editor in the UI beyond what already exists: the issue asks
  to expose the list, and `getSignalingServers` already validates the env layer;
  the panel shows the hosts in use, which is what a stuck connection needs.
- No automatic relay health check: probing a TURN server from the client costs
  billed traffic and is not evidence that a relay would have been chosen.

## Code review (code-review-assistant pass)

PR [#1095](https://github.com/d-oit/do-knowledge-studio/pull/1095). Adversarial probes run:

- **Swallowed exception** — `decryptSessionValue` returns `null` on a wrong key
  (documented contract, callers fall back to deployment defaults);
  `readSelectedCandidate` logs and still reports the ICE state. No blocking change.
- **Listener/timer teardown** — `useSyncIceServers` cancels its state update in the
  effect cleanup; the IDB connection is closed on `versionchange`.
- **Unguarded index** — `samples[0]?.state` and `selectedPairs.at(-1)` are both
  optional-chained; an empty peer list yields `iceState: null`, not a throw.
- **Secret leaking into logs** — found and fixed: `parseIceServersEnv` logged the
  raw `SyntaxError`, whose message quotes a slice of the input, and that input may
  carry a TURN credential (ADR 045). It now logs the error name only.
- **Stale base** — `git merge-base --is-ancestor origin/main HEAD` holds; the diff
  of `origin/main...HEAD` shows no deletions outside the refactors described above.
- Accessibility: the dark theme failed axe on two new surfaces (destructive text on
  a red tint at 4.48:1, white on dark saffron at 2.42:1). Both now use
  `bg-background` and `text-saffron-foreground`; the sync a11y specs pass in both
  themes locally.

## Follow-ups

- Coturn container in CI behind a label-gated workflow, if relay coverage becomes
  a recurring regression source.
- TURN credential rotation in the UI once a deployment needs per-user
  credentials (currently a shared static secret).
