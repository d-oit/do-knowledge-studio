# Plan 214: High-priority audit issues (#1133, #1140, #1146)

**Date**: 2026-11-14
**Status**: Implemented

## Scope

Three `priority: high` issues from the repository audit:

| Issue | Change |
|---|---|
| #1133 | File-based sync fallback (bundle export/import) |
| #1140 | CI gates that can fail: actionlint, concurrency, hygiene check |
| #1146 | Rewrite the two skills that described a different architecture |

## #1133 — Sync via file

- `src/lib/sync/file-bundle.ts`: versioned `.dksb` bundle, optional AES-GCM
  encryption bound to the room id, Zod-validated header, record validation,
  pure merge. See ADR 055.
- `src/components/studio/views/sync-file-panel.tsx`: export/import UI, wired
  into the sync view. The diagnostics "file fallback" notice now scrolls to it
  instead of navigating to the export view.
- `src/components/studio/views/sync-history-card.tsx`: extracted from
  `sync-view.tsx` to keep that file under the 500-LOC limit.
- Tests: `file-bundle.test.ts` (13), `sync-file-panel.test.tsx` (3).

## #1140 — CI

- `actionlint` no longer has `continue-on-error`; the workflow now fails on a
  real error. Verified locally with actionlint 1.7.12 (clean).
- `concurrency` added to all 11 workflows that lacked it. PR-scoped groups
  cancel in progress; `main` and scheduled runs do not.
- `scripts/check-workflow-hygiene.mjs` + `tests/check-workflow-hygiene.bats`
  enforce: annotated `continue-on-error`, concurrency on push/PR workflows, and
  top-level `permissions`. Wired into `yaml-lint.yml` and `pnpm run workflows:check`.
- Fixed the shellcheck findings actionlint surfaced (SC2016 in the SARIF
  fallback, SC2086 in the Turso sync workflow).

## #1146 — Skills

- `local-chat-policy`: rewritten around the real pipeline (Zustand + IndexedDB,
  BM25/semantic/fusion, `buildMessagesAsync`, untrusted-content isolation,
  consent before egress). No SQLite, no API.
- `validation-checklist`: rewritten around the real boundaries (rehydration,
  import, sync inbound, provider responses, OKF bundle).
- Both gained `evals/evals.json`; catalogs regenerated.

## Verification

- `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`
- `node scripts/check-workflow-hygiene.mjs`
- `actionlint` 1.7.12 with shellcheck 0.10.0
- `./scripts/validate-skills.sh`
