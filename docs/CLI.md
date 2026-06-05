# CLI Reference

The `knowledge-studio` CLI provides terminal-based automation for managing your knowledge base. It uses the same repository layer as the browser app but runs in Node.js via `better-sqlite3`.

## Global Options

| Flag | Description | Default |
|------|-------------|---------|
| `--db-path <path>` | Custom path to SQLite database file | `~/.local/share/do-knowledge-studio/data.db` |
| `--version` | Show version number | — |
| `--help` | Show help for any command | — |

Run any command with `pnpm run cli -- <command> [args] [options]`.

---

## Commands

### `init`

Initialize the workspace. Creates the `./export` directory if it doesn't exist.

```bash
pnpm run cli -- init
```

---

### `sync <source>`

Sync data from a directory of Markdown files or a URL into the database.

**Arguments:**
- `<source>` — Directory path or HTTP(S) URL

**From a directory:** Reads all `.md` files. The first H1 heading becomes the entity name. Entities are created as type `concept`.

```bash
pnpm run cli -- sync ./path/to/markdown/files
```

**From a URL:** Fetches content via Jina AI reader (cross-origin) or direct fetch (same-origin). Creates an entity with the page title and content.

```bash
pnpm run cli -- sync https://example.com/article
```

---

### `export`

Export the knowledge base to various formats.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format <format>` | Export format: `md`, `json`, or `site` | `md` |
| `-o, --output <dir>` | Output directory | `./export` |

```bash
# Markdown — one file per entity
pnpm run cli -- export --format md --output ./export/markdown

# JSON — single knowledge.json file
pnpm run cli -- export --format json --output ./export/json

# Static site — portable HTML file
pnpm run cli -- export --format site --output ./export/site
```

---

### `search <query>`

Full-text search across entities using FTS5.

```bash
pnpm run cli -- search "artificial intelligence"
```

---

### `entity-create <name>`

Create a new entity.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type <type>` | Entity type | `concept` |
| `-d, --description <text>` | Entity description | — |
| `-u, --source-url <url>` | Source URL for auto-hydration | — |

```bash
pnpm run cli -- entity-create "TRIZ" --type concept --description "Theory of Inventive Problem Solving"

# Auto-hydrate description from URL
pnpm run cli -- entity-create "TRIZ" --source-url https://en.wikipedia.org/wiki/TRIZ
```

---

### `entity-list`

List all entities in the database.

```bash
pnpm run cli -- entity-list
```

Output: `[type] name` per line.

---

### `entity-get <name>`

Get detailed information about an entity by name.

```bash
pnpm run cli -- entity-get "TRIZ"
```

---

### `entity-update <name>`

Update an entity's type or description.

**Options:**

| Flag | Description |
|------|-------------|
| `-t, --type <type>` | New entity type |
| `-d, --description <text>` | New description |

```bash
pnpm run cli -- entity-update "TRIZ" --type methodology --description "Updated description"
```

---

### `entity-delete <name>`

Delete an entity and all its cascading data (claims, notes, links).

```bash
pnpm run cli -- entity-delete "Old Entity"
```

---

### `claim-create <entity-name> <statement>`

Create a claim (assertion) about an entity.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --confidence <value>` | Confidence score (0.0–1.0) | `1.0` |

```bash
pnpm run cli -- claim-create "TRIZ" "TRIZ was developed by Genrich Altshuller" --confidence 0.95
```

---

### `link-create <source> <target>`

Create a relationship link between two entities.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --relation <type>` | Relation type | `related` |

```bash
pnpm run cli -- link-create "TRIZ" "Genrich Altshuller" --relation "created_by"
```

---

### `link-list`

List all links in the database.

```bash
pnpm run cli -- link-list
```

Output: `[id] source --[relation]--> target` per line.

---

### `link-delete <id>`

Delete a link by its ID.

```bash
pnpm run cli -- link-delete <link-id>
```

---

### `note-create <entity> <content>`

Create a note attached to an entity.

```bash
pnpm run cli -- note-create "TRIZ" "Key insight: contradictions drive innovation"
```

---

### `note-list <entity>`

List all notes for an entity.

```bash
pnpm run cli -- note-list "TRIZ"
```

---

### `snapshot-list`

List all saved graph snapshots.

```bash
pnpm run cli -- snapshot-list
```

---

### `db:migrate`

Run pending database migrations.

```bash
pnpm run cli -- db:migrate
```

---

### `db:rollback`

Roll back the last applied migration.

```bash
pnpm run cli -- db:rollback
```

---

### `db:status`

Show the status of all migrations (applied or pending).

```bash
pnpm run cli -- db:status
```

---

### `db:backup [path]`

Create a backup of the SQLite database using `VACUUM INTO`.

```bash
pnpm run cli -- db:backup                    # Default: .studio-cli-backup-<timestamp>.db
pnpm run cli -- db:backup ./backups/my.db    # Custom path
```

---

### `db:reset`

**Destructive.** Drop all tables and re-run the schema from scratch.

```bash
pnpm run cli -- db:reset
```

---

## Sharing Data Between CLI and Browser

To see CLI-created data in the browser app:

1. Open the app in Chrome or Edge
2. Go to **AI Harness** → click the **Settings** (gear) icon
3. Click **Connect Local Database**
4. Select the database directory (usually `~/.local/share/do-knowledge-studio/`)
5. Reload the page when prompted

The browser synchronizes its OPFS storage with the `data.db` file in that directory.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Database not initialized` | Ensure `--db-path` points to a valid SQLite file, or run `init` first |
| `Entity not found` | Use `entity-list` to verify the entity name (case-sensitive) |
| `Sync found 0 files` | Ensure the directory contains `.md` files with H1 headings |
| `Backup failed` | Check write permissions for the output directory |
