# Plan 188: Verifiable Portable Backup (#1040)

**Status**: Implemented.

## Problem

Existing exports produced files, but no portable contract proved integrity,
exposed what the archive contained before restore, or made restore atomic.

## Archive contract

- Single UTF-8 JSON `.dksb` envelope (`format:
  do-knowledge-studio-backup`, `formatVersion: 1`).
- Files: `data/entities.json`, `data/claims.json`, `data/canvas.json`.
- Manifest records format/schema versions, app version, export timestamp,
  per-record counts, and a SHA-256 + byte-length inventory for every file.
- Optional passphrase encrypts the entire `{ manifest, files }` payload with
  PBKDF2-HMAC-SHA256 (310,000 iterations, random 16-byte salt) +
  AES-256-GCM (random 12-byte IV, 128-bit tag, AAD binds format/version/KDF).
- The outer ciphertext SHA-256 is verified before decryption.
- Checksums detect corruption in transparent archives; they are not a signature.
  Authenticity against a malicious editor requires the encrypted (authenticated)
  form or an external hash kept elsewhere. The UI says "integrity", not
  "authenticity".
- Verification order: envelope schema -> version policy -> file inventory ->
  payload checksums -> payload Zod schema -> counts -> ids/references. Any
  failure returns a structured code and never touches the store.
- Restore preview reports duplicates, warnings, counts and integrity. Modes:
  `replace` or `merge`; merge duplicate policy `skip` (default) or `overwrite`.
- Composition uses `importWithRollback`, preserving the existing atomic swap and
  recovery snapshot.
- Format/schema newer than the build is rejected; schema older than the minimum
  (1) is rejected; older supported schema is accepted with a warning.

## UI

Export → *Verifiable backup*: optional passphrase download; file picker restore;
passphrase retry; preview dialog with integrity, counts, warnings, replace/merge,
duplicate policy, and explicit confirmation.

## Tests

- `archive.test.ts`: unencrypted/encrypted round-trip, wrong/missing passphrase,
  tampered payload/manifest, truncation, future format/schema, older supported
  schema warning, duplicate ids, dangling references, incomplete inventory,
  replace/merge skip/merge overwrite composition.
- E2E and component UI tests cover the panel and preview where the existing
  suite permits; no passphrase is persisted or logged.
