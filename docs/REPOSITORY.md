# Repository API

The `IRepository` interface (`src/db/repository/types.ts`) provides the data access layer for Knowledge Studio.

## Import

```typescript
import { repository } from '../../db/repository';
import type { IRepository } from '../../db/repository';
```

## Core Methods

### `exec(options)`

Execute raw SQL.

```typescript
await repository.exec({ sql: 'SELECT 1' });
```

### `execRows(options)`

Execute SQL and return parsed rows.

```typescript
const rows = await repository.execRows({
  sql: 'SELECT * FROM entities WHERE type = ?',
  bind: ['concept'],
  returnValue: 'resultRows',
  rowMode: 'object',
});
```

### `transaction(statements)`

Execute multiple statements in a transaction.

```typescript
await repository.transaction([
  { sql: 'INSERT INTO entities ...' },
  { sql: 'INSERT INTO claims ...' },
]);
```

## Entity Methods

### `createEntity(entity)`

```typescript
const entity = await repository.createEntity({
  name: 'TRIZ',
  type: 'concept',
  description: 'Theory of Inventive Problem Solving',
});
// Returns: Entity & { rowid: number }
```

### `getAllEntities(options?)`

```typescript
const entities = await repository.getAllEntities({ limit: 100, offset: 0 });
```

### `getEntities(options?)`

```typescript
const entities = await repository.getEntities({
  search: 'TRIZ',
  type: 'concept',
  sortBy: 'name',
  sortOrder: 'ASC',
  limit: 50,
});
```

### `getEntitiesCount(options?)`

```typescript
const count = await repository.getEntitiesCount({ type: 'concept' });
```

### `getEntityById(id)`

```typescript
const entity = await repository.getEntityById('uuid-here');
// Returns: (Entity & { rowid: number }) | null
```

### `getEntityByName(name)`

```typescript
const entity = await repository.getEntityByName('TRIZ');
// Returns: Entity | null
```

### `updateEntity(id, entity)`

```typescript
const updated = await repository.updateEntity('uuid-here', {
  description: 'Updated description',
});
```

### `deleteEntity(id)`

```typescript
await repository.deleteEntity('uuid-here');
// Cascades to claims, links, notes
```

### `searchEntities(query)`

```typescript
const results = await repository.searchEntities('inventive principles');
```

### `searchRelated(query, options?)`

```typescript
const related = await repository.searchRelated('innovation', {
  excludeIds: new Set(['uuid1', 'uuid2']),
});
```

## Claim Methods

### `createClaim(claim)`

```typescript
const claim = await repository.createClaim({
  entity_id: 'uuid-here',
  statement: 'TRIZ has 40 inventive principles',
  confidence: 0.95,
  verification_status: 'verified',
});
```

### `getClaimsByEntityId(entity_id)`

```typescript
const claims = await repository.getClaimsByEntityId('uuid-here');
```

### `getAllClaims()`

```typescript
const claims = await repository.getAllClaims();
```

### `getAllClaimsGroupedByEntity()`

```typescript
const grouped = await repository.getAllClaimsGroupedByEntity();
// Returns: Record<string, Claim[]>
```

### `getAllEntitiesWithClaims()`

```typescript
const map = await repository.getAllEntitiesWithClaims();
// Returns: Map<string, { entity: Entity; claims: Claim[] }>
```

### `updateClaim(id, claim)`

```typescript
const updated = await repository.updateClaim('uuid-here', {
  confidence: 0.9,
  verification_status: 'disputed',
});
```

### `updateClaimVerification(claimId, status)`

```typescript
const updated = await repository.updateClaimVerification('uuid-here', 'verified');
```

### `getClaimsByVerificationStatus(status)`

```typescript
const unverified = await repository.getClaimsByVerificationStatus('unverified');
```

### `deleteClaim(id)`

```typescript
await repository.deleteClaim('uuid-here');
```

## Note Methods

### `createNote(note)`

```typescript
const note = await repository.createNote({
  entity_id: 'uuid-here',
  content: 'Key insight about TRIZ',
});
```

### `getAllNotes()`

```typescript
const notes = await repository.getAllNotes();
```

### `getNotesByEntityId(entity_id)`

```typescript
const notes = await repository.getNotesByEntityId('uuid-here');
```

### `getAllNotesGroupedByEntity()`

```typescript
const grouped = await repository.getAllNotesGroupedByEntity();
// Returns: Record<string, Note[]>
```

### `updateNote(id, note)`

```typescript
const updated = await repository.updateNote('uuid-here', {
  content: 'Updated note content',
});
```

### `deleteNote(id)`

```typescript
await repository.deleteNote('uuid-here');
```

## Link Methods

### `createLink(link)`

```typescript
const link = await repository.createLink({
  source_id: 'uuid1',
  target_id: 'uuid2',
  relation: 'inspires',
});
```

### `getAllLinks(options?)`

```typescript
const links = await repository.getAllLinks({ limit: 100, offset: 0 });
```

### `getBacklinks(entityId)`

```typescript
const backlinks = await repository.getBacklinks('uuid-here');
// Returns entities that link TO this entity
```

### `getBacklinkCount(entityId)`

```typescript
const count = await repository.getBacklinkCount('uuid-here');
```

### `deleteLink(id)`

```typescript
await repository.deleteLink('uuid-here');
```

## Web Cache Methods

### `upsertWebCache(url, content, title?, format?)`

```typescript
await repository.upsertWebCache(
  'https://example.com',
  'Page content...',
  'Page Title',
  'markdown'
);
```

### `getWebCache(url)`

```typescript
const cached = await repository.getWebCache('https://example.com');
// Returns: { url, content, format, title, resolved_at } | null
```

## Graph Snapshot Methods

### `createSnapshot(name, nodes, edges, description?)`

```typescript
const snapshot = await repository.createSnapshot(
  'Graph v1',
  [{ id: 'n1', label: 'TRIZ' }, { id: 'n2', label: 'Innovation' }],
  [{ id: 'e1', source: 'n1', target: 'n2', label: 'inspires' }],
  'Initial graph state'
);
```

### `getSnapshot(id)`

```typescript
const snapshot = await repository.getSnapshot('uuid-here');
```

### `listSnapshots()`

```typescript
const snapshots = await repository.listSnapshots();
```

### `diffSnapshots(id1, id2)`

```typescript
const diff = await repository.diffSnapshots('uuid1', 'uuid2');
// Returns: { added_nodes, removed_nodes, added_edges, removed_edges }
```

## Types

```typescript
interface RankedResult {
  id: string;
  title: string;
  type: string;
  content: string;
  score: number;
  stage: string;
}

interface GraphSnapshotDiff {
  added_nodes: string[];
  removed_nodes: string[];
  added_edges: string[];
  removed_edges: string[];
}
```
