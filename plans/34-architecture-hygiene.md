# Plan 34: Architecture Hygiene — File Decomposition

**GOAP Goal**: G-ARCHITECTURE  
**Priority**: P1 (Violates explicit 500 LOC hard rule)  
**Estimated Total Effort**: 16-20 hours  
**Source**: `analysis/SWARM_ANALYSIS.md` — Architecture perspective  
**Date**: 2026-05-31

## Issue Summary

| File | LOC | Limit | Over By | Priority |
|------|-----|-------|---------|----------|
| `src/db/repository.ts` | 957 | 500 | +457 | High |
| `src/features/graph/GraphView.tsx` | 793 | 500 | +293 | High |
| `src/features/ai/AIHarness.tsx` | 600 | 500 | +100 | High |
| `src/lib/search.ts` | 555 | 500 | +55 | Medium |

## Tasks

### 34.1 Split repository.ts (957 → ~5 modules)
**Files**: `src/db/repository.ts` → `src/db/repository/`  
**Action**:

1. Create `src/db/repository/` directory:
   ```
   src/db/repository/
     index.ts          — Re-exports Repository class
     base.ts           — Shared utilities (parseMetadata, transaction helpers)
     entities.ts       — Entity CRUD (create, read, update, delete, list)
     claims.ts         — Claim CRUD + verification
     notes.ts          — Note CRUD
     links.ts          — Link CRUD + backlinks
     graph-snapshots.ts — Snapshot save/load/diff
     web-cache.ts      — Web cache operations
   ```

2. Extract `IRepository` interface to `src/db/repository/types.ts`:
   ```typescript
   export interface IRepository {
     createEntity(data: CreateEntityInput): Promise<Entity>;
     getEntity(id: string): Promise<Entity | null>;
     // ... all public methods
   }
   ```

3. Update `Repository` class to extend base and compose submodules.

4. Update all imports across codebase to use new paths.

**Effort**: 6-8h  
**Validation**:
- All existing tests pass
- No circular dependencies
- Each submodule < 200 LOC
- IRepository interface is complete

---

### 34.2 Split GraphView.tsx (793 → ~5 modules)
**Files**: `src/features/graph/GraphView.tsx` → `src/features/graph/`  
**Action**:

1. Extract layout algorithms to `src/lib/graph-layout.ts`:
   - `computeForceAtlas2Layout(graph)`
   - `computeCircularLayout(graph)`
   - `computeHierarchicalLayout(graph)`

2. Extract keyboard navigation to `src/features/graph/GraphKeyboardNav.ts`:
   - `useGraphKeyboardNavigation(graphRef, nodes)`

3. Extract touch handling to `src/features/graph/GraphTouchHandler.ts`:
   - `useGraphTouchGestures(graphRef)`

4. Extract snapshot management to `src/features/graph/GraphSnapshotManager.ts`:
   - `useGraphSnapshots(graph, repository)`

5. Keep `GraphView.tsx` as composition of above modules (< 300 LOC).

**Effort**: 5-6h  
**Validation**:
- Graph renders correctly with all layouts
- Keyboard navigation works
- Touch gestures work on mobile
- Snapshot save/load works

---

### 34.3 Split AIHarness.tsx (600 → ~4 modules)
**Files**: `src/features/ai/AIHarness.tsx` → `src/features/ai/`  
**Action**:

1. Extract chat view to `src/features/ai/ChatView.tsx`:
   - Message list, input, streaming display

2. Extract settings wizard to `src/features/ai/SettingsWizard.tsx`:
   - Provider selection, API key input, model selection

3. Extract rate limiter to `src/features/ai/useRateLimiter.ts`:
   - `useRateLimiter(windowMs, threshold)` hook

4. Extract chat logic to `src/features/ai/useChat.ts`:
   - `useChat(provider, searchFn)` hook

5. Keep `AIHarness.tsx` as composition (< 200 LOC).

**Effort**: 4-5h  
**Validation**:
- AI chat works with streaming
- Settings wizard saves config
- Rate limiting prevents abuse
- All features compose correctly

---

### 34.4 Split search.ts (555 → ~4 modules)
**Files**: `src/lib/search.ts` → `src/lib/search/`  
**Action**:

1. Create `src/lib/search/` directory:
   ```
   src/lib/search/
     index.ts           — Re-exports
     orama-index.ts     — Orama index creation and management
     progressive.ts     — Progressive search (exact → semantic → related)
     fts5-hydrator.ts   — FTS5 index hydration
     external-fetch.ts  — URL fetch job handler
   ```

2. Extract job handler registration to explicit init function:
   ```typescript
   export function registerSearchHandlers(jobCoordinator: JobCoordinator): void {
     jobCoordinator.registerHandler('external-fetch', handleExternalFetch);
   }
   ```

3. Update imports across codebase.

**Effort**: 3-4h  
**Validation**:
- Search works end-to-end
- Progressive search cascades correctly
- External fetch job handler works
- No side-effect imports

---

### 34.5 Define IRepository Interface
**Files**: `src/db/repository/types.ts` (new), all feature components  
**Action**:

1. Create comprehensive `IRepository` interface in `src/db/repository/types.ts`.

2. Update `DbProvider` to expose repository instance via context:
   ```typescript
   const DbContext = createContext<{ repository: IRepository } | null>(null);
   ```

3. Update feature components to consume repository from context instead of importing singleton.

4. Remove direct `import { repository }` from feature components.

**Effort**: 3-4h  
**Validation**:
- Repository is injectable for testing
- No feature components import repository singleton
- All tests pass with mock repository

---

## Completion Criteria

- [ ] All 4 files under 500 LOC
- [ ] IRepository interface defined and used
- [ ] No circular dependencies introduced
- [ ] All existing tests pass
- [ ] Feature components use context for repository
- [ ] No side-effect imports in search module
- [ ] All quality gates pass

## Dependencies

- 34.5 (IRepository) should be done first — enables 34.1
- 34.1 (repository split) enables better testing for all features
- 34.2-34.4 can be done in parallel after 34.1
