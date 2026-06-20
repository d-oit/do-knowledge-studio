# Search Architecture

Knowledge Studio uses a dual search system: FTS5 for exact keyword matching and Orama for semantic similarity.

## Overview

```
User Query
    │
    ├─→ FTS5 (exact match) ──→ Results
    │       │
    │       └─→ No results ──→ Orama (semantic) ──→ Results
    │                               │
    │                               └─→ No results ──→ Link traversal ──→ Results
    │
    └─→ Progressive fallback chain
```

## Search Pipeline

1. **FTS5 Full-Text Search** — Porter-stemmed keyword matching via SQLite FTS5 virtual tables
2. **Orama Semantic Search** — Vector similarity search with optional embeddings
3. **Related Entities** — Graph traversal via link relationships

### FTS5 Index

Two virtual tables power keyword search:

| Table | Content | Tokenizer |
|-------|---------|-----------|
| `entity_search_idx` | Entity names + descriptions | `porter unicode61` |
| `claim_search_idx` | Claim statements | `porter unicode61` |

FTS5 indexes are contentless (`detail=none, content=''`) — they store only the index, not the original text. The actual data lives in the `entities` and `claims` tables.

### Orama Index

Orama provides in-browser vector search with BM25 ranking:

```typescript
// Schema definition (src/lib/search/orama-index.ts)
{
  id: 'string',
  type: 'string',      // 'entity' | 'claim'
  title: 'string',     // Entity name or claim statement
  content: 'string',   // Compressed text (stop words removed)
  keywords: 'string',  // Entity type, source, etc.
}
```

Documents are compressed before indexing:
- HTML tags stripped
- Stop words removed (pre-compiled regex)
- Trimmed to 200 characters

## Search Functions

### `initSearch()`

Initializes the Orama index by hydrating from the database:

```typescript
import { initSearch } from './search';
await initSearch(); // Loads all entities + claims into Orama
```

### `searchKnowledge(query, options?)`

Main search entry point — progressive fallback:

```typescript
const results = await searchKnowledge('TRIZ innovation');
// Returns: RankedResult[]
```

### `progressiveSearch(query, callback)`

Search with incremental results via callback:

```typescript
await progressiveSearch('TRIZ', (stage, results) => {
  console.log(`Stage: ${stage}, Found: ${results.length}`);
});
```

### `upsertToSearchIndex(entityId)`

Index a single entity and its claims:

```typescript
await upsertToSearchIndex('entity-uuid');
```

### `removeFromSearchIndex(entityId)`

Remove an entity from the search index:

```typescript
await removeFromSearchIndex('entity-uuid');
```

## Job Queue Integration

Search index updates are processed asynchronously via `JobCoordinator`:

| Job Type | Handler | Description |
|----------|---------|-------------|
| `external-fetch` | `handleExternalFetch` | Resolve URL, hydrate entity, update index |
| `reindex-document` | `upsertToSearchIndex` | Re-index a single entity |
| `refresh-search-index` | `clearOramaDb` + `initSearch` | Full reindex |

Jobs are deduplicated by type + targetId to prevent redundant work.

## NLP Processing

Text is preprocessed before indexing:

```typescript
// src/lib/nlp.ts
compressText(text, maxLength = 200)
  → stripHtml(text)        // Remove HTML tags
  → removeStopWords(text)  // Remove common English words
  → trim to maxLength      // Cut at word boundary
```

## Configuration

Search behavior is configured via:

- **FTS5 tokenizer**: `porter unicode61` (stemming + Unicode support)
- **Orama ranking**: BM25 with default parameters
- **Compression**: 200 character limit, stop word removal
- **Embeddings**: Optional, loaded via `@orama/plugin-embeddings` when available

## Performance

Search initialization benchmarks (1000 entities, 5000 claims):

| Operation | Time |
|-----------|------|
| `initSearch()` | ~10s (first load) |
| `searchKnowledge()` | <100ms |
| `upsertToSearchIndex()` | <50ms |

The Orama index is hydrated lazily via `requestIdleCallback` to avoid blocking the main thread.
