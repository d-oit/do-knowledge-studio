# Search Architecture

Knowledge Studio uses a dual-index search system: SQLite **FTS5** for
exact, low-latency keyword matching, and in-memory **Orama** for fuzzy
plus optional semantic ranking. A job queue keeps both indexes in sync
with the canonical data in `entities`, `claims`, and `notes`.

## Overview

```
User Query
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ progressiveSearch(query, onResults)                  │
│                                                      │
│  Stage 1: searchKnowledge(query)  ── exact / FTS5    │
│       │  onResults(hits, 'exact')                    │
│       ▼                                              │
│  Stage 2: semanticSearch(query)   ── Orama hybrid    │
│       │  onResults(hits, 'semantic') [optional]      │
│       ▼                                              │
│  Stage 3: repository.searchRelated(query)            │
│       │  onResults(hits, 'related')                  │
└──────────────────────────────────────────────────────┘
    │
    ▼
RankedResult[] (deduped by id, ordered by stage)
```

## Search Pipeline

1. **FTS5 Full-Text Search** — Porter-stemmed, Unicode-aware keyword
   matching via SQLite FTS5 virtual tables. The fastest stage and the
   one that almost always returns first.
2. **Orama Semantic / Hybrid Search** — In-memory Orama index with
   optional `@orama/plugin-embeddings` for hybrid (BM25 + vector)
   ranking. Activated only when the embeddings plugin loads
   successfully.
3. **Link Traversal** — Falls back to entities connected via the
   `links` table so the user always sees *something* relevant. Excludes
   IDs already shown in earlier stages.

### FTS5 Indexes

Three contentless virtual tables back the exact-match stage:

| Table | Source columns | Tokenizer | Populated by |
|-------|---------------|-----------|--------------|
| `entity_search_idx` | `entities.name`, `entities.description` | `porter unicode61` | `upsertToSearchIndex` |
| `claim_search_idx` | `claims.statement` | `porter unicode61` | `upsertToSearchIndex` |
| `note_search_idx` | `notes.content` | `porter unicode61` | `upsertNoteToSearchIndex` |

Each row in an FTS5 table is keyed by the source `rowid` so deletes
cascade from the underlying relational table.

### Orama Index

Orama provides in-browser vector and BM25 search. The schema is fixed
in `src/lib/search/orama-index.ts`:

```typescript
export const searchSchema = {
  id: 'string',
  type: 'string',          // 'entity' | 'claim' | 'note'
  title: 'string',         // Entity name or claim statement
  content: 'string',       // Compressed text (HTML stripped, stop-words removed)
  keywords: 'string',      // Type, source, entity_id, etc.
  embedding: 'vector[384]', // Optional, populated by embeddings plugin
} as const;
```

Documents are compressed before indexing by
`compressText()` in `src/lib/nlp.ts`:

1. Strip HTML tags
2. Remove English stop words (pre-compiled regex)
3. Trim to a 200-character window at a word boundary

The result is a smaller index footprint and more relevant hits on
short queries.

### Embedding Model

When `@orama/plugin-embeddings` loads successfully, the plugin uses
`Xenova/all-MiniLM-L6-v2` (384-dimensional sentence embeddings) and
hybrid search is enabled (`semantic: 0.5, fulltext: 0.5`). The
embeddings are computed lazily on the first search after a fresh
index. If the plugin fails to load, search silently falls back to
BM25 only.

## Search Functions

| Function | Purpose |
|----------|---------|
| `initSearch()` | One-time hydration of Orama from the database (chunks of 100 entities, yields to the event loop between chunks). Also calls `hydrateFts5Index()`. |
| `searchKnowledge(query, options?)` | Run an Orama BM25 search over the `title` and `content` properties. Returns `RankedResult[]`. |
| `semanticSearch(query, options?)` | Hybrid (vector + BM25) search. Falls back to `searchKnowledge` when embeddings are unavailable. |
| `progressiveSearch(query, onResults, options?)` | Stage 1 → 2 → 3 pipeline that emits results via the `onResults(stage, hits)` callback as soon as each stage completes. |
| `upsertToSearchIndex(entityId)` | Re-index a single entity and its claims (debounced 500 ms). Updates both Orama and FTS5. |
| `upsertNoteToSearchIndex(noteId)` | Re-index a single note. |
| `removeFromSearchIndex(entityId, ...)` | Drop an entity and its claims from Orama and FTS5. |

