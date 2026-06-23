# Repository API

The `Repository` class (`src/db/repository/index.ts`) is the only
data-access layer in the codebase. It exposes a typed, async API
covering every table in the schema. The same class runs against
SQLite WASM in the browser and `better-sqlite3` in the CLI, so a
single set of tests covers both runtimes.

A singleton instance is exported as `repository`. Feature code should
use the `useRepository()` hook instead of importing the singleton
directly so React's render lifecycle is respected.

## Quick Start

```typescript
import { repository } from '../db/repository';

const entity = await repository.createEntity({
  name: 'TRIZ',
  type: 'concept',
  description: 'Theory of Inventive Problem Solving',
});

const results = await repository.searchEntities('invention');
const found = await repository.getEntityByName('TRIZ');
```

## Architecture

```
UI / CLI
   │
   ▼
┌──────────────────────────┐
│      Repository          │  ← high-level typed API
│      (index.ts)          │
└──────────┬───────────────┘
           │
   ┌───────┴────────────────────────────┐
   ▼                                    ▼
┌────────────┐  ┌────────────────┐  ┌──────────────┐
│ entities   │  │ claims/notes/  │  │ tags/        │
│ (entities  │  │ links/         │  │ snapshots/   │
│  .ts)      │  │ entity-        │  │ versions/    │
└─────┬──────┘  │ versions       │  │ web-cache    │
      │         └──────┬─────────┘  └──────┬───────┘
      └────────────────┴───────────────────┘
                       │
                       ▼
              ┌────────────────────┐
              │  RepositoryBase    │  ← exec / execRows /
              │  (base.ts)         │     transaction /
              │                    │     parseMetadata
              └────────┬───────────┘
                       ▼
              ┌────────────────────┐
              │     SQLiteDB       │  ← Browser (WASM+OPFS)
              │     (client.ts)    │     or Node (better-sqlite3)
              └────────────────────┘
```

## Entity Operations

### `createEntity(entity)`

Create a new entity. Returns the new row plus its `rowid`.
`name` and `type` are required; everything else is optional.
Validation runs through `EntitySchema` in `src/lib/validation.ts`.

```typescript
const entity = await repository.createEntity({
  name: 'Altshuller',
  type: 'person',
  description: 'Creator of TRIZ',
  sourceUrl: 'https://en.wikipedia.org/wiki/Genrich_Altshuller',
  metadata: { nationality: 'Russian' },
});
// Returns: Entity & { rowid: number }
```

### `getAllEntities(options?)`

Fetch all entities ordered by `name`. Supports pagination.

```typescript
const entities = await repository.getAllEntities();
const page = await repository.getAllEntities({ limit: 20, offset: 40 });
```

### `getEntities(options?)`

Filtered, sorted, paginated entity query.

```typescript
const filtered = await repository.getEntities({
  type: 'concept',
  search: 'invention',          // substring match on name
  sortBy: 'created_at',         // 'name' | 'created_at' | 'updated_at'
  sortOrder: 'DESC',            // 'ASC' | 'DESC'
  limit: 10,
});
```

### `getEntitiesCount(options?)`

Same filters as `getEntities` but returns the row count.

### `getEntityById(id)` · `getEntityByName(name)`

Look up by primary key or by the unique `name` column. Either
returns `null` if not found.

### `updateEntity(id, updates)`

Patch an existing entity. Pass only the fields you want to change.
Returns the post-update row. Also captures a new `entity_versions`
row automatically.

### `deleteEntity(id)`

Delete an entity and cascade-delete all of its claims, notes,
entity_tags rows, links (where it appears as either endpoint), and
entity_versions.

### `searchEntities(query)`

FTS5 keyword search. Uses `entity_search_idx` and returns matching
entities ordered by relevance.

### `searchRelated(query, options?)`

Multi-stage related search: combines the entity's own FTS5 hits with
backlink traversal. `excludeIds` skips already-shown results.

```typescript
const related = await repository.searchRelated('innovation', {
  excludeIds: new Set(['already-shown-id']),
});
```

## Claim Operations

### `createClaim(claim)` · `createClaimWithProvenance(claim)`

Attach a claim to an existing entity. `createClaimWithProvenance`
also records provenance in the in-app claim-stage map (used by the
AI Harness).

