# Plan 184: Open Issue Remediation (2026-10-31)

**Goal**: Implement every open GitHub issue in one reviewable pull request, without
introducing a required backend or weakening the local-first fail-closed contracts.

## Issues

| Issue | Track | Plan | Primary owner |
|---|---|---|---|
| #1035 | Sync threat model, encryption contract, independent-peer verification | [185](185-sync-threat-model-and-independent-peer-verification-2026-10-31.md) | Sync |
| #1036 | Move canonical persistence from localStorage to IndexedDB with a metadata envelope | [186](186-indexeddb-canonical-persistence-2026-10-31.md) | Storage |
| #1037 | Incremental semantic index with bounded memory and deterministic invalidation | [187](187-incremental-semantic-index-2026-10-31.md) | Search |
| #1040 | Verifiable portable backup with preview, checksums, encryption, and atomic restore | [188](188-verifiable-backup-restore-2026-10-31.md) | Backup |
| #1041 | Independent-peer multi-device sync and destructive-recovery acceptance suite | [189](189-multi-device-sync-e2e-2026-10-31.md) | E2E |
| #1042 | Reconcile public docs with runtime claims and add a consistency check | [190](190-documentation-truth-2026-10-31.md) | Docs |

## Non-negotiable constraints

- **No required backend.** IndexedDB, WebCrypto, WebRTC, and the existing local
  storage boundaries stay browser-only.
- **Fail closed.** Refused hydration, quota failures, failed migrations, corrupt
  backups, and wrong-password peers must never mutate or expose canonical data.
- **One canonical corpus.** Zustand remains the in-memory UI store; Yjs remains a
  replication transport; backup archives are portable exports, not a second live
  store.
- **No secret leakage.** Room passwords, backup passphrases, API keys, note
  contents, and raw corpus data never enter URLs, logs, analytics, or QR payloads.
- **Unsupported is an error, not a guess.** Archive versions, schema versions,
  model fingerprints, and signaling transports are accepted only when the running
  build can prove compatibility.

## Delivery sequence

1. Storage boundary and migration safety (#1036).
2. Sync threat model and verification contract (#1035), in parallel with storage.
3. Incremental semantic index (#1037), independent of storage internals.
4. Backup contract and restore UI (#1040), layered on the validated store action.
5. Independent-peer E2E after the sync contract lands (#1041).
6. Documentation reconciliation and consistency check last (#1042).

Each track leaves a reproducible acceptance command in its plan. The umbrella
gate is the repository quality workflow plus the sync and backup E2E specs.
