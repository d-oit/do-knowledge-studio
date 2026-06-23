# Database Schema

SQLite WASM + OPFS database with FTS5 full-text search. The schema is
versioned through numbered SQL files in `public/db/migrations/`; the CLI
runs them via `db:migrate` and the in-app `DbProvider` runs the same code
path on first launch.

## Entity-Relationship Diagram

```
                              ┌──────────────┐
                              │  graph_      │
                              │  snapshots   │  (standalone)
                              └──────────────┘

  ┌────────────┐ 1   N ┌──────────┐
  │  entities  │───────│  claims  │
  └────────────┘       └──────────┘
        │ 1
        │
        ├──── N ┌──────────┐
        │       │  notes   │  (entity_id nullable, SET NULL on delete)
        │       └──────────┘
        │
        ├──── N ┌──────────┐
        │       │  links   │  (source_id, target_id → entities)
        │       └──────────┘
        │
        └──── N ┌──────────────────┐
                │ entity_versions  │  (history)
                └──────────────────┘

  ┌────────────┐ N   N ┌──────────┐
  │  entities  │───────│   tags   │  via `entity_tags` join
  └────────────┘       └──────────┘

  ┌──────────────────┐
  │   web_cache      │  (URL → fetched content, standalone)
  └──────────────────┘

  ┌──────────────────┐
  │  schema_version  │  (migration ledger)
  └──────────────────┘

  FTS5 virtual tables (contentless, tokenize='porter unicode61'):
    entity_search_idx  ← name, description
    claim_search_idx   ← statement
    note_search_idx    ← content
```

## Core Tables

### `entities`

Knowledge entities — concepts, notes, people, projects. One row per item in
the knowledge base.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated v4 UUID |
| `name` | TEXT | NOT NULL, UNIQUE | Display name (case-sensitive, max 255) |
| `type` | TEXT | NOT NULL | One of `note`, `concept`, `person`, `project` (max 255) |
| `description` | TEXT | | Long-form description (max 10 000) |
| `metadata` | TEXT | | JSON-encoded key/value bag |
| `source_url` | TEXT | | Origin URL for auto-hydrated entities (max 2 048) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### `claims`

Verifiable statements attached to an entity. Cascades on entity delete.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `entity_id` | UUID | NOT NULL, FK → `entities(id)` ON DELETE CASCADE | |
| `statement` | TEXT | NOT NULL | The claim itself (max 10 000) |
| `evidence` | TEXT | | Optional evidence (max 10 000) |
| `confidence` | REAL | DEFAULT 1.0, CHECK 0 ≤ c ≤ 1 | Subjective confidence |
| `source` | TEXT | | Free-form provenance label (max 10 000) |
| `verification_status` | TEXT | DEFAULT 'unverified', CHECK ∈ {`unverified`,`verified`,`disputed`} | |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### `notes`

Free-form notes that may be attached to an entity (`entity_id` may be NULL;
`SET NULL` on entity delete).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `entity_id` | UUID | FK → `entities(id)` ON DELETE SET NULL | Optional owner |
| `content` | TEXT | NOT NULL | Note body (max 100 000) |
| `format` | TEXT | DEFAULT 'markdown' | `markdown` or `plain` |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### `links`

Directed relationships between two entities. Both endpoints cascade on
delete.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `source_id` | UUID | NOT NULL, FK → `entities(id)` ON DELETE CASCADE | Origin node |
| `target_id` | UUID | NOT NULL, FK → `entities(id)` ON DELETE CASCADE | Destination node |
| `relation` | TEXT | NOT NULL | Short label (`inspires`, `related`, `contradicts`, …) |
| `metadata` | TEXT | | JSON-encoded key/value bag |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### `tags` and `entity_tags`

Tag taxonomy with a many-to-many join to entities.

| Table | Column | Type | Constraints | Description |
|-------|--------|------|-------------|-------------|
| `tags` | `id` | UUID | PRIMARY KEY | |
| `tags` | `name` | TEXT | NOT NULL, UNIQUE | Tag label (max 100) |
| `tags` | `color` | TEXT | | Hex colour (max 7) |
| `tags` | `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `entity_tags` | `entity_id` | UUID | NOT NULL, FK → `entities(id)` ON DELETE CASCADE | Composite PK |
| `entity_tags` | `tag_id` | UUID | NOT NULL, FK → `tags(id)` ON DELETE CASCADE | Composite PK |

### `entity_versions`

Append-only history of entity edits, one row per save.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `entity_id` | UUID | NOT NULL, FK → `entities(id)` ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | Snapshot of name |
| `type` | TEXT | NOT NULL | Snapshot of type |
| `description` | TEXT | | Snapshot of description |
| `metadata` | TEXT | | Snapshot of metadata JSON |
| `version` | INTEGER | NOT NULL | Monotonic per-entity version number |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When the snapshot was taken |

### `graph_snapshots`

Persisted graph states for later replay/diff. Nodes and edges are stored
as JSON columns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `name` | TEXT | NOT NULL | Display name |
| `nodes_json` | TEXT | NOT NULL | JSON array of `{id, label, ...}` |
| `edges_json` | TEXT | NOT NULL | JSON array of `{id, source, target, label, ...}` |
| `description` | TEXT | | Free-form note |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### `web_cache`

Cached web content used by `entity-create --source-url` auto-hydration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `url` | TEXT | PRIMARY KEY | Source URL |
| `content` | TEXT | NOT NULL | Fetched body |
| `format` | TEXT | DEFAULT 'markdown' | `markdown` or `plain` |
| `title` | TEXT | | Resolved page title |
| `resolved_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `metadata` | TEXT | | JSON-encoded resolver metadata |

