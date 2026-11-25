# ADR 048: At-Rest Encryption of the Local Corpus

**Status**: Accepted — implemented (2026-11-24, issue #1162).
**Related**: ADR 045 (sync threat model), ADR 046 (IndexedDB canonical
persistence), ADR 047 (verifiable backup archive), ADR 027 (canonical state and
the sync bridge as a replica), ADR 028 (fail-closed local data boundaries),
Plan 191 (triage of the SQLCipher proposal), Plan 214 (implementation record).

## Context

The canonical corpus — entities, claims, graph, mind map, links, tags and each
entity's revision history — was stored as plaintext in IndexedDB
(`dks-canonical`). Anyone who could read the browser profile's storage could
read the corpus: a lost or shared device, a second user of the same OS profile,
a backup of the profile directory, or disk forensics.

Encryption already existed at two boundaries, and neither protected the live
store:

- Exported content can be encrypted with PBKDF2-HMAC-SHA256 (600,000 iterations)
  and AES-256-GCM (`src/lib/export/encrypt.ts`).
- Portable `.dksb` backups encrypt the whole manifest + file map with
  PBKDF2-HMAC-SHA256 (310,000 iterations) and AES-256-GCM (ADR 047).

An external proposal asked for SQLCipher via `better-sqlite3-multiple-ciphers`
and Argon2id key derivation. That is not applicable: there is no SQLite in this
build, and the app runs in the browser with no required backend. A native SQLite
binding cannot load there.

## Threat model

**Protected against**

- Someone reading this browser profile's storage at rest: a stolen or shared
  device, another OS user, a copied profile directory, a backup image, disk
  forensics.
- Casual inspection of DevTools → Application → IndexedDB / localStorage while
  the workspace is locked.
- A stored record being edited to change the corpus: every envelope header field
  and body is authenticated by AES-GCM, so tampering fails closed.

**NOT protected against — stated in the UI before enabling**

- **XSS or any script running in this page while the workspace is unlocked.**
  Malicious first-party or injected script can read the in-memory corpus, the
  passphrase as it is typed, and the derived key. At-rest encryption is not
  end-to-end confidentiality against a compromised running browser.
- A compromised browser, extension with page access, or OS-level keylogger.
- An attacker who knows the passphrase.
- Traffic analysis of storage sizes and record counts.
- The already-exported files a user created (`.json`, `.md`, `.html`, `.dksb`),
  which are governed by the export options, not by this decision.
- Memory contents after lock: WebCrypto keys are non-extractable, but a browser
  cannot zero JavaScript heap allocations on demand.

**Decision**: encryption is **optional per workspace, default off**. A local-first
notebook must open without a gate on first use; requiring a passphrase before
anything can be typed would make the default install unusable and would make a
forgotten passphrase look like data loss to a first-time user.

## Plaintext-surface inventory

Every surface that can hold corpus text, and what happens to it (item 5 of the
original decision):

| # | Surface | Location | Treatment | Rationale |
| --- | --- | --- | --- | --- |
| 1 | Canonical corpus envelope | IndexedDB `dks-canonical` / `state` | **Encrypted** — AES-256-GCM envelope, header bound as AAD | The primary store; this is the decision |
| 2 | Per-entity revision history | IndexedDB `dks-canonical` / `revisions` | **Encrypted body**; `id`, `entityId`, `createdAt`, `bytes` stay in the clear | The two indexes and byte eviction are built on those fields; they reveal that a revision exists and when, never its content |
| 3 | Legacy localStorage envelope (`do-knowledge-studio-store`) and its pre-IndexedDB rollback copy | localStorage | **Deleted after a verified encrypted write**; never read while encryption is enabled | Exists only before the one-time migration to IndexedDB |
| 4 | Pre-import recovery snapshot (`do-knowledge-studio-recovery[-immediate]`) | localStorage | **Excluded, disclosed, suppressed** — purged on enable, refused on read and write while enabled | It is a synchronous localStorage surface, so it cannot be encrypted without making the import path asynchronous; the durable recovery route is the encrypted `.dksb` backup, and the import toast says no backup was kept |
| 5 | Quarantine copy of a refused envelope | localStorage | **Ciphertext only** — a plaintext payload is refused rather than copied aside | A plaintext quarantine would be a fully readable corpus outside the encrypted store |
| 6 | Editor drafts (`draft:*`) | localStorage | **Excluded, disclosed, suppressed** — purged on enable, saves and loads refused while enabled | Synchronous editor path; the in-editor draft still works, only crash recovery across a reload is off |
| 7 | Yjs replica (`dks-sync`, `y-indexeddb`) | IndexedDB | **Excluded, purged on enable, not created while enabled** | `y-indexeddb` writes the whole document as plaintext; deleting a replica loses no note (ADR 027) |
| 8 | Semantic index cache and in-memory vectors | IndexedDB `dks-semantic-cache`, JS heap | **Dropped on lock**, never encrypted | Derived data, rebuildable from the corpus; item 6 of the original decision |
| 9 | Embedding-model cache | Cache Storage | **Excluded** | Model weights and tokenizer files; no corpus text |
| 10 | Storage metadata envelope (`do-knowledge-studio-store-meta`) | localStorage | **Disclosed plaintext** — counts and timestamps only | Needed before a key exists, to tell a prior store from a fresh install; no note text |
| 11 | At-rest flag (`dks-at-rest-encryption`) and public salt (`dks-at-rest-salt`) | localStorage | **Plaintext by design** | A flag and a KDF salt are not secrets; the key is derived from them plus the passphrase |
| 12 | Sync transport | WebRTC (`y-webrtc`) | **Out of scope**, unchanged | Already encrypted by the room password (ADR 045) |

## Key lifecycle (item 3)

- The passphrase is a function argument. It is never written to localStorage,
  sessionStorage, IndexedDB, a URL, a log line, or the DOM after submit.
- PBKDF2-HMAC-SHA256 at **600,000 iterations** derives a non-extractable
  AES-256-GCM key. The iteration count matches the export path and is enforced
  on read: a lower count is refused, not accepted.
- The salt is 16 random bytes, generated when encryption is enabled, stored in
  the clear (it is KDF input, not key material) and also carried in every
  envelope header so an interrupted setup can be finished.
- The derived key exists **in module memory for the session only**. A reload
  comes up locked.
- Locking drops the key and the derived semantic caches (including the model
  embedding instance and the semantic-cache record).
- **Passphrase loss is irreversible by design.** There is no recovery key, no
  escrow, and no hint. The UI states this before enabling, and points at an
  encrypted backup as the recovery route. The only paths back are: the right
  passphrase, a backup made under a known passphrase, or a plaintext copy the
  user made before enabling.

## Fail-closed rules (item 4)

| Condition | Behaviour |
| --- | --- |
| Encryption enabled, no key (locked) | Reads return `null` without touching the record; writes are dropped with one warning; no plaintext fallback, no refusal latched, so an unlock in the same page can rehydrate |
| Wrong passphrase | Verification happens before the key is installed; unlock is refused and nothing is read, written or marked refused |
| Tampered ciphertext or edited header | GCM tag fails → the record is refused, preserved verbatim, copied to quarantine **as ciphertext**, and writes latch off for the page |
| Unsupported envelope version / KDF params | Refused with a distinct reason; never guessed, never rewritten |
| Decrypted payload is not `{ state, version }` | Refused as a shape error |
| Plaintext record while encryption is enabled | Refused: not hydrated, not rewritten, not quarantined as readable data |
| Revision record that cannot be decrypted | Skipped for that read (one damaged revision must not hide the rest), never deleted |

Every refusal leaves the stored bytes untouched. Nothing in the encrypted path
ever writes a plaintext fallback.

## Migration (item 7)

Enable, in order:

1. Validate passphrase (≥ 12 characters, confirmation match).
2. If the stored record is already an envelope — an interrupted setup — finish it
   with the same passphrase instead of overwriting the ciphertext.
3. Derive a key from a fresh salt and install it in memory.
4. Write the encrypted canonical record. The adapter reads it back, decrypts it,
   compares it structurally, and **only then** removes the plaintext legacy keys.
5. Compare the SHA-256 corpus fingerprint before and after: a change aborts the
   migration.
6. Encrypt revision history: each ciphertext is verified in memory, then all
   records are replaced in one transaction; read-back is verified and the
   plaintext history restored on any mismatch.
7. Purge the plaintext side surfaces (Yjs replica, editor drafts, recovery
   snapshot, quarantine).
8. Persist the salt and the enable flag — last, because they are what make the
   workspace open locked on the next load.
9. On any failure: write the plaintext record back, decrypt the revisions back,
   clear the settings, drop the key, and report that the library is unchanged.

Disable runs the same steps in reverse and refuses before writing anything if a
single revision cannot be decrypted.

## Consequences

- The default build still has zero-friction unlock (open the app and read). The
  trade is deliberate: confidentiality-at-rest is opt-in.
- An encrypted workspace gains an unlock step, a real passphrase-loss failure
  mode, and a lock screen that is the only way to open the library in that tab.
- Locked is not empty: the store holds no corpus, so the shell shows the unlock
  gate rather than a demo library behind it.
- Editor draft recovery and pre-import recovery snapshots are unavailable while
  encryption is on (inventory rows 4 and 6). Both are disclosed in Settings.
- The sync replica is not persisted while encryption is on; collaboration still
  works for the session.
- The sync transport remains encrypted by room password (ADR 045); this decision
  concerns storage only.

## Options considered

| Option | Verdict |
| --- | --- |
| SQLCipher (`better-sqlite3-multiple-ciphers`) | Rejected — no SQLite, no server, native module cannot run in-browser |
| Argon2id for the live corpus | Deferred — no vetted in-browser dependency; PBKDF2 reuse at the export path's 600k iterations is the reviewed choice |
| Encrypt individual text fields | Rejected — breaks BM25 indexing, semantic embeddings, and in-app search |
| Rely on OS full-disk encryption | Useful baseline, but not a product decision and absent on shared profiles |
| Mandatory encryption | Rejected — first-run gate, unrecoverable typo, and no benefit for users who never share a device |
| Encrypt the whole canonical envelope with WebCrypto, opt-in per workspace | **Accepted and implemented** |

## Implementation map

| Concern | File |
| --- | --- |
| Versioned AES-256-GCM envelope, AAD header, key-based codec | `src/lib/studio/at-rest-crypto.ts` |
| Flag, public salt, in-memory key, session status | `src/lib/studio/at-rest-session.ts` |
| Record encode/decode/verify and corpus fingerprint | `src/lib/studio/canonical-storage-at-rest.ts` |
| Read/write routing, locked mode, fail-closed refusal | `src/lib/studio/canonical-storage.ts` |
| Revision encryption and its transactional migration | `src/lib/studio/revision-storage.ts`, `src/lib/studio/at-rest-revisions.ts` |
| Enable / disable / unlock / lock sequence, and resuming an interrupted setup | `src/lib/studio/at-rest-workspace.ts` |
| Refusal latch release after a verified recovery | `src/lib/studio/hydration-guard.ts` |
| Settings panel and blocking lock screen | `src/components/studio/views/workspace-encryption-panel.tsx`, `workspace-lock-gate.tsx` |
| Yjs replica suppression and purge | `src/lib/sync/doc.ts` |

## Verification and what remains

Covered by unit/integration tests (`at-rest-workspace.test.ts`,
`at-rest-fail-closed.test.ts`, `at-rest-crypto.test.ts`,
`canonical-storage.test.ts`, `revision-storage.test.ts`): round-trip, fingerprint
stability, wrong passphrase, tampered ciphertext, unsupported version, plaintext
refusal, locked read/write refusal, revision encryption and lock behaviour,
disable round-trip, interrupted-setup recovery, and the absence of passphrase,
salt-as-key and note text from browser storage.

Browser-level verification (2026-11-24): `e2e/at-rest-encryption.spec.ts`
enables encryption in the running app, locks, reloads, refuses a wrong
passphrase, unlocks with the correct one, and inspects localStorage,
sessionStorage and every IndexedDB database for plaintext, the passphrase or key
material.

Durability verification (2026-11-24, `e2e/at-rest-encryption-durability.spec.ts`):
a 10,014-record corpus round-trips through encrypt → lock → reload → unlock with
the exported corpus deep-equal to the plaintext baseline; a tab killed after the
ciphertext committed recovers the same corpus on the next load; a full browser
store (`QuotaExceededError` on envelope writes) fails closed, keeps the plaintext
corpus and never sets the flag; and an encrypted `.dksb` backup restores an
unlockable workspace on a fresh browser profile. All green on `chromium` and
`desktop-xl`. Evidence and the two defects these cases found (a dropped write
reported as success, and an unresumable interrupted setup) are recorded in
`plans/214-at-rest-encryption-1162-2026-11-24.md`.

**Not yet done:**

- The at-rest specs under the WebKit projects (mobile/tablet). Environment-blocked
  here: no root, and Playwright's WebKit build needs `libjxl.so.0.8` and
  `libbacktrace.so.0`, which Ubuntu 24.04 does not ship. Left to CI.
- A security review sign-off on this ADR (wave 11).

Until the review lands, the feature is implemented, unit-verified and
browser-verified on Chromium — not field-verified.
