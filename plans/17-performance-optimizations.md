# Plan 17: Performance Optimizations (P2)

**GOAP Goal**: G-PERFORMANCE  
**Priority**: P2  
**Estimated Total Effort**: 10-14 hours  
**GitHub Issues**: #195

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #195 | Improvement | Fix performance concerns — memory, N+1 queries, unbounded caches, missing debounce | MEDIUM |

## Dependency
**Prerequisite**: Plan 16 (G-QUALITY) — codebase should be type-safe and tested before optimization.

## Tasks

### 17.1 Add Cursor-Based Pagination
**Files**: `src/db/repository.ts`, `src/app/App.tsx`  
**Issue**: `refreshData()` calls `getAllEntities()` + `getAllLinks()` loading everything into memory  
**Action**:
1. Add paginated queries to repository:
   ```typescript
   async function getAllEntitiesPaginated(options: {
     limit?: number;
     cursor?: string; // last entity ID
   }): Promise<{ entities: Entity[]; hasMore: boolean; nextCursor?: string }>;
   
   async function getAllLinksPaginated(options: {
     limit?: number;
     cursor?: string;
   }): Promise<{ links: Link[]; hasMore: boolean; nextCursor?: string }>;
   ```
2. Update `refreshData()` to use paginated queries with a reasonable page size (e.g., 100)
3. For views that need full dataset (graph, mind map), add explicit `loadAll` parameter with warning for large KBs
**Effort**: 2h  
**Validation**: Initial load of 1000 entities loads in pages, not all at once

---

### 17.2 Batch N+1 Queries in Export
**Files**: `src/db/repository.ts`, `src/lib/export-core.ts` (see ADR-006)  
**Issue**: Export loops over each entity calling `getClaimsByEntityId` + `getNotesByEntityId` sequentially  
**Action**:
1. Add batch query to repository:
   ```typescript
   async function getAllClaimsWithNotes(): Promise<
     Array<{ claim: Claim; notes: Note[] }>
   >;
   ```
2. Use in `export-core.ts` instead of per-entity sequential queries
3. Use a single SQL query with JOIN instead of N+1 individual queries
**Effort**: 1h  
**Validation**: Export with 500 entities completes in <1s (was N+1 seconds)

---

### 17.3 Add LRU Eviction to oramaIdMap
**File**: `src/lib/search.ts`  
**Issue**: `oramaIdMap` Map grows unbounded with no eviction  
**Action**:
1. Replace plain `Map` with LRU cache implementation:
   ```typescript
   class LRUMap<K, V> {
     private maxSize: number;
     private map: Map<K, V>;
     
     constructor(maxSize: number = 10000);
     get(key: K): V | undefined;
     set(key: K, value: V): void;
     // Evicts least-recently-used entry when exceeding maxSize
   }
   ```
2. Set max size to 10,000 entries
3. Ensure `removeFromSearchIndex()` correctly deletes from LRU map
**Effort**: 1h  
**Validation**: `oramaIdMap` never exceeds 10k entries; LRU entry evicted on overflow

---

### 17.4 Add Debounce to Chat Submit
**File**: `src/features/chat/Chat.tsx`  
**Issue**: #195 — No debounce on `handleSend` — rapid submissions could flood search  
**Action**:
1. Add 300ms debounce to `handleSend`:
   ```typescript
   import { useCallback, useRef } from 'react';
   
   const handleSend = useCallback(async (message: string) => {
     if (debounceRef.current) return;
     debounceRef.current = setTimeout(() => { debounceRef.current = null; }, 300);
     // existing logic
   }, [/* deps */]);
   ```
2. OR use a dedicated debounce hook:
   ```typescript
   const debouncedSend = useDebouncedCallback(handleSend, 300);
   ```
**Effort**: 0.5h  
**Validation**: Rapid clicks only trigger one search; 300ms cooldown between submits

---

### 17.5 Diff Graph Edges Instead of Clear/Re-Add
**File**: `src/features/graph/GraphView.tsx`  
**Issue**: #195 — `clearEdges()` on every update, then re-adds all edges  
**Action**:
1. Implement edge diffing:
   ```typescript
   function updateEdges(
     graph: Graph,
     newEdges: Edge[],
     existingEdges: Map<string, Edge>
   ): void {
     // Remove edges no longer in newEdges
     // Add edges not in existingEdges
     // Update edge attributes for changed edges
   }
   ```
2. Use `graph.export()` to get current edges, compare with new data
**Effort**: 2h  
**Validation**: Graph re-render with 1000 edges < 100ms (measured via `performance.now()`)

---

### 17.6 Lazy-Load @huggingface/transformers
**File**: `src/lib/search.ts`  
**Issue**: #195 — ~80MB model download loaded eagerly even if user never uses semantic search  
**Action**:
1. Move `import { pipeline } from '@huggingface/transformers'` to dynamic import:
   ```typescript
   async function loadEmbeddingsModel() {
     const { pipeline } = await import('@huggingface/transformers');
     return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
   }
   ```
2. Only call `loadEmbeddingsModel()` when user first enables semantic search
3. Show loading indicator during model download
4. Cache model reference for subsequent calls
**Effort**: 1h  
**Validation**: App loads without downloading transformers.js; model loads on first semantic search click

---

### 17.7 Virtualize Entity Mention Menu
**File**: `src/features/editor/Editor.tsx` (mention dropdown)  
**Issue**: #195 — `repository.getAllEntities().then(setAllEntities)` for mention menu — no virtualization  
**Action**:
1. Install `@tanstack/react-virtual`:
   ```bash
   pnpm add @tanstack/react-virtual
   ```
2. Replace flat entity list rendering with virtualized list:
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';
   
   const virtualizer = useVirtualizer({
     count: allEntities.length,
     getScrollElement: () => scrollRef.current,
     estimateSize: () => 40,
   });
   ```
3. Limit visible items to window height + buffer (~20 items)
4. Keep total entity list in state but only render visible window
**Effort**: 2h  
**Validation**: Mention dropdown with 5000 entities renders at <60fps (no jank)

---

## Completion Criteria
- [ ] `refreshData()` uses paginated queries
- [ ] Export uses batch query instead of N+1
- [ ] `oramaIdMap` LRU cache evicts at 10k entries
- [ ] Chat submit debounced at 300ms
- [ ] Graph edges diffed, not cleared/re-added
- [ ] `@huggingface/transformers` loaded lazily on first semantic search
- [ ] Entity mention menu virtualized with @tanstack/react-virtual
- [ ] All quality gates pass: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`
