# Plan 02: Code Quality Improvements (P1)

**Priority**: P1 (High priority)  
**Estimated Total Effort**: 8-10 hours  
**Sources**: Swarm analysis - code quality audit

## Tasks

### 2.1 Add Repository Tests (CRITICAL)
**Files**: `src/db/repository.ts`, `src/db/__tests__/repository.test.ts`  
**Issue**: ~70% of critical DB paths untested  
**Action**:
1. Create `src/db/__tests__/repository.test.ts` with tests for:
   - `createEntity()`, `getEntity()`, `updateEntity()`, `deleteEntity()`
   - `createClaim()`, `getClaimsByEntityId()`
   - `createNote()`, `createLink()`
2. Mock SQLite WASM client for tests
3. Achieve 80%+ coverage for repository.ts
**Effort**: 3-4h  
**Validation**: `npm run test:coverage` shows 80%+ for repository.ts

---

### 2.2 Extract Duplicated Search Logic
**File**: `src/lib/search.ts`  
**Issue**: `initSearch()` and `upsertToSearchIndex()` contain ~70 lines of near-identical code  
**Action**:
1. Extract shared helper:
   ```typescript
   function addEntityToIndex(oramaDb: Orama<SearchDocument>, entity: Entity, claims: Claim[]): void {
     // Insert entity document
     // Insert associated claim documents
   }
   ```
2. Refactor `initSearch()` and `upsertToSearchIndex()` to use helper
3. Consider `Promise.all` for parallel claim insertion
**Effort**: 2-3h  
**Validation**: No duplicated code blocks, `npm run lint` passes

---

### 2.3 Replace Double Casts with Validation
**Files**: `src/lib/search.ts`, `src/db/repository.ts`, `src/db/client.ts`  
**Issue**: `as unknown as X` double casts defeat TypeScript type checking  
**Action**:
1. Replace all `as unknown as Type` with Zod validation:
   ```typescript
   // Before:
   const data = await response.json() as unknown as Record<string, string>;
   
   // After:
   const schema = z.record(z.string(), z.string());
   const data = schema.parse(await response.json());
   ```
2. Add Zod schemas for all runtime-parsed data
**Effort**: 3-4h  
**Validation**: No `as unknown` casts remain, `npm run typecheck` passes

---

### 2.4 Add Granular ErrorBoundaries
**File**: `src/app/App.tsx`, `src/components/ErrorBoundary.tsx`  
**Issue**: Single ErrorBoundary wraps all features, no isolation  
**Action**:
1. Add per-feature ErrorBoundaries in `App.tsx`:
   ```tsx
   <Route path="/editor" element={<ErrorBoundary><Editor /></ErrorBoundary>} />
   <Route path="/graph" element={<ErrorBoundary><GraphView /></ErrorBoundary>} />
   ```
2. Update `ErrorBoundary.tsx` to use `logger` instead of `console.error`
**Effort**: 2h  
**Validation**: Feature crash doesn't break entire app

---

### 2.5 Add Timeout to Connection Pool
**File**: `src/db/connection-pool.ts:90-104`  
**Issue**: Event listeners leak if worker never responds  
**Action**:
1. Add 30s timeout to `sendToWorker`:
   ```typescript
   const timeout = setTimeout(() => {
     w.removeEventListener('message', handler);
     reject(new Error('Worker timeout'));
   }, 30000);
   
   w.addEventListener('message', (e) => {
     clearTimeout(timeout);
     // ... existing handler
   });
   ```
**Effort**: 1h  
**Validation**: Worker timeout throws error, no leaked listeners

---

## Completion Criteria
- [x] Repository tests cover 80%+ of critical paths
- [x] No duplicated search logic in search.ts
- [x] No `as unknown as X` double casts remain
- [x] Per-feature ErrorBoundaries implemented
- [x] Connection pool has worker timeout
- [x] All quality gates pass: `npm test`, `npm run lint`, `npm run typecheck`
