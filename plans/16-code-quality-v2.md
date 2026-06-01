# Plan 16: Code Quality Improvements — v2 (P1)

**GOAP Goal**: G-QUALITY  
**Priority**: P1  
**Estimated Total Effort**: 16-20 hours  
**GitHub Issues**: #190, #191, #192, #193, #196  
**ADRs**: ADR-005 (Error Handling), ADR-006 (Export Core Deduplication)  
**Supersedes**: Plan 02 (code-quality.md) — archived

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #193 | Improvement | Increase test coverage from ~25% to meaningful thresholds | HIGH |
| #190 | Improvement | Fix type safety — eliminate `as any` and unsafe casts | HIGH |
| #192 | Improvement | Fix error handling gaps across the codebase | HIGH |
| #191 | Improvement | Deduplicate export logic between ExportPanel.tsx and CLI | MEDIUM |
| #196 | Improvement | Fix documentation inconsistencies and stale references | MEDIUM |

## Dependency
**Prerequisite**: Plan 15 (G-CONFIG) — CI must be reliable before quality gates can be enforced.

## Tasks

### 16.1 Increase Test Coverage to 50% (Milestone toward 80%)
**Files**: `src/**/*.test.ts`, `src/**/__tests__/*.test.ts`  
**Issue**: #193 — Current coverage: Branches 14%, Functions 16%, Lines 25%, Statements 24%  
**Target**: ≥50% across all metrics (Phase 1), then iterate to 80%

**Action — Priority Targets (0% coverage):**
1. **ExportPanel** (security-critical): Test export generation, error states, format selection
2. **AIHarness** (complex async): Test chat send, streaming response, Orama context injection
3. **Chat.tsx**: Test message rendering, NoResultsState, entity creation navigation
4. **CLI commands**: Integration tests for `entity-create`, `claim-create`, `sync`, `--version`
5. **LLM providers** (`openrouter.ts`, `kilo.ts`): Test with mocked fetch, verify headers/URLs
6. **MindMapView, GraphView**: Test mount/unmount, basic interactions
7. **DbProvider, ErrorBoundary**: Test loading state, error state, children rendering

**Action — Partially tested:**
8. **search.ts**: Add tests for `initSearch()`, `removeFromSearchIndex()`, `upsertToSearchIndex()`
9. **nlp.ts**: Add edge case tests (empty input, special characters)
10. **resolver.ts**: Add error path tests

**Effort**: 8h (Phase 1)  
**Validation**:
- `pnpm run test:coverage` shows ≥50% for lines, functions, branches, statements
- All untested components have at least basic render/smoke tests
- Security-critical paths (export, LLM) have dedicated tests

---

### 16.2 Eliminate Type Safety Violations
**Files**: Multiple — see GitHub issue #190 for full list  
**Issue**: #190 — `as any`, `as unknown as`, file-level eslint-disable  
**Action**:

1. **Fix `as any` casts** (2 occurrences in `repository.ts:116,294`):
   - Define proper row type with `rowid` included
   - Remove cast: `(rows[0] as any).rowid` → typed query result

2. **Fix `as unknown as` double casts** (4 occurrences):
   - `search.ts:169,178`: Add `rowid` to search document schema
   - `MindMapView.tsx:103`: Create proper `.d.ts` for MindElixir constructor
   - `perf/components.tsx:15`: Define proper PerformanceEntry type

3. **Fix file-level eslint-disable** (2 files):
   - `cli/index.ts`: Fix each `@typescript-eslint/no-unsafe-*` individually instead of disabling at file level
   - `cli/db.ts`: Fix `@typescript-eslint/no-unsafe-return` with proper types

4. **Fix unsafe casts** (3 occurrences):
   - `repository.ts:253`: Replace `as Array<Record<string, unknown>>` with Zod schema
   - `repository.ts:741`: Replace `as GraphSnapshot` with Zod parse
   - `search.ts:206`: Replace `(r as { type: string }).type` with proper type guard

**Effort**: 4h  
**Validation**:
- `grep -r "as any" src/ --include="*.ts" --include="*.tsx"` returns zero
- `grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx"` returns zero
- No file-level `eslint-disable @typescript-eslint/no-unsafe-*` remains

