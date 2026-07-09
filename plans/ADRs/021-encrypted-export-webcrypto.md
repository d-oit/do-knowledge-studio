# ADR 021 — Real Encrypted Export (WebCrypto AES-GCM)

**Date**: 2026-07-09
**Status**: Proposed
**Related**: GOAP action T3; ADR 002 (security export), ADR 006 (export dedup)

## Context

`src/components/studio/views/export-view.tsx` offers an "encrypted" export whose
own code comments state:

> "Encrypted HTML export — DEMO-GRADE OBFUSCATION ONLY (NOT real encryption)."
> "… is NOT cryptographically secure — anyone with the file [can read it] …"
> "use a real crypto library (e.g. libsodium, WebCrypto AES-GCM) for production."

The password dialog and "Encrypted reader downloaded" success toast can lead
users to trust it for sensitive data. This is a security-messaging hazard. The
file is also 712 LOC (over the 500 limit).

## Decision

Replace the obfuscation with **real WebCrypto encryption**, no new dependency:

1. **Crypto.** Derive a key from the user password with **PBKDF2**
   (SHA-256, high iteration count, random salt) and encrypt the JSON payload with
   **AES-GCM** (random IV). Store salt + IV + ciphertext + KDF params in the
   output.
2. **Self-contained reader.** The exported HTML embeds a small vanilla-JS
   decryptor that prompts for the password and uses `window.crypto.subtle` to
   decrypt in the browser — fully offline, no external assets.
3. **Module split.** Extract crypto into `src/lib/export/encrypt.ts` (and the
   reader template) as part of bringing `export-view.tsx` under 500 LOC.
4. **Interim safety.** Until this lands, the "DEMO-GRADE" warnings in the UI and
   code must remain visible and must not be softened.
5. **Tests.** Round-trip unit tests (encrypt → decrypt → deep-equal) and a
   wrong-password rejection test.

## Consequences

- "Encrypted export" becomes trustworthy for genuinely sensitive data.
- No third-party crypto dependency — WebCrypto is built in and auditable.
- Reader stays offline and self-contained, consistent with local-first.

## Alternatives Considered

1. **libsodium-wasm.** Rejected for v1: extra bundle weight; WebCrypto AES-GCM +
   PBKDF2 is sufficient and native.
2. **Keep obfuscation, just relabel.** Rejected: users expect "encrypted" to mean
   encrypted; a password prompt implies real protection.
3. **Encrypt only the download, no in-file reader.** Rejected: breaks the
   "portable, openable anywhere" property of the current HTML export.
