# Plan 106 — DeepSource Remediation, CI Fix, and Coverage (2026-08-05)

**Status**: DONE

## Goal

Resolve the failing DeepSource JavaScript analysis on main, fix the store regression introduced by the PR #610 merge, improve test coverage around recently modified code, and reconcile documentation.

## Root Cause

1. **DeepSource JS failure**: `store.ts`, `sync-helpers.tsx`, `editor-helpers.tsx`, and `triz-helpers.tsx` used top-level `export function` declarations, which DeepSource flags as JS-0067 (global scope). The `.deepsource.toml` suppression patterns exist but code-level fixes are the preferred approach.
2. **Build regression**: PR #610 (useStats optimization) rebase dropped PR #598's `graph`/`mindMap`/`links`/`tags` additions in `store.ts`, causing `Property 'graph' does not exist on type 'StudioState'` in `export-view.tsx`.

## Changes

### W1 — DeepSource JS code fixes
- `src/lib/studio/store.ts`: `restoreFromRecovery`, `useFilteredEntities`, `useStats` → `const` arrow functions; `q` → `query` (JS-C1002)
- `src/components/studio/views/sync-helpers.tsx`: `generateRoomId`, `SyncStatusCard` → `const` arrows
- `src/components/studio/views/editor-helpers.tsx`: `EditorHeader`, `EditorTags` → `const` arrows
- `src/components/studio/views/triz-helpers.tsx`: `ParamPicker`, `ContradictionChip` → `const` arrows

### W2 — Store regression fix (PR #611)
- Restored `ImportOptions`, `StudioState` graph fields, `importData`/`importWithRollback` options, `RecoverySnapshot` with graph fields, `SEED_STATE`, `partialize`, `RecoverySnapshotSchema`

### W3 — Coverage
- `src/lib/studio/store-graph.test.ts` — 7 tests (import/rollback/recovery of graph fields)
- `src/components/studio/views/sync-helpers.test.tsx` — 14 tests (status branches, QR pairing, copy)
- `src/components/studio/views/editor-helpers.test.tsx` — 13 tests (tag add/remove/dedupe, date formatting)
- `src/components/studio/views/triz-helpers.test.tsx` — 9 tests (accent variants, disabled, selection)
- `src/lib/studio/seed-data.test.ts` — 7 referential-integrity tests

### W4 — Documentation
- `plans/INDEX.md`: added sections for Plans 099, 100, 102, 103, 104, 106; renumbered duplicate Plan 104 → 107

## Quality Gates

- [x] `pnpm run lint` — 0 errors
- [x] `pnpm run typecheck` — 0 errors
- [x] `pnpm run test` — 2095 pass, 1 skip (142 files)
- [x] `pnpm run build` — success