# Database Schema

`do-knowledge-studio` uses **SQLite** as its primary storage layer:
- **Browser**: SQLite WASM with OPFS (Origin Private File System) via a Web Worker pool
- **CLI**: `better-sqlite3` for Node.js access

The same schema and migrations run in both environments.

---

## Entity-Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│      entities        │       │       claims         │
├─────────────────────┤       ├─────────────────────┤
│ id         UUID  PK │◄──┐   │ id         UUID  PK │
│ name       TEXT  UQ │   │   │ entity_id  UUID  FK │──┐
│ type       TEXT     │   │   │ statement  TEXT     │  │
│ description TEXT    │   │   │ evidence   TEXT     │  │
│ source_url  TEXT    │   │   │ confidence REAL     │  │
│ metadata    TEXT    │   │   │ source     TEXT     │  │
│ created_at  DATETIME│   │   │ verification_status │  │
│ updated_at  DATETIME│   │   │ created_at DATETIME │  │
└────────┬────────────┘   │   │ updated_at DATETIME │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         │                │   ┌─────────────────────┐  │
         │                │   │       notes          │  │
         │                │   ├─────────────────────┤  │
         │                │   │ id         UUID  PK │  │
         │                ├───│ entity_id  UUID  FK │  │
         │                │   │ content    TEXT     │  │
         │                │   │ format     TEXT     │  │
         │                │   │ created_at DATETIME │  │
         │                │   │ updated_at DATETIME │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         │                │   ┌─────────────────────┐  │
         │                │   │       links          │  │
         │                │   ├─────────────────────┤  │
         │                │   │ id         UUID  PK │  │
         ├────────────────┼───│ source_id  UUID  FK │  │
         │                ├───│ target_id  UUID  FK │  │
         │                │   │ relation   TEXT     │  │
         │                │   │ metadata   TEXT     │  │
         │                │   │ created_at DATETIME │  │
         │                │   │ updated_at DATETIME │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         │                │   ┌─────────────────────┐  │
         │                │   │  graph_snapshots     │  │
         │                │   ├─────────────────────┤  │
         │                │   │ id         UUID  PK │  │
         │                │   │ name       TEXT     │  │
         │                │   │ nodes_json TEXT     │  │
         │                │   │ edges_json TEXT     │  │
         │                │   │ description TEXT    │  │
         │                │   │ created_at DATETIME │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         │                │   ┌─────────────────────┐  │
         │                │   │     web_cache        │  │
         │                │   ├─────────────────────┤  │
         │                │   │ url        TEXT  PK │  │
         │                │   │ content    TEXT     │  │
         │                │   │ format     TEXT     │  │
         │                │   │ title      TEXT     │  │
         │                │   │ resolved_at DATETIME│  │
         │                │   │ metadata   TEXT     │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         │                │   ┌─────────────────────┐  │
         │                │   │   schema_version     │  │
         │                │   ├─────────────────────┤  │
         │                │   │ version    INT   PK │  │
         │                │   │ name       TEXT     │  │
         │                │   │ checksum   TEXT     │  │
         │                │   │ applied_at TEXT     │  │
         │                │   └─────────────────────┘  │
         │                │                            │
         └────────────────┘────────────────────────────┘
