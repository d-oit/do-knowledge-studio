# ADR 048: At-Rest Encryption of the Local Corpus

**Status**: Proposed — cryptographic prototype only; not wired into persistence.
**Related**: ADR 045 (sync threat model), ADR 046 (IndexedDB canonical
persistence), ADR 047 (verifiable backup archive), Plan 191 (triage of the
proposal that requested SQLCipher).

## Context

The canonical corpus — entities, claims, graph, mind map, links and tags — is a
plaintext structured clone in IndexedDB (`dks-canonical`). Anyone who can read
the browser profile's storage can read the corpus: a lost or shared device, a
second user of the same OS profile, a backup of the profile directory, or disk
forensics.

Encryption already exists at two boundaries, and neither protects the live store:

- Exported content can be encrypted with PBKDF2-HMAC-SHA256 (600,000 iterations)
  and AES-256-GCM (`src/lib/export/encrypt.ts`).
- Portable `.dksb` backups encrypt the whole manifest + file map with
  PBKDF2-HMAC-SHA256 (310,000 iterations) and AES-256-GCM (`ADR 047`).

An external proposal asked for SQLCipher via `better-sqlite3-multiple-ciphers`
and Argon2id key derivation. That is not applicable: there is no SQLite in this
build, and the app runs in the browser with no required backend. A native SQLite
binding cannot load there.

## Decision

**Do not encrypt the live corpus yet.** Record the design constraints now so that
if the risk is accepted, the implementation is not improvised on top of a
persistence layer that was built for plaintext.

If implemented, it must satisfy all of the following:

1. **Mechanism** — WebCrypto AES-256-GCM over the existing canonical envelope,
   with the same authenticated-header discipline as ADR 047 (version, KDF,
   iterations, salt, IV bound as AAD). No home-grown cipher.
2. **Key derivation** — PBKDF2-HMAC-SHA256 at no fewer than the export path's
   600,000 iterations, reusing the project's existing derivation code. Argon2id
   is acceptable only via a vetted WASM dependency and a separate decision;
   adding a native module is not.
3. **Key lifecycle** — the derived key exists in memory for the session only. A
   passphrase is never persisted, logged, placed in a URL, or written to
   `sessionStorage`/`localStorage`. Locking the workspace drops the key. A
   forgotten passphrase means the encrypted corpus is unrecoverable; the UI must
   state this before enabling encryption.
4. **Fail closed** — a missing key, wrong key, failed tag verification, or
   unsupported envelope version must reject hydration and block canonical
   writes, exactly as a refused hydration does today (ADR 028 §4a). It must
   never fall back to a plaintext write, and never overwrite the unreadable
   record.
5. **Scope of the plaintext surface** — the Yjs replica (`y-indexeddb`), recovery
   snapshots, quarantine copies, and derived indexes are separate stores. Each
   must be encrypted, excluded with a documented reason, or disclosed as
   plaintext. Encrypting only `dks-canonical` while leaving the Yjs replica
   readable would not protect the corpus.
6. **Derived data** — the semantic vector cache stores text and vectors. It is a
   derived cache and may be dropped on lock rather than encrypted.
7. **Migration** — switching modes is a persistence migration: write encrypted,
   read back and compare, then remove the plaintext record. Failure leaves the
   plaintext record intact; there is no intermediate state with two live copies.
8. **Recovery** — the verified `.dksb` backup remains the durable recovery path;
   an encrypted corpus must not make restore impossible.

## Options considered

| Option | Verdict |
| --- | --- |
| SQLCipher (`better-sqlite3-multiple-ciphers`) | Rejected — no SQLite, no server, native module cannot run in-browser |
| Argon2id for the live corpus | Deferred — no vetted in-browser dependency today; PBKDF2 reuse is safer |
| Encrypt individual text fields | Rejected — breaks BM25 indexing, semantic embeddings, and in-app search |
| Rely on OS full-disk encryption | Useful baseline, but not a product decision and absent on shared profiles |
| Encrypt the whole canonical envelope with WebCrypto | Chosen direction, if the risk is accepted |

## Consequences

- The default build keeps zero-friction unlock (open the app and read), which is
  a deliberate trade of confidentiality-at-rest for availability.
- If encryption ships, the workspace gains an unlock step and a real
  passphrase-loss failure mode; both need UI, copy, and e2e coverage.
- The sync transport remains encrypted by room password (ADR 045); this decision
  concerns storage only.

## Prototype (2026-10-31)

Files exist and are tested, but nothing in the app reads them:

- `src/lib/studio/at-rest-crypto.ts` — versioned AES-256-GCM envelope codec with
  PBKDF2-HMAC-SHA256 (600,000 iterations), header fields bound as AAD, and a
  discriminated decrypt result that refuses malformed, future-version, wrong-key,
  and tampered envelopes instead of throwing into a caller that might fall back.
- `src/lib/studio/at-rest-session.ts` — the default-off flag
  (`dks-at-rest-encryption`; anything but `'1'` is off) and an in-memory-only
  session key holder. A storage read failure counts as off.
- `at-rest-crypto.test.ts` covers round-trip, fresh salt/IV per envelope, wrong
  passphrase, tampered ciphertext, edited authenticated header, future version,
  malformed input, flag defaults, and the absence of key material in browser
  storage.

Not done, and required before this can be called implemented: unlock UI, wiring
into `canonical-storage.ts`, the plaintext-surface inventory (item 5), and the
browser shadow/canary evidence in the exit criteria below.

## Exit criteria before implementation

- A written threat model naming what encryption does and does not protect
  (it does not protect against XSS in the running app, or a compromised browser).
- An ADR update moving this from Proposed to Accepted, with the key lifecycle and
  the plaintext-surface inventory (item 5) settled.
- Shadow evidence: both plaintext and encrypted records readable in one session
  with identical corpus hashes, recorded in `plans/`.
- Canary evidence against a real 10k-record corpus in a real browser, including
  wrong-passphrase, interrupted migration, quota exhaustion, and restore-from-
  backup paths.
- `pnpm run test:e2e` covers unlock, refusal, and lock-through-reload.
