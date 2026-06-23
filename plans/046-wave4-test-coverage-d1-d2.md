# Wave 4 Test Coverage (D1, D2)

## Goal

Ship Wave 4 test tasks D1 and D2 to expand coverage of the mind map feature
and the CLI command surface.

## D1 — Mind Map Unit Tests

Existing tests (already in repo, passing):

- `src/lib/__tests__/mindmap-tree.test.ts` — covers `buildTree()` and
  `addAriaToNodes()` extracted in `src/lib/mindmap-tree.ts`.

New file:

- `src/features/mindmap/__tests__/MindMapView.test.tsx` — covers the
  `addChild` / `finishEdit` / `removeNodes` operation handlers that the
  MindMapView component wires onto the `MindElixir` bus. Each handler is
  extracted as a small module-level helper so it can be exercised against a
  mocked repository without mounting the full component (which depends on
  the `mind-elixir` DOM canvas).

Coverage target: `src/features/mindmap/` (currently 0%) → ≥ 80% statements
on the new test file's subject modules.

## D2 — CLI Tests

New files:

- `cli/__tests__/db.test.ts` — exercises `initDb`, schema creation, and
  `closeDb` against a real `better-sqlite3` file in `os.tmpdir()`. Also
  covers error paths (invalid path, lock contention, init failure).
- `cli/__tests__/commands.test.ts` — extends the existing registration
  smoke test with full command-flow coverage: every command from D2
  (`entity-create`, `entity-list`, `entity-get`, `entity-update`,
  `entity-delete`, `claim-create`, `link-create`, `note-create`,
  `search`, `db:status`, `db:migrate`, `db:rollback`, `db:reset`) is
  invoked through Commander's programmatic API against a fresh
  `better-sqlite3` database. Error paths (missing entity, invalid
  arguments, file not found, DB init failure) are covered.

CLI command files are excluded from coverage by `vitest.config.ts` (live
SQLite), so the new tests focus on behavior rather than line coverage
gates.

## Quality Gate

- `pnpm run test` — all new tests pass; pre-existing suite unchanged.
- `pnpm run typecheck` — passes.
- `pnpm run lint` — passes for new files (pre-existing failures in
  `src/features/export/ExportPanel.tsx` are out of scope).
- New tests focus on previously-untested code paths in
  `src/features/mindmap/` and `cli/`.

## Risk / Notes

- The mind map component imports `mind-elixir` which requires a DOM
  canvas. We avoid mounting the component and instead extract the three
  bus handlers into pure functions that we test in isolation.
- CLI tests require Node 18+ and `better-sqlite3` (already a dev
  dependency).
- The existing `cli/__tests__/commands.test.ts` is extended, not
  replaced, to keep its registration-smoke coverage.
