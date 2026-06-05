# Repository API

The Repository is the primary data access layer. It provides typed CRUD operations for all knowledge base entities and runs on both browser (SQLite WASM) and CLI (better-sqlite3).

---

## Quick Start

```typescript
import { repository } from '../db/repository';

// Create an entity
const entity = await repository.createEntity({
  name: 'TRIZ',
  type: 'concept',
  description: 'Theory of Inventive Problem Solving',
});

// Search entities
const results = await repository.searchEntities('invention');

// Get entity by name
const found = await repository.getEntityByName('TRIZ');
```

---

## Architecture

```
UI / CLI
    │
    ▼
┌─────────────────────┐
│    Repository        │  ← High-level typed API
│    (index.ts)        │
└────────┬────────────┘
         │
    ┌────┴────────────────────┐
    ▼                         ▼
┌─────────────┐    ┌──────────────────┐
│  entities   │    │  claims / notes  │
│  (entities  │    │  (claims.ts,     │
│   .ts)      │    │   notes.ts)      │
└──────┬──────┘    └────────┬─────────┘
       │                    │
       └────────┬───────────┘
                ▼
       ┌────────────────┐
       │ RepositoryBase │  ← exec(), execRows(), transaction()
       │ (base.ts)      │
       └────────┬───────┘
                ▼
       ┌────────────────┐
       │   SQLiteDB     │  ← Browser (WASM+OPFS) or Node (better-sqlite3)
       │   (client.ts)  │
       └────────────────┘
```

---

## Entity Operations

### `createEntity(entity) → Promise<Entity & { rowid: number }>`

Create a new entity. All fields except `name` and `type` are optional.

```typescript
const entity = await repository.createEntity({
  name: 'Altshuller',
  type: 'person',
  description: 'Creator of TRIZ',
  source_url: 'https://en.wikipedia.org/wiki/Genrich_Altshuller',
  metadata: { nationality: 'Russian' },
});
```

### `getAllEntities(options?) → Promise<Entity[]>`

Get all entities ordered by name.

```typescript
const entities = await repository.getAllEntities();
const page = await repository.getAllEntities({ limit: 20, offset: 40 });
```

### `getEntities(options?) → Promise<Entity[]>`

Get entities with filtering, sorting, and pagination.

```typescript
const filtered = await repository.getEntities({
  type: 'concept',
  search: 'invention',
  sortBy: 'created_at',
  sortOrder: 'DESC',
  limit: 10,
});
```

### `getEntitiesCount(options?) → Promise<number>`

Count entities with optional filtering.

```typescript
const count = await repository.getEntitiesCount({ type: 'concept' });
```

### `getEntityById(id) → Promise<Entity | null>`

```typescript
const entity = await repository.getEntityById('uuid-here');
```

### `getEntityByName(name) → Promise<Entity | null>`

```typescript
const entity = await repository.getEntityByName('TRIZ');
```

### `updateEntity(id, updates) → Promise<Entity>`

```typescript
const updated = await repository.updateEntity(entity.id, {
  description: 'Updated description',
  type: 'methodology',
});
```

### `deleteEntity(id) → Promise<void>`

Cascade deletes all claims, notes, and links.

```typescript
await repository.deleteEntity(entity.id);
```

### `searchEntities(query) → Promise<Entity[]>`

Full-text search using FTS5 with porter stemming.

```typescript
const results = await repository.searchEntities('problem solving');
```

### `searchRelated(query, options?) → Promise<RankedResult[]>`

Multi-stage search (FTS5 → Orama → related entities). Returns scored results.

```typescript
const results = await repository.searchRelated('invention', {
  excludeIds: new Set(['already-shown-id']),
});
```

---

## Claim Operations

### `createClaim(claim) → Promise<Claim & { rowid: number }>`

```typescript
const claim = await repository.createClaim({
  entity_id: entity.id,
  statement: 'TRIZ was developed in 1946',
  confidence: 0.95,
  evidence: 'Historical records',
  source: 'Wikipedia',
});
```

### `getClaimsByEntityId(entityId) → Promise<Claim[]>`

### `getAllClaims() → Promise<Claim[]>`

### `getAllClaimsGroupedByEntity() → Promise<Record<string, Claim[]>>`

