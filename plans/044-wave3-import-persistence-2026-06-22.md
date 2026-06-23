# Plan 044 — Wave 3 Import Persistence (C1, C2)

**Date**: 2026-06-22
**Branch**: `feat/wave3-import-persistence`
**Parent Plan**: `042-goap-master-implementation-2026-06-22.md` (G-IMPORT: C1, C2)
**Goal**: Make CLI and browser import commands persist data transactionally, reindex FTS/Orama, and surface a usable browser UI.

## Findings

### C1 — CLI import does not persist

`cli/commands/export.ts:registerImportCommand` (lines 167–272):
- It builds a list of `{ sql, bind }` statements but invokes them via raw `db.transaction` and `db.prepare` casts. The `SQLiteDB.transaction` API takes an *array of statements*, not a function-returning-function. The call `txnFn(() => { ... })()` is a type error masked by `as unknown as ...` casts. Combined with the `child_process.exec` import (dead code) and the bespoke lock file, this is fragile and does not reliably persist.
- It bypasses the `repository` abstraction every other CLI command uses (`repository.createEntity`, `repository.createNote`, `repository.createClaim`).
- The `--dry-run` branch parses twice (once for SQL, once for the summary) and never logs the planned actions.
- The `--reindex` branch re-implements FTS rebuild inline; the project already exposes `hydrateFts5Index()` in `src/lib/search/fts5-hydrator.ts:4`.

### C2 — Browser import UI is thin and non-atomic

`src/features/export/ExportPanel.tsx` `handleImport` (lines 29–112):
- Single file input only; no drag-and-drop, no preview, no progress, no OPML.
- Writes one item at a time via `repository.createX` calls; no transaction.
- Never reindexes FTS5 or Orama after import.
- "Import Knowledge" lives in a corner of the Export panel; the task asks for a dedicated import experience.

## Plan

### C1 (CLI)
- Replace raw SQL bypass with the `repository` abstraction.
- Wrap the entire import in `repository.transaction([...statements])` so it is atomic.
- Resolve notes/claims' `entity_id` by entity **name** (not UUID), since exports use one DB's UUIDs and the target DB has its own.
- Add a small OPML parser for `.opml` files (CLI flag `--opml`).
- Use the existing `hydrateFts5Index` helper for `--reindex`.
- Keep `--dry-run` and `--reindex` flags. Dry-run prints a human-readable summary and writes nothing.

### C2 (Browser)
- New file `src/features/import/ImportPanel.tsx` (~250 LOC): file picker + drag-and-drop zone + preview list + import button + progress.
- Keep `ExportPanel.tsx` for export only; the new `ImportPanel` owns the import experience.
- Supports `.json`, `.md`, and `.opml`.
- All writes go through `repository.transaction` (atomic) and use the `repository` helpers.
- After import: reindex FTS5 via `hydrateFts5Index()` and trigger Orama refresh via `jobCoordinator.enqueue('refresh-search-index')`.
- Wire `ImportPanel` into the existing export route as a sibling tab.
- Preserve existing tests in `src/features/export/__tests__/ExportPanel.test.tsx` (ExportPanel still renders export buttons).

### Tests
- Add `src/features/import/__tests__/ImportPanel.test.tsx` (render, file picker, drag-and-drop, error handling).
- Add `src/lib/__tests__/import-persistence.test.ts` for the round-trip: export → import → count matches.
- Keep `cli/__tests__/commands.test.ts` (already covers command registration).

### Quality
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- No `biome.json` or eslint config changes.
- Strict TypeScript, no `any`, files < 500 LOC.

## Acceptance

- `pnpm run typecheck` passes
- `pnpm run lint` passes
- `pnpm run test` passes
- `pnpm run build` passes
- Files < 500 LOC
- Round-trip export → CLI import → entity count matches.
- Browser import panel renders, supports drag-and-drop, and shows progress.
