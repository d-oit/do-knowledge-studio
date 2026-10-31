# ADR 047: Verifiable Backup Archive

**Status**: Implemented (Issue #1040)

## Context

JSON/Markdown/OKF exports are useful but do not prove integrity, expose what a
file contains before restore, or provide a safe merge. A ZIP download alone is
not a backup contract.

## Decision

A `.dksb` archive is a single UTF-8 JSON document:

```json
{
  "format": "do-knowledge-studio-backup",
  "formatVersion": 1,
  "encryption": null,
  "manifest": { "...": "version, appVersion, exportedAt, counts, files[{path,bytes,sha256}]" },
  "files": { "data/entities.json": "...", "data/claims.json": "...", "data/canvas.json": "..." },
  "ciphertext": null
}
```

- Every payload file is SHA-256 hashed and byte-counted in the manifest.
- Optional encryption wraps `{manifest, files}` as JSON in AES-256-GCM:
  - KDF: PBKDF2-HMAC-SHA256, 310,000 iterations, random 16-byte salt;
  - IV: random 12 bytes per archive;
  - AAD: canonical JSON of format, formatVersion, algorithm, kdf, iterations,
    salt, and IV;
  - the outer envelope stores salt/IV/KDF parameters and a SHA-256 of the
    ciphertext; the hash is checked before decryption.
- Verification order is envelope schema → format/schema version → file
  inventory → per-file hashes → payload Zod schema → counts → ids/references.
  Any failure returns a structured code and never calls the store.
- Restore is preview-only until the user chooses `replace` or `merge` and (for
  merge) `skip` or `overwrite` duplicate ids. The composed arrays then go
  through `importWithRollback`, preserving atomic swap and recovery snapshot.
- Newer format/schema versions are rejected. Older supported schema versions
  are accepted with a warning; versions below the minimum are rejected.

## Consequences

- A corrupted, truncated, tampered, wrong-passphrase, or future-version archive
  cannot mutate canonical state.
- Users can verify an archive offline; no service or key escrow is involved.
- Losing the passphrase loses the backup. The UI states this before download.
- The archive is JSON, not ZIP; it can be opened by any text tool while
  unencrypted, and the manifest is self-describing.
