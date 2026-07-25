# ADR 004: Database Migration System for Schema Evolution

## Status
Superseded by ADR 028 — localStorage persistence replaces SQLite; validation boundary covers data integrity.

## Context
The current database schema is applied from `public/db/schema.sql` on every startup with no version tracking. Any schema change requires either:
- Manual SQL execution with risk of data loss, or
- Dropping and recreating the entire database

This is unsustainable as the project evolves. We need a migration system that:
- Tracks which migrations have been applied
- Automatically applies pending migrations on app startup
- Supports rollback of the last migration
- Creates backups before destructive changes
- Works in both browser (SQLite WASM) and CLI (Node.js) environments

## Decision
We will implement a **version-tracked migration system** with:

1. **`schema_version` table**: Tracks applied migrations with checksums
2. **Numbered migration files**: `001_initial.sql`, `002_add_xxx.sql`, etc.
3. **Dual runner**: Works in both SQLite WASM (browser) and `better-sqlite3` (CLI)
4. **Up-only by default**: Migrations are additive (add tables, columns, indexes)
5. **Down migrations for last N=1**: Rollback support for immediate previous migration
6. **Backup before migration**: Automatic OPFS (browser) or filesystem (CLI) backup before each destructive operation

## Alternatives Considered
- **Knex.js migrations**: Popular but Node.js-only, can't run in browser WASM context
- **Raw SQL files with manual tracking**: Works but error-prone without automated state management
- **Schema comparison (diff-based)**: Complex and fragile; explicit migrations are more predictable
- **No migration system (current state)**: Schema changes require data loss

## Implementation Plan

### 1. `schema_version` table
```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2. Migration file convention
```
public/db/migrations/
├── 001_initial.sql     -- matches current schema.sql content
├── 002_add_xxx.sql     -- future migrations
└── ...
```

### 3. Migration runner (`src/db/migrate.ts`)
- Reads migration files ordered by version number
- Computes checksum of each file
- Checks `schema_version` for already-applied versions
- Applies unapplied migrations in order
- On failure, rolls back to last-known-good state
- Returns `{ applied: number[], errors: string[] }`

### 4. CLI commands (`cli/index.ts`)
- `db:migrate` — apply pending migrations
- `db:rollback` — revert last migration
- `db:status` — show applied vs pending migrations
- `db:backup` — create a backup of the current database

### 5. Auto-migration on startup
- In `src/db/db-worker.ts` or `src/db/client.ts`, after schema execution, run pending migrations
- Non-blocking: show "Applying migration N..." in boot sequence, not blocking UI paint

## Consequences
- **Positive**: Schema evolves safely with version tracking
- **Positive**: Both browser and CLI can use the same migration files
- **Positive**: Backup-before-migration prevents data loss
- **Positive**: Automated migrations reduce manual errors
- **Negative**: Added complexity for a previously simple schema system
- **Negative**: Migration files must be carefully written (can't easily be deleted)
- **Negative**: Rollback limited to last migration (up-only is safer for production)
- **Warning**: The initial migration (001) must exactly match the current schema for existing databases

## Acceptance Criteria
- [ ] `schema_version` table exists after migration system runs
- [ ] Migration 001 (initial schema) applied on first run with existing DB
- [ ] Adding migration 002 is detected and auto-applied on next startup
- [ ] `db:migrate` CLI command applies pending migrations
- [ ] `db:rollback` reverts last migration and restores tables
- [ ] `db:status` shows current version with applied_at timestamps
- [ ] Backup file created before any migration that drops/alters tables
- [ ] Re-running migration system is idempotent (no double-apply)
- [ ] Tests verify migration up → rollback → up is data-preserving
- [ ] `npm run typecheck` and `npm test` pass