### `getClaimsByVerificationStatus(status) → Promise<Claim[]>`

```typescript
const unverified = await repository.getClaimsByVerificationStatus('unverified');
```

### `updateClaim(id, updates) → Promise<Claim>`

### `updateClaimVerification(id, status) → Promise<Claim>`

```typescript
const verified = await repository.updateClaimVerification(claim.id, 'verified');
```

### `deleteClaim(id) → Promise<void>`

---

## Note Operations

### `createNote(note) → Promise<Note>`

```typescript
const note = await repository.createNote({
  entity_id: entity.id,
  content: 'Key insight about this concept',
  format: 'markdown',
});
```

### `getNotesByEntityId(entityId) → Promise<Note[]>`

### `getAllNotes() → Promise<Note[]>`

### `updateNote(id, updates) → Promise<Note>`

### `deleteNote(id) → Promise<void>`

---

## Link Operations

Links represent directed relationships between entities.

### `createLink(link) → Promise<Link>`

```typescript
const link = await repository.createLink({
  source_id: entityA.id,
  target_id: entityB.id,
  relation: 'inspired_by',
});
```

### `getAllLinks(options?) → Promise<Link[]>`

### `getBacklinks(entityId) → Promise<Entity[]>`

Get all entities that link TO the given entity.

```typescript
const backlinks = await repository.getBacklinks(entity.id);
```

### `getBacklinkCount(entityId) → Promise<number>`

### `deleteLink(id) → Promise<void>`

---

## Graph Snapshot Operations

### `createSnapshot(name, nodes, edges, description?) → Promise<GraphSnapshot>`

### `getSnapshot(id) → Promise<GraphSnapshot | null>`

### `listSnapshots() → Promise<GraphSnapshot[]>`

### `diffSnapshots(id1, id2) → Promise<GraphSnapshotDiff>`

```typescript
const diff = await repository.diffSnapshots(snap1.id, snap2.id);
// diff.added_nodes, diff.removed_nodes, diff.added_edges, diff.removed_edges
```

---

## Web Cache Operations

### `upsertWebCache(url, content, title?, format?) → Promise<void>`

### `getWebCache(url) → Promise<CacheEntry | null>`

```typescript
await repository.upsertWebCache(url, 'page content', 'Page Title', 'markdown');
const cached = await repository.getWebCache(url);
```

---

## Low-Level Operations

### `exec(options) → Promise<unknown>`

Execute raw SQL. Returns `unknown` (use with care).

### `execRows(options) → Promise<unknown[]>`

Execute raw SQL and return parsed rows.

### `transaction(statements) → Promise<unknown>`

Execute multiple statements in a transaction.

---

## Zod Validation

All data is validated at the repository boundary using Zod schemas from `src/lib/validation.ts`:

- `EntitySchema` — validates entities with name, type, description, source_url, metadata
- `ClaimSchema` — validates claims with confidence (0–1), verification_status
- `NoteSchema` — validates notes with format (markdown/plain)
- `LinkSchema` — validates links with source_id, target_id, relation

The `parseMetadata()` method in `RepositoryBase` handles:
- JSON string → object parsing for metadata fields
- Null → undefined normalization for optional fields

---

## Error Handling

Repository methods throw `AppError` (from `src/lib/errors.ts`) with:
- `message` — human-readable error description
- `code` — machine-readable error code (e.g. `'DB_ERROR'`)
- `context` — additional error context
- `recoverable` — whether the error is recoverable

---

## Related Files

| File | Purpose |
|------|---------|
| `src/db/repository/index.ts` | Main Repository class + singleton export |
| `src/db/repository/base.ts` | Base class with exec/transaction/parseMetadata |
| `src/db/repository/types.ts` | IRepository interface + types |
| `src/db/repository/entities.ts` | Entity CRUD operations |
| `src/db/repository/claims.ts` | Claim CRUD operations |
| `src/db/repository/notes.ts` | Note CRUD operations |
| `src/db/repository/links.ts` | Link CRUD operations |
| `src/db/repository/graph-snapshots.ts` | Snapshot operations |
| `src/db/repository/web-cache.ts` | Web cache operations |
| `src/lib/validation.ts` | Zod schemas for all data types |
| `src/lib/errors.ts` | AppError class |
