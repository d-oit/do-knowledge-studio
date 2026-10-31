# Plan 190: Documentation Truth and Consistency Check (#1042)

**Status**: Implemented.

## Problem

Public product claims drifted from the runtime: GitHub's repository description
advertised SQLite FTS5, README described localStorage as canonical, and
architecture docs did not enumerate every view. Historical plans were useful but
occasionally read as current.

## Changes

- README: canonical IndexedDB corpus, localStorage metadata/recovery/quarantine,
  opt-in labels for sync/AI/web research, verified `.dksb` backup, data-lifecycle
  and browser-eviction limits, peer-sharing trust boundaries, numeric
  11-view heading.
- `plans/ARCHITECTURE.md`: IndexedDB persistence and migration, incremental
  semantic index/cache, sync encryption/threat model, verified backup, full view
  table, ADR index 045–047.
- `plans/GOAL.md`: current storage/export architecture.
- `plans/PHASES.md`: Vite/SQLite phases remain explicitly historical.
- Repository description: SQLite FTS5 removed (applied with `gh repo edit`).
- `scripts/check-doc-consistency.mjs` verifies README `pnpm run` names, script
  paths, view count/table vs `VIEW_IDS`, IndexedDB mentions, absence of current
  SQLite/FTS5 claims, export format inventory, optional egress labels, and
  historical SQLite labels.
- `pnpm run docs:check` runs in `scripts/quality_gate.sh`, so CI detects drift.

## Verification

```bash
node scripts/check-doc-consistency.mjs
pnpm run docs:check
```

Both must exit 0. The checker is deliberately source-derived (package.json,
`VIEW_IDS`, `FORMATS`) rather than a second hand-maintained list.