### Result Shape

Every search returns `RankedResult` (from `src/db/repository/types.ts`):

```typescript
interface RankedResult {
  id: string;        // Source row UUID
  title: string;
  type: 'entity' | 'claim' | 'note';
  content: string;   // Compressed snippet
  score: number;     // Orama score
  stage: 'exact' | 'semantic' | 'related' | 'verified' | 'draft' | 'final';
}
```

The `stage` field is enriched for claims by mapping
`verification_status` to `'verified'` / `'final'` (disputed) / `'draft'`
(unverified) so the UI can badge results by provenance.

## Ranking Algorithm

| Stage | Algorithm | Weight |
|-------|-----------|--------|
| 1 (FTS5/Orama BM25) | Orama BM25 over `title` and `content` | `1.0` (default) |
| 2 (semantic) | Hybrid: `0.5 × vector cosine + 0.5 × BM25` | tunable per provider |
| 3 (related) | Recency-ordered link traversal, deduped against earlier stages | implicit |

Search options accepted by `searchKnowledge` and `semanticSearch`:

```typescript
{
  type?: 'entity' | 'claim' | 'note'; // pre-filter the index
  limit?: number;                     // default 20
  signal?: AbortSignal;               // cooperative cancellation
}
```

## Job Queue Integration

Search index updates run through `JobCoordinator` (`src/lib/jobs.ts`)
which serializes work, coalesces duplicates, and surfaces metrics.
Job types related to search:

| Job Type | Handler | When enqueued |
|----------|---------|---------------|
| `external-fetch` | resolves a URL and hydrates an entity | AI Harness URL ingestion |
| `reindex-document` | `upsertToSearchIndex` for an entity id | Editor save / entity update |
| `refresh-search-index` | `clearOramaDb()` + `initSearch()` | Manual full rebuild |

Jobs targeting the same `(type, targetId)` are coalesced so rapid
edit bursts only trigger one reindex at the end. The
`JobMetrics` chip in the header (`src/components/JobMetrics.tsx`)
exposes queue depth, wait, and execution times for diagnostics.

## NLP Processing

Text preprocessing lives in `src/lib/nlp.ts`:

```typescript
compressText(text, maxLength = 200)
  → stripHtml(text)         // Remove HTML tags
  → removeStopWords(text)   // Remove common English words
  → trim to maxLength       // Cut at a word boundary
```

The function is pure, has no runtime dependencies, and is shared
between the Orama indexer and the optional `extractEntities` LLM
helper to keep the on-screen "related" suggestions consistent with
what the search engine can match.

## Configuration

| Knob | Default | Where |
|------|---------|-------|
| FTS5 tokenizer | `porter unicode61` | migrations |
| Orama schema | `searchSchema` constant | `orama-index.ts` |
| Compression max length | 200 chars | `nlp.ts` |
| Embedding model | `Xenova/all-MiniLM-L6-v2` | `orama-index.ts` |
| Hybrid weights | `semantic 0.5, fulltext 0.5` | `progressive.ts` |
| Reindex debounce | 500 ms | `progressive.ts` |
| Result limit | 20 | `progressive.ts` |

## Performance

Indicative numbers for the in-memory Orama index after first hydration
(measured on commodity hardware, late-2025 Chrome):

| Operation | Time |
|-----------|------|
| `initSearch()` (1000 entities, 5000 claims, 500 notes) | ~6–10 s |
| `searchKnowledge()` (cached index) | <50 ms |
| `progressiveSearch()` (semantic stage) | 200–500 ms |
| `upsertToSearchIndex()` per entity | <50 ms |

The Orama index is hydrated lazily via `requestIdleCallback` from
`App.tsx`, so the initial UI render is not blocked by indexing work.
The FTS5 indexes are populated synchronously from the migrations
script, then refreshed by `hydrateFts5Index()` after Orama finishes.

## Rebuilding the Index

To force a full rebuild of the in-app Orama + FTS5 indexes:

1. Open the AI Harness → Chat panel.
2. Click the settings gear.
3. Use the "Rebuild search index" action.

Or programmatically:

```typescript
import { clearOramaDb, initSearch, hydrateFts5Index } from './lib/search';

clearOramaDb();
await initSearch();      // rebuilds Orama from entities/claims/notes
await hydrateFts5Index(); // re-syncs FTS5 from the same source data
```
