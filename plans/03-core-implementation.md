# Plan 03: Core Implementation

**Priority**: P2 (Partial)  
**Estimated Total Effort**: 12-16 hours  
**Status**: 🟡 PARTIAL (2026-06-25) — CLI + export done, coverage 50% (target 70%)  
**Sources**: Swarm analysis - missing implementations

## Tasks

### 3.1 CLI Architecture Decision + Implementation
**File**: `cli/index.ts`  
**Issue**: CLI runs in Node.js but app uses SQLite WASM (browser-only), can't access OPFS database  
**Action**:
1. **Decision**: Choose one approach:
   - **Option A**: Build Node.js SQLite adapter using `better-sqlite3` with file-based sync format
   - **Option B**: Expose HTTP API from browser for CLI to call (complex, not local-first)
2. **Recommended**: Option A - create `cli/db.ts` with Node.js SQLite adapter
3. Implement CLI commands:
   - `sync <dir>`: Read markdown files, write to Node.js SQLite
   - `entity-create <name>`: Insert entity into DB
   - `claim-create <entity> <statement>`: Insert claim into DB
4. Add file-based sync: Browser imports from `sync/` directory
**Effort**: 6-8h  
**Dependencies**: None (independent task)  
**Validation**: `pnpm run cli -- --help` shows working commands, `sync` writes to DB

---

### 3.2 Real Export Functionality
**File**: `src/features/export/ExportPanel.tsx`  
**Issue**: Export is simulated with `setTimeout`, no real OPFS writes  
**Action**:
1. Implement Markdown export:
   - Query entities/claims from repository
   - Format as Markdown with frontmatter
   - Write to OPFS using `showSaveFilePicker()` or OPFS API
2. Implement JSON export:
   - Serialize entities/claims/notes/links with schema validation
   - Trigger download as `.json` file
3. Implement Static Site Export:
   - Create HTML template in `export/template.html`
   - Generate static pages from DB data
   - Use JSZip to create downloadable `.zip`
4. Update JobCoordinator to track real export progress
**Effort**: 4-6h  
**Dependencies**: OPFS utilities (can build alongside)  
**Validation**: Export buttons produce real files, `pnpm test` passes

---

### 3.3 Improve Test Coverage
**Files**: All `src/` files  
**Issue**: ~30% test coverage for critical paths  
**Action**:
1. Add tests for:
   - `src/lib/search.ts`: `removeFromSearchIndex()`, `initSearch()`
   - `src/features/editor/`: Editor save, TipTap extensions
   - `src/features/graph/`: Graph rendering, node selection
   - `src/lib/jobs.ts`: JobCoordinator queue, coalescing
2. Add E2E tests for export flow, CLI commands
3. Target: 70%+ coverage overall, 80%+ for critical paths
**Effort**: 2-3h  
**Dependencies**: 3.1 and 3.2 (test real implementations)  
**Validation**: `pnpm run test:coverage` meets targets

---

## CLI Architecture Decision Record

**Date**: 2026-04-23  
**Decision**: Option A - Node.js SQLite Adapter with File-Based Sync  
**Rationale**:
- Preserves local-first architecture (no HTTP server)
- File-based sync is simpler than browser-to-CLI communication
- `better-sqlite3` is mature, fast, and widely used
- Aligns with AGENTS.md CLI command specs

**Implementation Steps**:
1. Install `better-sqlite3` as dev dependency
2. Create `cli/db.ts` mirroring `src/db/client.ts` but for Node.js
3. Create `cli/sync.ts` for markdown → SQLite sync
4. Update `cli/index.ts` to use real DB adapter
5. Add `sync/` directory for file-based sync between CLI and browser

---

## Completion Criteria
- [x] CLI commands work with real Node.js SQLite adapter
- [x] Export buttons produce real Markdown/JSON/static site files
- [ ] Test coverage meets targets (70% overall, 80% critical)
- [ ] All quality gates pass: `pnpm test`, `pnpm run lint`, `pnpm run typecheck`
