# Plan 19: Database Migration Framework (P2)

**GOAP Goal**: G-MIGRATE  
**Priority**: P2  
**Estimated Total Effort**: 8-12 hours  
**GitHub Issues**: #185, #186  
**ADR**: ADR-004 (Database Migration System)

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #185 | Feature | Add database migration system | HIGH |
| #186 | Feature | Add CHECK constraints and unique constraints to database schema | MEDIUM |

## Dependency
**Prerequisite**: Plan 15 (G-CONFIG) — CI must be reliable for migration tests.

## Tasks

### 19.1 Create schema_version Table
**File**: `public/db/schema.sql`  
**Issue**: #185 — No way to track applied schema versions  
**Action**:
1. Add migration tracking table to schema:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_version (
     version INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     checksum TEXT NOT NULL,
     applied_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ```
2. This table is created as part of the initial schema (migration 001)
**Effort**: 0.5h
**Validation**: `schema_version` table exists after first DB init

---

### 19.2 Create Migration Runner
**File**: `src/db/migrate.ts` (new)  
**Issue**: #185 — No automated migration system  
**Action**:
1. Create migration runner with interface:
   ```typescript
   interface Migration {
     version: number;
     name: string;
     up: string;        // SQL to apply
     down?: string;     // SQL to rollback (optional)
   }
   
   async function runMigrations(db: DbClient): Promise<MigrationResult>;
   async function rollbackLastMigration(db: DbClient): Promise<void>;
   async function migrationStatus(db: DbClient): Promise<MigrationStatus[]>;
   ```
2. Migration file convention: `public/db/migrations/NNN_name.sql`
   - Each file contains `-- UP` and optionally `-- DOWN` sections
3. Runner behavior:
   - Read all migration files, ordered by version number
   - Compare against `schema_version` table
   - Apply unapplied migrations in order
   - Compute and verify checksums to detect tampered migrations
   - On failure, roll back to last-known-good state
**Effort**: 3h
**Validation**:
- Migrations apply in order
- Re-running is idempotent
- Tampered migration file is detected

---

### 19.3 Add CHECK and UNIQUE Constraints
**File**: `public/db/migrations/002_add_constraints.sql`  
**Issue**: #186 — Schema lacks CHECK and UNIQUE constraints  
**Action**:
1. Create migration 002 with:
   ```sql
   -- UP
   ALTER TABLE entities ADD CONSTRAINT unique_entity_name UNIQUE(name);
   -- Note: SQLite ALTER TABLE limitations may require table recreation
   -- Alternative: Add constraints via CREATE TABLE with constraints in migration
   
   -- For SQLite compatibility, use:
   CREATE TABLE entities_new (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL UNIQUE,
     type TEXT NOT NULL CHECK(type IN ('person', 'organization', 'concept', 'event', 'other')),
     description TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   -- ... then copy data and swap
   ```
2. Add constraints for:
   - `entities.name`: UNIQUE
   - `entities.type`: CHECK type is valid enum value
   - `claims.entity_id`: NOT NULL + FK reference
   - `claims.confidence`: CHECK between 0 and 1
   - `links.source_id` / `links.target_id`: FK references
**Effort**: 2h
**Validation**:
- Migration applies cleanly to existing database
- Duplicate entity names are rejected at DB level
- Invalid claim confidence values are rejected

---

### 19.4 Add CLI Migration Commands
**File**: `cli/index.ts`  
**Issue**: #185 — No CLI interface for migration management  
**Action**:
1. Add CLI commands:
   ```
   do-knowledge-studio db:migrate     # Apply pending migrations
   do-knowledge-studio db:rollback    # Rollback last migration
   do-knowledge-studio db:status      # Show migration status
   do-knowledge-studio db:backup      # Create database backup
   ```
2. CLI reads migration files from `public/db/migrations/`
3. Backup command:
   - Copies SQLite file to `backups/YYYY-MM-DD_HHMMSS.db`
   - Shows backup location on success
**Effort**: 2h
**Validation**:
- `db:migrate` applies pending migrations and reports
- `db:rollback` reverts last migration
- `db:status` shows current version + applied_at timestamps
- `db:backup` creates writeable backup file

---

### 19.5 Wire Auto-Migration Into App Startup
**File**: `src/db/client.ts` or `src/db/db-worker.ts`  
**Issue**: #185 — Migrations should run automatically  
**Action**:
1. After schema execution, run `runMigrations()` automatically
2. Show progress in boot sequence:
   - "Applying database migration N..." in loading screen
   - Non-blocking: migration runs after initial render, before data load
3. On migration failure:
   - Log detailed error
   - Show user-friendly message: "Database migration failed. App may be unstable."
   - Continue loading with available data (graceful degradation)
**Effort**: 1h
**Validation**:
- Migration runs automatically on app startup
- User sees migration progress during boot
- Migration failure doesn't crash the app

---

### 19.6 Migration Tests
**Files**: `src/db/__tests__/migrate.test.ts`  
**Issue**: #185 — Migration system must be tested  
**Action**:
1. Test scenarios:
   - Clean DB: all migrations applied
   - Existing DB at version N: only N+1 applied
   - Idempotency: re-running migrations is safe
   - Rollback: last migration can be rolled back
   - Checksum: tampered migration is detected and blocked
   - Backup: backup file is created and valid
   - Fork safety: two concurrent migrations don't conflict
**Effort**: 2h
**Validation**:
- All test scenarios pass
- Migration test coverage ≥90%

---

## Completion Criteria
- [ ] `schema_version` table exists and tracks applied migrations
- [ ] Migration runner applies pending migrations in order
- [ ] CHECK/UNIQUE constraints added via migration
- [ ] CLI `db:migrate`, `db:rollback`, `db:status`, `db:backup` commands work
- [ ] Auto-migration runs on app startup without blocking UI
- [ ] Backup file created before destructive migrations
- [ ] Migration tests cover all scenarios
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint` pass
