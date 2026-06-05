# Search Architecture

The knowledge studio uses a **dual search system** combining SQLite FTS5 for exact keyword matching with Orama for fuzzy/semantic search. Results are merged into a unified ranked list via progressive search.

---

## Overview

```
User Query
    │
    ▼
┌─────────────────────┐
│  Progressive Search  │
│  (progressive.ts)    │
└────────┬────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌──────────┐
│  FTS5  │  │  Orama   │
│ (SQLite)│  │(in-memory)│
└────────┘  └──────────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────────┐
│  Ranked Results      │
│  (merged & scored)   │
└─────────────────────┘
```

---

## Search Stages

### Stage 1: FTS5 Exact Match

SQLite's FTS5 virtual tables provide fast keyword search with porter stemming.

**Tables:**
- `entity_search_idx` — indexes entity `name` and `description`
- `claim_search_idx` — indexes claim `statement`

**Configuration:**
- Tokenizer: `porter unicode61` (stemming + Unicode support)
- Mode: Contentless (`content=''`) — no positional info for ~2x faster queries
- Detail: `none` — no column or position data stored

**Usage:**
```sql
SELECT * FROM entity_search_idx WHERE entity_search_idx MATCH 'search query';
```

FTS5 is the first search stage. If results are found, they're returned immediately. If empty, the system falls back to Stage 2.

### Stage 2: Orama Fuzzy/Semantic Search

Orama is an in-memory search engine that provides:
- **Fuzzy matching** — handles typos and partial matches
- **BM25 scoring** — relevance ranking
- **Vector embeddings** — semantic similarity (when embeddings are initialized)

**Index Schema** (`orama-index.ts`):
```typescript
{
  id: 'string',
  name: 'string',
  type: 'string',
  content: 'string',
}
```

**Lifecycle:**
1. On app startup, `hydrateOramaIndex()` is called (deferred via `requestIdleCallback`)
2. All entities and claims are loaded from SQLite into the Orama index
3. The index is kept in sync via the Job Coordinator (`reindex-document` job)

### Stage 3: Related Entities

If both FTS5 and Orama return empty results, the system searches for related entities by:
1. Finding entities that share claims or links with search terms
2. Scoring by relationship strength

---

## Progressive Search

The `progressiveSearch()` function orchestrates all three stages:

```typescript
async function progressiveSearch(
  query: string,
  callback: ProgressiveSearchCallback,
): Promise<void>
```

**Callback stages:**
1. `stage: 'fts5'` — FTS5 results arrive first (fast)
2. `stage: 'orama'` — Orama results arrive second
3. `stage: 'related'` — Related entity results arrive last

This gives users immediate results while more comprehensive results load.

---

## Search Entry Points

### `searchKnowledge(query)`

The primary search function used by the AI Harness and Chat. Returns `RankedResult[]` with combined FTS5 + Orama results.

### `semanticSearch(query)`

Orama-only search for fuzzy/semantic matching. Used when FTS5 is unavailable.

### `progressiveSearch(query, callback)`

Streaming search that calls back with results as each stage completes. Used by the Search Panel UI.

---

## Indexing Pipeline

### Initial Hydration

On app startup:
1. `hydrateOramaIndex()` is called (deferred to avoid blocking UI)
2. Loads all entities and claims from SQLite
3. Builds the Orama in-memory index

### Incremental Updates

When entities or claims change:
1. The `JobCoordinator` queues a `reindex-document` job
2. Jobs are coalesced (multiple updates to the same entity become one job)
3. The handler calls `upsertToSearchIndex(entityId)` which updates both FTS5 and Orama

### External Content

When URLs are resolved:
1. The `external-fetch` job handler fetches content via Jina AI reader
2. Content is cached in the `web_cache` table
3. The entity's search index entry is updated with the fetched content

---

## NLP Utilities

Located in `src/lib/search/nlp.ts`:

- **`stripHtml(html)`** — Remove HTML tags
- **`removeStopWords(text)`** — Remove common English stop words
- **`compressText(text, maxLength)`** — Strip HTML + stop words, truncate

These are used during indexing to improve search quality.

---

## Performance Considerations

- FTS5 queries are sub-millisecond for typical datasets
- Orama hydration is deferred to idle time (`requestIdleCallback`)
- Index updates are coalesced to avoid redundant work
- The Orama index is rebuilt on every app start (no persistence to OPFS yet)

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/search/progressive.ts` | Progressive search orchestrator |
| `src/lib/search/orama-index.ts` | Orama index management |
| `src/lib/search/fts5-hydrator.ts` | FTS5 index hydration |
| `src/lib/search/external-fetch.ts` | External URL content fetching |
| `src/lib/search/nlp.ts` | NLP utilities (stop words, compression) |
| `src/lib/jobs.ts` | Job Coordinator for background indexing |
