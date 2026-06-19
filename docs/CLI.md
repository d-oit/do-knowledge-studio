# CLI Reference

Command-line interface for Knowledge Studio. Run with `pnpm run cli -- <command>`.

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

Import from JSON or Markdown file.

```bash
pnpm run cli -- import knowledge.json
pnpm run cli -- import notes.md
```

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
