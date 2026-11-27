# Plan 214 — At-rest encryption for the complete local workspace (#1162)

**Created**: 2026-11-24
**Issue**: [#1162](https://github.com/d-oit/do-knowledge-studio/issues/1162)
**Decision**: [ADR 048](../ADRs/048-at-rest-encryption.md) (Proposed → Accepted)
**Method**: GOAP waves, each with a falsifiable exit criterion.

## Goal

Let a user seal the local workspace with a passphrase so the stored corpus is
ciphertext at rest, without a backend, without breaking local-first defaults, and
without a path that can silently overwrite or downgrade an unreadable library.

## Waves

| Wave | Goal | Status | Exit criterion | Evidence |
| --- | --- | --- | --- | --- |
| 1 — Decision | Threat model, product decision, plaintext-surface inventory | Done | ADR 048 Accepted with all 12 surfaces assigned a treatment | `plans/ADRs/048-at-rest-encryption.md` |
| 2 — Codec | Key-based AES-256-GCM codec, header AAD, salt accessor | Done | Wrong key, tampered body, edited header, future version and malformed input all refuse without throwing into a fallback | `at-rest-crypto.test.ts` |
| 3 — Session | Flag, public salt, in-memory key, lock/unlock status | Done | Passphrase never appears in localStorage/sessionStorage; reload comes up locked | `at-rest-workspace.test.ts` |
| 4 — Canonical persistence | Encrypt on write, decrypt on read, locked mode, fail-closed refusals, verify before deleting plaintext | Done | Ciphertext stored, fingerprint identical after decryption, refusal leaves bytes untouched | `at-rest-fail-closed.test.ts`, `canonical-storage.test.ts` |
| 5 — Revision history | Encrypt revision bodies, keep index metadata, transactional migration with restore | Done | No `"entity"` text in the stored record; history readable unlocked, refused locked | `at-rest-workspace.test.ts`, `revision-storage.test.ts` |
| 6 — Side surfaces | Purge/suppress Yjs replica, drafts, recovery snapshots; ciphertext-only quarantine | Done | No plaintext note text in any localStorage value after enabling | `at-rest-workspace.test.ts` (drafts, recovery), inventory rows 4–7 |
| 7 — Lifecycle UX | Enable/disable/unlock/lock panel and blocking lock screen | Done | Irreversible-loss warning asserted in the browser; locked workspace shows the gate, not demo data | `e2e/at-rest-encryption.spec.ts` (warning + gate), `workspace-encryption-panel.tsx` |
| 8 — Real-browser shadow | Same corpus readable as plaintext and ciphertext in a real browser, identical fingerprints | Done (Chromium) | Shadow spec: all 14 seed notes and their text survive the round trip; the enable path enforces fingerprint parity in code | `e2e/at-rest-encryption.spec.ts` |
| 9 — Real-browser canary | 10k-record corpus round trip, interrupted migration, quota exhaustion, restore from backup | Done (Chromium) | Four specs on the real app; the two hostile cases were each shown failing with the behaviour inverted | `e2e/at-rest-encryption-durability.spec.ts` |
| 10 — E2E | `pnpm run test:e2e` covers unlock, refusal, lock-through-reload | Done (Chromium + WebKit in CI) | 16 specs green across `chromium` and `desktop-xl`; the nightly CI sweep runs both specs under its WebKit projects `mobile` and `tablet` (8 instances each, green on 2026-11-26), see below | See “E2E evidence” below |
| 11 — Security review | Independent review of this design and implementation | **Open** | Sign-off linked here | — |

## Acceptance checklist (issue #1162)

Every criterion from the issue, the code that implements it, and the test that
would fail if it regressed. “Browser” means the real app under Playwright; “unit”
means vitest with fake-indexeddb.

| # | Acceptance criterion | Implementation | Proof |
| --- | --- | --- | --- |
| 1 | ADR 048 accepted with threat model and full plaintext-surface inventory before shipping | `plans/ADRs/048-at-rest-encryption.md` (Status: Accepted; threat model; 12-row inventory) | `pnpm run docs:check` (document consistency) |
| 2 | No passphrase or raw key persisted or logged | `at-rest-session.ts` (key is module memory, non-extractable), passphrase only a parameter | Browser: `at-rest-encryption.spec.ts` storage audit (localStorage, sessionStorage, every IndexedDB store) ×3 points in the lifecycle; the same spec records console messages, their serialized arguments and uncaught page errors across enable, lock, wrong-passphrase refusal and unlock (after a probe proves the listener recorded output) and asserts neither passphrase appears. Unit: “never persists the passphrase or the salt as key material”. Logs: `at-rest-workspace-logging.test.ts` replaces the logger with a recorder and asserts that no call made during enable, unlock, wrong-passphrase refusal, interrupted-setup resume or a forced enable failure carries the passphrase or the derived key bytes (hex, base64, base64url, JSON array, or a `CryptoKey`); the failure case also requires the rollback log to be recorded, so an empty call list cannot pass |
| 3 | All in-scope corpus surfaces encrypted or explicitly disclosed/excluded | Canonical + revisions encrypted; drafts, recovery snapshots, Yjs replica suppressed/purged; inventory rows 4–7, 10–11 disclosed | Browser: storage audit finds the marker text nowhere; Unit: draft purge/suppression, recovery-snapshot suppression, revision encryption |
| 4 | Wrong password, tampering or version mismatch never falls back to plaintext or overwrites data | `canonical-storage-at-rest.ts` refusal reasons; `at-rest-crypto.ts` AAD/version checks | Browser: wrong passphrase spec asserts byte-identical storage. Unit: `at-rest-fail-closed.test.ts` (tamper, plaintext-while-enabled, future version) |
| 5 | Migration is recoverable and verifies ciphertext before deleting plaintext | `at-rest-workspace.ts` enable sequence (raw envelope check → decrypt → compare → fingerprint, legacy removal inside the verified adapter write); rollback path | Browser: interrupted-tab spec (resume after kill, corpus identical). Unit: interrupted-setup resume, quota fail-closed, `canonical-storage.test.ts` verify-before-delete |
| 6 | Encrypted backup restore works on a fresh browser profile | Backup panel (`.dksb` with its own passphrase) + import path | Browser: “an encrypted backup restores an unlockable workspace on a fresh profile” — new context, restore, re-seal, lock/reload/unlock |
| 7 | Real-browser corpus fingerprints match before and after migration | `corpusFingerprint` compared inside enable and asserted against the decrypted read-back | Browser: 10k spec compares the entire exported corpus (ids, names, bodies, tags) before vs after; seed-corpus shadow spec |
| 8 | Security review and user-facing recovery warning complete | Warning and disclosures in `workspace-encryption-panel.tsx` / `settings.ts` | Warning + “backup is the recovery route” asserted in the browser. **Security review is still open (wave 11)** — the only criterion without sign-off |

## Defects found and fixed in this pass

Both were found by the new hostile-condition specs, and both are pinned by a
test that was observed failing when the behaviour was inverted.

1. **A dropped encrypted write was reported as success (quota / full disk).**
   `canonicalStudioStorage.setItem` deliberately swallows storage failures, and
   `enableWorkspaceEncryption` verified the migration through
   `readCanonicalEnvelope()`, which happily decodes the *previous plaintext*
   record. A write that never landed therefore looked like a completed
   migration: the flag was set, plaintext side surfaces were purged, and the next
   load refused the plaintext record — the user was locked out. The enable path
   now reads the RAW record, requires an authenticated envelope, decrypts it and
   compares it (and its fingerprint) with the source before anything is purged or
   flagged. Inversion: accepting the old plaintext read-back made the quota spec
   fail (`no alert`, workspace marked enabled).
2. **An interrupted setup could not be resumed.** The hydration guard
   (`hasHydrated()`) ran before the resume path, so the exact state the resume
   exists for — a page that refused to hydrate an encrypted record — reported
   “The library is still loading” forever. Resuming also left the refusal latch
   on, so the page would have shown seed data and dropped every edit. The resume
   now runs before the hydration guard, rehydrates the decrypted corpus, checks
   the entity count, and only then releases the refusal latch
   (`clearHydrationRefusalForVerifiedRecovery`). Inversion: skipping the
   rehydrate made the interrupted-tab spec fail with the panel error still
   present.

## Falsifiable tests added

- `src/lib/studio/at-rest-workspace.test.ts` — lifecycle: encrypt, fingerprint
  parity, no plaintext leak, lock/unlock, wrong passphrase, minimum length and
  confirmation, interrupted-setup recovery, revision encryption, disable,
  recovery-snapshot suppression, draft purge.
- `src/lib/studio/at-rest-workspace-logging.test.ts` — the logger is replaced
  with a raw-argument recorder; every call made during enable, unlock, a
  wrong-passphrase refusal, an interrupted-setup resume and a forced enable
  failure is asserted free of the passphrase and of the derived key bytes, and
  the forced failure must appear in the recording (no vacuous pass).
- `src/lib/studio/at-rest-fail-closed.test.ts` — tampered ciphertext through the
  store's refusal path, plaintext record while enabled, future envelope version.
- Extended `at-rest-crypto.test.ts` behaviour: key-based codec shares the same
  envelope contract as the passphrase path.

Each guard was observed failing before the fix during development (the quarantine
path cached `null` instead of the ciphertext, and the store's unreadable-read
refusal reported `preserved: false` while a ciphertext copy existed); both are
now pinned by tests.

## E2E evidence (2026-11-24)

`e2e/at-rest-encryption.spec.ts` drives the real app against the dev server in
Chromium. It creates a marker note through the Editor (so no test fixture writes
the store), enables encryption from Settings, and then asserts:

| Contract | Assertion |
| --- | --- |
| Encrypted at rest | The `dks-canonical` record is `dks-at-rest-envelope`; the flag is `1`; a salt exists |
| Still readable | The marker note is listed in Library while unlocked |
| Lock survives reload | After `Lock now` + reload the unlock gate is visible and the note is NOT in the DOM |
| Reopens intact | The correct passphrase clears the gate and the note is listed again, with the record still an envelope |
| Wrong passphrase refused | An inline error appears, the gate stays, the note stays absent, and the raw record is byte-identical |
| No plaintext | localStorage, sessionStorage and **every IndexedDB database and object store** (canonical state, revisions, Yjs replica, recovery) contain no note name, no note content and no passphrase, checked while unlocked, while locked, and after unlock |
| No passphrase in logs | Console messages, their serialized arguments and uncaught page errors are recorded from page load through enable, lock, the wrong-passphrase refusal and unlock; neither the real nor the wrong passphrase may appear, and a probe line proves the listener recorded output |
| Whole corpus survives (shadow) | The app's own 14-note seed library is captured while plaintext, then after encrypt → lock → reload → unlock every note is still listed by name and the longest note's body is still in the editor |

```text
pnpm exec playwright test e2e/at-rest-encryption.spec.ts --project=chromium --project=desktop-xl
  ✓ encrypts the library, keeps it readable while unlocked, and stores no plaintext
  ✓ lock survives a reload behind the unlock gate and reopens the same library
  ✓ keeps the whole seed corpus intact across the encryption round trip
  ✓ refuses a wrong passphrase without opening or changing the workspace
  8 passed (2 projects × 4 tests)
```

The shadow spec reads the persisted plaintext corpus from the app's canonical
store before enabling, then re-reads the UI afterwards. Fingerprint parity is not
merely sampled: `at-rest-workspace.ts` compares the corpus fingerprint before and
after encrypting and refuses to finish on a mismatch, so a passing enable is
itself an integrity assertion over every field.

Durability suite (`e2e/at-rest-encryption-durability.spec.ts`), same server,
`chromium` + `desktop-xl`:

| Case | What it proves |
| --- | --- |
| 10k-record round trip | 10,014 entities written to the canonical store, encrypted, locked, reloaded and unlocked; the exported corpus is deep-equal to the pre-encryption export, and the stored bytes hold no bulk text |
| Tab killed mid-migration | Ciphertext committed, verification read suspended, tab closed. Next load finds a complete authenticated envelope (v1, PBKDF2 600k, non-trivial ciphertext), finishes setup with the same passphrase, and the full corpus matches the baseline — no half-migrated record, no seed data |
| Full browser store | Envelope writes throw `QuotaExceededError`; the panel reports “could not be stored… out of space”, no flag and no salt are written, the plaintext corpus is untouched, and a reload shows the library (never the gate) |
| Encrypted backup restore | `.dksb` download, restore into a fresh browser profile, corpus identical, then sealed with a new passphrase, locked, reloaded and unlocked |

```text
pnpm exec playwright test e2e/at-rest-encryption.spec.ts e2e/at-rest-encryption-durability.spec.ts --project=chromium --project=desktop-xl
  16 passed (2 projects × 8 specs)
```

Existing suites were re-run against the same server to confirm no interference:
`recovery-warning.spec.ts`, `crud-workflow.spec.ts` and `hydration-mismatch.spec.ts`
— 17 passed. The complete Chromium project ran too: **240 passed, 1 failed** —
`multi-device-sync.spec.ts` never reached "Peers connected". That failure is
environmental, not caused by this work: it reproduces byte-identically with
`src/lib/sync/doc.ts` reverted to the pre-change version, and the container's
WebRTC peers do not connect.

**WebKit ran in CI, not in this container.** The container has no root, and
Playwright's WebKit build needs system libraries Ubuntu 24.04 does not ship
(`libjxl.so.0.8`, `libbacktrace.so.0`); Chromium was made runnable by extracting
its dependency packages locally. The nightly four-project sweep has no such
limit and does not exclude these specs: on
[run 45813183285](https://github.com/d-oit/do-knowledge-studio/actions/runs/45813183285)
(2026-11-26) both at-rest specs ran under `mobile` (iPhone 13) and `tablet`
(iPad Pro 11) — 8 instances each — and passed. The local block is therefore
environmental, not a coverage gap; pull-request runs stay Chromium-only by design
(plans/148 §6.2, plans/149).

## Known limits and disclosure

- Recovery snapshots and editor drafts are synchronous localStorage surfaces and
  are excluded (suppressed + purged) rather than encrypted; both are disclosed in
  Settings.
- The Yjs replica is not persisted while encryption is enabled.
- Locking cannot zero the JavaScript heap; WebCrypto keys are non-extractable.
- No recovery key exists. Loss of the passphrase is irreversible, and the UI says
  so before enabling.

## Next steps

1. **Done (2026-11-26 nightly).** Both at-rest specs run under the WebKit projects
   (mobile/tablet) in the nightly CI sweep and passed there; see the E2E evidence
   above. They stay environment-blocked in this container only (no root;
   `libjxl.so.0.8` and `libbacktrace.so.0` are not shipped by Ubuntu 24.04).
2. Security review (wave 11); address findings before moving ADR 048 from
   "implemented and browser-verified on Chromium" to "field-verified".
3. A field run on a real profile with the user's own corpus, per the delivery
   lifecycle — the 10k synthetic corpus is not the same as real data.
