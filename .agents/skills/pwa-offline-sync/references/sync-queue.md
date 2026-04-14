# Sync Queue Design

Sync queue patterns for offline-first applications.

## Queue Structure
```ts
interface SyncEntry {
  id: string;        // UUID
  mutationId: string; // Dedup key
  entity: string;     // Table/collection name
  entityId: string;   // Record ID
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  timestamp: number;
  retryCount: number;
}
```

## Conflict Resolution
- Mutation IDs prevent duplicate replays
- Server timestamp for conflict detection
- Zombie detection: stop syncing revoked data
