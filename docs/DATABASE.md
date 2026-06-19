# Database Schema

SQLite WASM + OPFS database with FTS5 full-text search.

## Tables

### `entities`

Core knowledge entities (concepts, notes, people, projects).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY |
| `name` | TEXT | NOT NULL, UNIQUE |
| `type` | TEXT | NOT NULL (`note`, `concept`, `person`, `project`) |
| `description` | TEXT | |
| `metadata` | TEXT | JSON string |
| `source_url` | TEXT | |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `claims`

Verifiable statements attached to entities.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY |
| `entity_id` | UUID | NOT NULL, FK → entities(id) CASCADE |
| `statement` | TEXT | NOT NULL |
| `evidence` | TEXT | |
| `confidence` | REAL | DEFAULT 1.0, CHECK (0–1) |
| `source` | TEXT | |
| `verification_status` | TEXT | DEFAULT 'unverified', CHECK ('unverified', 'verified', 'disputed') |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `notes`

Free-form notes attached to entities.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY |
| `entity_id` | UUID | FK → entities(id) SET NULL |
| `content` | TEXT | NOT NULL |
| `format` | TEXT | DEFAULT 'markdown' |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `links`

Directed relationships between entities.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY |
| `source_id` | UUID | NOT NULL, FK → entities(id) CASCADE |
| `target_id` | UUID | NOT NULL, FK → entities(id) CASCADE |
| `relation` | TEXT | NOT NULL |
| `metadata` | TEXT | JSON string |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `graph_snapshots`

Saved graph states for comparison.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `nodes_json` | TEXT | NOT NULL (JSON array) |
| `edges_json` | TEXT | NOT NULL (JSON array) |
| `description` | TEXT | |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `web_cache`

Cached web content for entity hydration.

| Column | Type | Constraints |
|--------|------|-------------|
| `url` | TEXT | PRIMARY KEY |
| `content` | TEXT | NOT NULL |
| `format` | TEXT | DEFAULT 'markdown' |
| `title` | TEXT | |
| `resolved_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `metadata` | TEXT | JSON string |

### `schema_version`

Migration tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| `version` | INTEGER | PRIMARY KEY |
| `name` | TEXT | NOT NULL |
| `checksum` | TEXT | NOT NULL |
| `applied_at` | TEXT | DEFAULT datetime('now') |

## Virtual Tables (FTS5)

### `entity_search_idx`

Full-text search index for entity names and descriptions.

```sql
CREATE VIRTUAL TABLE entity_search_idx USING fts5(
    name, description,
    tokenize='porter unicode61',
    detail=none, content=''
);
```

### `claim_search_idx`

Full-text search index for claim statements.

```sql
CREATE VIRTUAL TABLE claim_search_idx USING fts5(
    statement,
    tokenize='porter unicode61',
    detail=none, content=''
);
```

## Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_claims_entity_id` | claims | entity_id |
| `idx_claims_verification_status` | claims | verification_status |
| `idx_links_source_id` | links | source_id |
| `idx_links_target_id` | links | target_id |
| `idx_notes_entity_id` | notes | entity_id |
| `idx_graph_snapshots_created_at` | graph_snapshots | created_at |
| `idx_web_cache_resolved_at` | web_cache | resolved_at |

## Migrations

Located in `public/db/migrations/`. Run with `pnpm run cli -- db:migrate`.

| Version | Name | Description |
|---------|------|-------------|
| 1 | initial | Core tables and FTS5 indexes |
| 2 | constraints | UNIQUE(name), CHECK constraints, additional indexes |
| 3 | entity_source_url | Add source_url column to entities |