```typescript
const claim = await repository.createClaim({
  entity_id: entity.id,
  statement: 'TRIZ was developed in 1946',
  confidence: 0.95,
  source: 'Wikipedia',
  verification_status: 'verified',
});
```

### Read helpers

- `getClaimsByEntityId(entityId)` — all claims for an entity.
- `getAllClaims()` — every claim in the database.
- `getAllClaimsGroupedByEntity()` — `Record<entity_id, Claim[]>`.
- `getAllEntitiesWithClaims()` — `Map<entity_id, { entity, claims }>`.
- `getClaimsByVerificationStatus(status)` — filter by status.
- `getClaimStageMap(claimIds)` — `Map<id, status>` for search
  enrichment.

### `updateClaim(id, updates)` · `updateClaimVerification(claimId, status)`

Patch a claim or change its verification status.

### `deleteClaim(id)`

Delete a single claim.

## Note Operations

### `createNote(note)`

Attach a note to an entity (or create a stand-alone note with no
`entity_id`).

```typescript
const note = await repository.createNote({
  entity_id: entity.id,
  content: 'Key insight about this concept',
  format: 'markdown',
});
```

### Read helpers

- `getNotesByEntityId(entityId)`
- `getAllNotes()`
- `getAllNotesGroupedByEntity()` — `Record<entity_id, Note[]>`
  (notes with `null` `entity_id` are omitted).

### `updateNote(id, updates)` · `deleteNote(id)`

Patch or delete a note.

## Link Operations

Links are directed relationships between two entities.

### `createLink(link)`

```typescript
const link = await repository.createLink({
  source_id: entityA.id,
  target_id: entityB.id,
  relation: 'inspired_by',
});
```

### `getAllLinks(options?)` · `getBacklinks(entityId)` · `getBacklinkCount(entityId)`

`getBacklinks` returns every entity that has a link pointing **at**
`entityId` (incoming links).

### `deleteLink(id)`

Delete a single link.

## Graph Snapshot Operations

Snapshots persist the current graph for later replay or diff.

### `createSnapshot(name, nodes, edges, description?)`

```typescript
const snap = await repository.createSnapshot(
  'Graph v1',
  [{ id: 'n1', label: 'TRIZ' }, { id: 'n2', label: 'Innovation' }],
  [{ id: 'e1', source: 'n1', target: 'n2', label: 'inspires' }],
  'Initial state',
);
```

### `getSnapshot(id)` · `listSnapshots()`

Read helpers. `listSnapshots` returns newest-first.

### `diffSnapshots(id1, id2)`

Compute added/removed node and edge sets between two snapshots.

```typescript
const diff = await repository.diffSnapshots(snap1.id, snap2.id);
// diff.added_nodes, diff.removed_nodes, diff.added_edges, diff.removed_edges
```

## Web Cache Operations

Used by the URL auto-hydration flow.

```typescript
await repository.upsertWebCache(
  'https://example.com/article',
  'Page content...',
  'Article Title',
  'markdown',
);

const cached = await repository.getWebCache('https://example.com/article');
```

`getWebCache` returns `null` if the URL is not cached.

## Tag Operations

| Method | Purpose |
|--------|---------|
| `createTag(name, color?)` | Create a tag (name must be unique) |
| `getAllTags()` | Returns `TagWithCount[]` with usage counts |
| `getTagByName(name)` | Lookup by unique name |
| `deleteTag(id)` | Remove a tag (cascades through `entity_tags`) |
| `addTagToEntity(entityId, tagId)` | Attach a tag |
| `removeTagFromEntity(entityId, tagId)` | Detach a tag |
| `getTagsByEntityId(entityId)` | Tags applied to the entity |
| `getEntitiesByTagId(tagId)` | Entity ids that carry the tag |

## Entity Version Operations

`updateEntity` automatically captures a new `entity_versions` row
on every save. Manual helpers are also exposed:

- `captureEntityVersion(entityId)` — record a snapshot of current state.
- `getEntityVersions(entityId)` — full history, newest first.
- `getEntityVersion(entityId, version)` — fetch one version.
- `restoreEntityVersion(entityId, version)` — rewrite the entity
  row from a chosen version.