---

### 16.3 Fix Error Handling Gaps
**Files**: Multiple — see GitHub issue #192 for full list  
**Issue**: #192 — Silently swallowed errors, missing error handling  
**ADR**: ADR-005 (Error Handling Architecture)  
**Action**:

1. **Create `AppError` class and audit all catch blocks**:
   - `search.ts:546-548` — `progressiveSearch` silent catch → log + rethrow as `AppError`
   - `repository.ts:641-643` — `upsertWebCache` → throw on failure instead of silent log
   - `repository.ts:668-670` — `getWebCache` → distinguish "not found" (null) from "error" (throw)
   - `search.ts:59-63` — `initEmbeddings` → throw on failure, check return in callers
   - `client.ts:38-50` — `getSchema` → throw on failure instead of empty string
   - `llm/config.ts:29-32` — `loadConfig` → throw on parse error instead of silent fallback

2. **Add missing error handling**:
   - `AIHarness.tsx:40-131` — wrap `handleSend` in error boundary
   - `Editor.tsx:103-192` — show detailed error message on save failure
   - `ExportPanel.tsx` — add error state UI with retry button
   - `App.tsx:142` — sanitize error display (don't render raw error strings)
   - `cli/index.ts:63` — wrap `fs.readdirSync` in try/catch
   - `cli/index.ts` — add `closeDb()` on process exit

3. **Connection pool validation**:
   - `connection-pool.ts:161-177` — verify new worker is functional before resolving

**Effort**: 5h  
**Validation**:
- All catch blocks either rethrow `AppError` or provide user feedback
- Export panel shows error state with retry button
- CLI closes DB connection on exit
- Connection pool validates new workers

---

### 16.4 Deduplicate Export Logic
**Files**: `src/lib/export-core.ts` (new), `src/features/export/ExportPanel.tsx`, `cli/index.ts`  
**Issue**: #191 — Export logic duplicated between browser and CLI  
**ADR**: ADR-006 (Export Core Deduplication)  
**Action**:

1. Create `src/lib/export-core.ts`:
   - `generateSiteHtml(entities, claims, notes, links): string`
   - `generateEntityHtml(entity, claims): string`
   - `generateMarkdownExport(entities, claims): string`
   - `generateJsonExport(entities, claims, notes, links): string`
   - Batch query helper: `getAllClaimsWithNotes()`

2. Update `ExportPanel.tsx` to call shared core functions

3. Update `cli/index.ts` to call shared core functions

4. Remove duplicated HTML generation from both files

**Effort**: 3h  
**Validation**:
- Browser and CLI produce identical output for same input
- No inline HTML generation in either ExportPanel.tsx or cli/index.ts

---

### 16.5 Fix Documentation Inconsistencies
**Files**: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, stale JSDoc  
**Issue**: #196 — Stale references, version mismatches, unmet documentation promises  
**Action**:

1. Update `README.md`:
   - Fix any overstated feature claims (mark as WIP where necessary)
   - Update feature list to reflect current state
   - Fix broken relative links (issues, discussions)
   - Add status badge

2. Update `CHANGELOG.md` with missing entries for 0.2.3, 0.2.4

3. Add JSDoc coverage ≥40% for exported functions (milestone toward 80%):
   - `src/db/client.ts`: `initDb()`, `getDb()`
   - `src/db/repository.ts`: All CRUD operations
   - `src/lib/search.ts`: Key exported functions
   - `src/features/**/*.tsx`: Component props documentation

**Effort**: 3h  
**Validation**:
- No broken relative links in README
- No overstated feature claims
- JSDoc coverage >40% for exported items

---

## Completion Criteria
- [ ] Test coverage ≥50% (lines, branches, functions)
- [ ] Zero `as any` in production TypeScript
- [ ] Zero `as unknown as` double casts
- [ ] Zero file-level `eslint-disable` for TS safety rules
- [ ] `AppError` class used consistently across all error paths
- [ ] Export logic shared between browser and CLI
- [ ] Per-feature ErrorBoundaries in App.tsx
- [ ] README accurately reflects implementation status
- [ ] All quality gates pass: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`