### `schema_version`

Migration ledger. Populated by `db:migrate`, consumed by `db:status`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version` | INTEGER | PRIMARY KEY | Monotonic migration number |
| `name` | TEXT | NOT NULL | Migration name (e.g. `initial`, `constraints`) |
| `checksum` | TEXT | NOT NULL | SHA-style checksum of the migration file |
| `applied_at` | TEXT | DEFAULT `datetime('now')` | When the migration ran |

## Virtual Tables (FTS5)

FTS5 indexes are contentless (`detail=none, content=''`) — they store
only the tokenized index, not the original text. The actual data lives in
the source tables.

### `entity_search_idx`

Full-text index of entity names and descriptions.

```sql
CREATE VIRTUAL TABLE entity_search_idx USING fts5(
    name, description,
    tokenize='porter unicode61',
    detail=none, content=''
);
```

### `claim_search_idx`

Full-text index of claim statements.

```sql
CREATE VIRTUAL TABLE claim_search_idx USING fts5(
    statement,
    tokenize='porter unicode61',
    detail=none, content=''
);
```

### `note_search_idx`

Full-text index of note contents. Added in migration 006 so the
"Notes" filter in the search panel returns note hits.

```sql
CREATE VIRTUAL TABLE note_search_idx USING fts5(
    content,
    tokenize='porter unicode61',
    detail=none, content=''
);
```

## Indexes

| Index | Table | Columns | Notes |
|-------|-------|---------|-------|
| `idx_claims_entity_id` | claims | `entity_id` | Foreign key lookup |
| `idx_claims_verification_status` | claims | `verification_status` | Filter by status |
| `idx_links_source_id` | links | `source_id` | Outgoing lookup |
| `idx_links_target_id` | links | `target_id` | Incoming lookup |
| `idx_notes_entity_id` | notes | `entity_id` | Note-by-entity |
| `idx_graph_snapshots_created_at` | graph_snapshots | `created_at` | Recent-first listing |
| `idx_web_cache_resolved_at` | web_cache | `resolved_at` | Cache eviction |
| `idx_entity_tags_entity_id` | entity_tags | `entity_id` | Reverse lookup |
| `idx_entity_tags_tag_id` | entity_tags | `tag_id` | Reverse lookup |
| `idx_tags_name` | tags | `name` | Tag search |
| `idx_entity_versions_entity_id` | entity_versions | `entity_id` | History-by-entity |
| `idx_entity_versions_version` | entity_versions | `entity_id, version` | Version lookups |

## Migrations

Numbered SQL files in `public/db/migrations/`. Each file contains an
`-- UP` block and a `-- DOWN` block separated by a comment.

| File | Version | Name | What it does |
|------|---------|------|--------------|
| `001_initial.sql` | 1 | `initial` | Core tables, FTS5 indexes, basic indexes |
| `002_constraints.sql` | 2 | `constraints` | Adds `UNIQUE(name)` to entities, `CHECK` constraints on claims, additional indexes |
| `003_entity_source_url.sql` | 3 | `entity_source_url` | Adds `source_url` column to entities |
| `004_tags.sql` | 4 | `tags` | Adds `tags` and `entity_tags` tables with cascade FKs |
| `005_entity_versions.sql` | 5 | `entity_versions` | Adds `entity_versions` table for history |
| `006_note_search_idx.sql` | 6 | `note_search_idx` | Adds FTS5 index for note content |

### Running migrations

```bash
# Apply all pending migrations
pnpm run cli -- db:migrate

# Roll back the most recent migration (runs the DOWN block)
pnpm run cli -- db:rollback

# Show applied / pending status
pnpm run cli -- db:status

# Drop everything and rebuild from scratch (DESTRUCTIVE)
pnpm run cli -- db:reset
```

The migration runner (`src/db/migrate.ts`) computes a SHA-style
checksum of each file, looks up the highest applied version in
`schema_version`, and applies any newer files in order. The runner is
idempotent: re-running `db:migrate` is a no-op when nothing is pending.

### Authoring a new migration

1. Create `public/db/migrations/NNN_short_name.sql` with a numeric
   prefix one above the current maximum.
2. Use `-- UP` and `-- DOWN` comment markers.
3. Wrap multi-statement changes in `BEGIN TRANSACTION;` / `COMMIT;`.
4. Run `pnpm run cli -- db:migrate` locally to verify.
5. Update the table above.

The migration framework is part of the in-app bootstrap (`DbProvider`),
so fresh installs get every migration applied before the UI mounts.