- `diffEntityVersions(entityId, version1, version2)` — per-field
  diff (`name`, `type`, `description`, `metadata`).

```typescript
const diff = await repository.diffEntityVersions(entity.id, 1, 2);
// diff.name = { old, new } | null
// diff.description = { old, new } | null
// diff.metadata = { old, new } | null
```

## Low-Level Operations

Use these for ad-hoc queries that don't have a dedicated method.
They bypass the Zod layer.

### `exec(options)`

Execute raw SQL. Returns `unknown`.

```typescript
await repository.exec({ sql: 'SELECT 1' });
```

### `execRows(options)`

Execute raw SQL and return parsed rows.

```typescript
const rows = await repository.execRows({
  sql: 'SELECT * FROM entities WHERE type = ?',
  bind: ['concept'],
  returnValue: 'resultRows',
  rowMode: 'object',
});
```

### `transaction(statements)`

Run multiple statements atomically.

```typescript
await repository.transaction([
  { sql: 'INSERT INTO entities ...' },
  { sql: 'INSERT INTO claims ...' },
]);
```

## Zod Validation

Every public method validates its input through the Zod schemas in
`src/lib/validation.ts`:

- `EntitySchema` — name (1–255), type (1–255), description (≤10 000),
  sourceUrl (≤2 048), metadata (record of unknown).
- `ClaimSchema` — confidence clamped to [0, 1], verification_status
  ∈ {`unverified`, `verified`, `disputed`}.
- `NoteSchema` — format ∈ {`markdown`, `plain`}, content (1–100 000).
- `LinkSchema` — relation (1–255), source_id and target_id required.

`parseMetadata()` in `RepositoryBase` handles:

- `metadata` JSON string → object
- `null` → `undefined` normalization for optional scalar fields

## Error Handling

All repository methods throw `AppError` (from `src/lib/errors.ts`)
on failure:

```typescript
class AppError extends Error {
  constructor(
    message: string,
    code: ErrorCode,
    context?: unknown,
    userMessage?: string,
    recoverable?: boolean,
  );
}
```

| Code | When raised |
|------|-------------|
| `DB_INIT_FAILED` | `DbProvider` boot |
| `DB_NOT_READY` | Repository accessed before DB ready |
| `DB_QUERY_FAILED` / `DB_ERROR` | Any `exec` failure |
| `WORKER_TIMEOUT` | SQLite worker exceeded its budget |
| `VALIDATION_FAILED` / `VALIDATION_ERROR` | Zod schema rejected input |
| `NOT_FOUND` | Update/delete target missing |
| `SEARCH_FAILED` | Orama/FTS5 pipeline error |
| `EXPORT_FAILED` | PDF / JSON / Markdown export |
| `LLM_FAILED` | LLM provider call failure |
| `OPERATION_FAILED` | Generic catch-all (CLI) |
| `UNKNOWN` | Unclassified last resort |

`recoverable` hints to the UI whether the user can retry without
reloading. `userMessage` is the safe-to-display copy; the raw
`message` is for logs.

## Related Files

| File | Purpose |
|------|---------|
| `src/db/repository/index.ts` | `Repository` class + singleton export |
| `src/db/repository/base.ts` | `exec` / `transaction` / `parseMetadata` |
| `src/db/repository/types.ts` | `IRepository` interface, `RankedResult`, `GraphSnapshotDiff` |
| `src/db/repository/entities.ts` | Entity CRUD |
| `src/db/repository/claims.ts` | Claim CRUD + grouping helpers |
| `src/db/repository/notes.ts` | Note CRUD + grouping helpers |
| `src/db/repository/links.ts` | Link CRUD + backlink helpers |
| `src/db/repository/tags.ts` | Tag CRUD + `TagWithCount` type |
| `src/db/repository/entity-versions.ts` | Version history + diff |
| `src/db/repository/graph-snapshots.ts` | Snapshot CRUD + diff |
| `src/db/repository/web-cache.ts` | Web content cache |
| `src/db/client.ts` | `SQLiteDB` (browser + Node shim) |
| `src/lib/validation.ts` | Zod schemas for every entity type |
| `src/lib/errors.ts` | `AppError` class + error codes |

