# CLI Reference

Command-line interface for Knowledge Studio. Run with `pnpm run cli -- <command>`.

## Global Options

| Option | Description |
|--------|-------------|
| `--db-path <path>` | Custom path to SQLite database file (CLI only) |
| `--version` | Print version from `VERSION` file |
| `--help` | Print help for any command |

The CLI auto-initializes the SQLite database on first invocation via the `preAction` hook. On exit, the database connection is closed cleanly.

## Workspace Commands

### `init`

Initialize a workspace by creating the `./export` output directory.

```bash
pnpm run cli -- init
```

### `sync <source>`

Sync Markdown files from a directory or auto-hydrate an entity from a URL.

```bash
pnpm run cli -- sync ./notes
pnpm run cli -- sync https://en.wikipedia.org/wiki/TRIZ
```

| Source Type | Behavior |
|-------------|----------|
| Directory | Imports every `*.md` file. The first line (`# Title`) becomes the entity name; the remainder (truncated to 200 chars) becomes the description. |
| URL (http/https) | Resolves the URL via `src/lib/resolver.js`, then creates an entity whose name and description come from the resolved content. Provider/word count is reported. |

## Entity Commands

### `entity-create <name>`

Create a new entity.

```bash
pnpm run cli -- entity-create "TRIZ" -t concept -d "Theory of Inventive Problem Solving"
```

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type <type>` | Entity type | `concept` |
| `-d, --description <description>` | Entity description | |
| `-u, --source-url <url>` | Source URL for auto-hydration | |

### `entity-list`

List all entities.

```bash
pnpm run cli -- entity-list
```

### `entity-get <name>`

Get entity details by name.

```bash
pnpm run cli -- entity-get "TRIZ"
```

### `entity-update <name>`

Update an entity's type or description.

```bash
pnpm run cli -- entity-update "TRIZ" -d "Updated description"
```

| Option | Description |
|--------|-------------|
| `-t, --type <type>` | New entity type |
| `-d, --description <description>` | New description |

### `entity-delete <name>`

Delete an entity and cascade (claims, links, notes).

```bash
pnpm run cli -- entity-delete "TRIZ"
```

## Claim Commands

### `claim-create <entity-name> <statement>`

Create a claim for an entity.

```bash
pnpm run cli -- claim-create "TRIZ" "TRIZ has 40 inventive principles" -c 0.95
```

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --confidence <confidence>` | Confidence score (0–1) | `1.0` |

## Note Commands

### `note-create <entity> <content>`

Create a note for an entity.

```bash
pnpm run cli -- note-create "TRIZ" "Key insight: separation principles"
```

### `note-list <entity>`

List notes for an entity.

```bash
pnpm run cli -- note-list "TRIZ"
```

## Link Commands

### `link-create <source> <target>`

Create a directed link between two entities.

```bash
pnpm run cli -- link-create "TRIZ" "Innovation" -r "inspires"
```

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --relation <relation>` | Relation type | `related` |

### `link-list`

List all links with resolved entity names.

```bash
pnpm run cli -- link-list
```

### `link-delete <id>`

Delete a link by ID.

```bash
pnpm run cli -- link-delete "abc-123"
```

## Search Commands

### `search <query>`

Full-text search entities using FTS5.

```bash
pnpm run cli -- search "inventive principles"
```

### `snapshot-list`

List all graph snapshots.

```bash
pnpm run cli -- snapshot-list
```

## Export Commands

### `export`

Export knowledge base data.

```bash
pnpm run cli -- export -f md -o ./export
pnpm run cli -- export -f json -o ./export
pnpm run cli -- export -f site -o ./export
pnpm run cli -- export -f pdf -o ./export
```

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --format <format>` | Export format: `md`, `json`, `site`, `pdf` | `md` |
| `-o, --output <dir>` | Output directory | `./export` |

### `import <file>`

Import from JSON or Markdown file. Format is auto-detected by extension:
`.json` → JSON, everything else → Markdown.

```bash
pnpm run cli -- import knowledge.json
pnpm run cli -- import notes.md
```

Exit code is non-zero on file-not-found, parse failure, or persistence error.

## Database Commands

### `db:migrate`

Run pending database migrations.

```bash
pnpm run cli -- db:migrate
```

### `db:rollback`

Rollback the last applied migration.

```bash
pnpm run cli -- db:rollback
```

### `db:status`

Show migration status for all migrations.

```bash
pnpm run cli -- db:status
```

### `db:reset`

Reset database (drop all tables and re-run schema). **Destructive operation.**

```bash
pnpm run cli -- db:reset
```

## Troubleshooting

### "Database not initialized"

The pre-action hook failed to open the database. Verify:
- The `--db-path` directory exists and is writable.
- No other process holds an exclusive lock on the SQLite file.
- `better-sqlite3` rebuilt for your platform: `pnpm rebuild better-sqlite3`.

### "Entity not found: <name>"

`entity-update`, `entity-delete`, `entity-get`, `claim-create`, `note-create`, and
`note-list` resolve entities by exact case-sensitive name. Use `entity-list` to
verify the canonical name.

### "Source entity not found" / "Target entity not found"

`link-create` resolves both endpoints by name. Both must already exist — create
them first via `entity-create`.

### "Skipped: <title> (already exists)"

`sync` of a Markdown directory logs and continues when `createEntity` throws
(typically a unique-name violation). To replace, delete the entity first or
use `entity-update`.

### "Failed to parse <file>" on import

`import` rejects malformed JSON. Per-entity failures are logged to stderr but
do not abort the whole import; check the warnings printed before the final
summary line.

### Search index out of date after bulk import

The CLI's `import` writes through the repository but does not rebuild the
FTS5 or Orama indexes. To reindex, open the app once so the lazy Orama
hydration runs, or call `hydrateFts5Index()` from
`src/lib/search/fts5-hydrator.js` directly. The in-app `ImportPanel`
(AI Harness → Import) rebuilds the FTS5 index automatically after each
import.

### Exit code 1

Any unhandled CLI error sets `process.exitCode = 1` (import errors and missing
files). Inspect stderr — the error message includes the original `Error.message`.