```

---

## Tables

### `entities`

Central subjects of the knowledge base: people, concepts, projects, methodologies, etc.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated UUID v4 |
| `name` | TEXT | NOT NULL, UNIQUE | Entity name (displayed everywhere) |
| `type` | TEXT | NOT NULL | Entity type (e.g. `concept`, `person`, `project`) |
| `description` | TEXT | — | Free-text description |
| `source_url` | TEXT | — | URL for auto-hydration via resolver |
| `metadata` | TEXT | — | JSON object for extensible metadata |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### `claims`

Assertions made about entities, with confidence scoring and verification status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated UUID v4 |
| `entity_id` | UUID | NOT NULL, FK → entities(id) ON DELETE CASCADE | Parent entity |
| `statement` | TEXT | NOT NULL | The claim text |
| `evidence` | TEXT | — | Supporting evidence |
| `confidence` | REAL | DEFAULT 1.0, CHECK (0–1) | Confidence score |
| `source` | TEXT | — | Source reference |
| `verification_status` | TEXT | DEFAULT 'unverified', CHECK (unverified/verified/disputed) | Verification state |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### `notes`

Free-form text attached to entities. Supports markdown format.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated UUID v4 |
| `entity_id` | UUID | FK → entities(id) ON DELETE SET NULL | Parent entity (nullable) |
| `content` | TEXT | NOT NULL | Note content |
| `format` | TEXT | DEFAULT 'markdown' | Content format |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### `links`

Directed relationships between entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated UUID v4 |
| `source_id` | UUID | NOT NULL, FK → entities(id) ON DELETE CASCADE | Source entity |
| `target_id` | UUID | NOT NULL, FK → entities(id) ON DELETE CASCADE | Target entity |
| `relation` | TEXT | NOT NULL | Relationship type (e.g. `related`, `created_by`) |
| `metadata` | TEXT | — | JSON object for extensible metadata |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### `graph_snapshots`

Saved states of the knowledge graph visualization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated UUID v4 |
| `name` | TEXT | NOT NULL | Snapshot name |
| `nodes_json` | TEXT | NOT NULL | Serialized graph nodes |
| `edges_json` | TEXT | NOT NULL | Serialized graph edges |
| `description` | TEXT | — | Optional description |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

### `web_cache`

Offline-ready cache for resolved external URLs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `url` | TEXT | PRIMARY KEY | The resolved URL |
| `content` | TEXT | NOT NULL | Cached content |
| `format` | TEXT | DEFAULT 'markdown' | Content format |
| `title` | TEXT | — | Page title |
| `resolved_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | When the URL was resolved |
| `metadata` | TEXT | — | JSON: `{ content_length, word_count, provider, quality_score }` |

### `schema_version`

Tracks applied database migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `version` | INTEGER | PRIMARY KEY | Migration version number |
| `name` | TEXT | NOT NULL | Migration name |
| `checksum` | TEXT | NOT NULL | Content hash for tamper detection |
| `applied_at` | TEXT | NOT NULL | When the migration was applied |

---

## Search Tables

### `entity_search_idx` (FTS5)

Full-text search index for entities. Uses porter stemming and unicode61 tokenizer in contentless mode (no positional info for ~2x faster queries).

**Indexed columns:** `name`, `description`

### `claim_search_idx` (FTS5)

Full-text search index for claims.

**Indexed columns:** `statement`

---

## Search Architecture

The app uses a **dual search system**:

1. **FTS5 (SQLite)** — Exact keyword matching with porter stemming. Used as the first search stage.
2. **Orama (in-memory)** — Fuzzy and semantic search. Hydrated from SQLite on app startup.

Search is progressive: exact → semantic → related entities.

---

## Migrations

Migrations live in `public/db/migrations/` and are numbered sequentially:

| Version | File | Description |
|---------|------|-------------|
| 1 | `001_initial.sql` | Creates all base tables and FTS5 indexes |
| 2 | `002_constraints.sql` | Adds foreign key constraints and indexes |
| 3 | `003_entity_source_url.sql` | Adds `source_url` column to entities |

Migrations run automatically on database initialization. Use `pnpm run cli -- db:status` to check status, `pnpm run cli -- db:migrate` to run pending migrations, and `pnpm run cli -- db:rollback` to revert the last migration.

---

## Indices

| Table | Column | Purpose |
|-------|--------|---------|
| `claims` | `entity_id` | Fast lookup of claims by entity |
| `claims` | `verification_status` | Filter by verification state |
| `links` | `source_id` | Fast lookup of outgoing links |
| `links` | `target_id` | Fast lookup of incoming links (backlinks) |
| `notes` | `entity_id` | Fast lookup of notes by entity |
| `graph_snapshots` | `created_at` | Chronological snapshot ordering |
| `web_cache` | `resolved_at` | Cache expiration queries |
