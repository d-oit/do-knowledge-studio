# Plan 36: Documentation Overhaul

**GOAP Goal**: G-DOCS  
**Priority**: P1 (9 high-priority documentation gaps)  
**Estimated Total Effort**: 12-16 hours  
**Source**: `analysis/SWARM_ANALYSIS.md` — Documentation perspective  
**Date**: 2026-05-31

## Issue Summary

| Gap | Priority | Effort |
|-----|----------|--------|
| CLI commands undocumented | High | 2-3h |
| No JSDoc on .tsx files | High | 3-4h |
| No database schema docs | High | 2-3h |
| No search architecture docs | High | 1-2h |
| No developer onboarding guide | High | 2-3h |
| LLM provider config undocumented | High | 1-2h |
| No deployment guide | High | 1-2h |
| Repository API undocumented | High | 1-2h |
| VERSION/CHANGELOG sync broken | High | 0.5h |

## Tasks

### 36.1 CLI Reference Documentation
**Files**: `docs/CLI.md` (new)  
**Action**:

1. Create comprehensive CLI reference:
   ```markdown
   # CLI Reference
   
   ## Commands
   
   ### `init`
   Initialize a new knowledge base.
   ```bash
   pnpm run cli -- init
   ```
   
   ### `sync <path|url>`
   Sync markdown files or URLs into the knowledge base.
   ```bash
   pnpm run cli -- sync ./notes
   pnpm run cli -- sync https://example.com/article
   ```
   
   [etc. for all 17+ commands]
   ```

2. Add examples for each command.

3. Document flags and options.

4. Add troubleshooting section.

**Effort**: 2-3h  
**Validation**:
- All commands documented
- Examples work
- Troubleshooting covers common issues

---

### 36.2 JSDoc for Exported Components
**Files**: All `.tsx` files in `src/features/`, `src/components/`, `src/app/`  
**Action**:

1. Add JSDoc to all exported React components:
   ```typescript
   /**
    * GraphView - Interactive knowledge graph visualization.
    * 
    * Renders entities as nodes and links as edges using Sigma.js.
    * Supports force-directed, circular, and hierarchical layouts.
    * 
    * @param props.entities - Array of entities to display
    * @param props.links - Array of links between entities
    * @param props.onNodeClick - Callback when a node is clicked
    * @param props.focusMode - Whether to show only selected node's neighborhood
    */
   ```

2. Add JSDoc to complex hooks:
   - `useFocusTrap` — focus management for accessibility
   - `useGraphKeyboardNavigation` — keyboard controls for graph
   - `useRateLimiter` — rate limiting for API calls

3. Add JSDoc to Zod schemas:
   - `EntitySchema` — entity validation rules
   - `ClaimSchema` — claim validation rules
   - `NoteSchema` — note validation rules
   - `LinkSchema` — link validation rules

**Effort**: 3-4h  
**Validation**:
- All exported components have JSDoc
- Props are documented
- Complex logic has inline comments

---

### 36.3 Database Schema Documentation
**Files**: `docs/DATABASE.md` (new)  
**Action**:

1. Create entity-relationship diagram:
   ```
   entities ──< claims
   entities ──< notes
   entities ──< links (source_id)
   entities ──< links (target_id)
   entities ──< graph_snapshots
   ```

2. Document each table:
   ```markdown
   ## entities
   
   | Column | Type | Constraints | Description |
   |--------|------|-------------|-------------|
   | id | TEXT | PRIMARY KEY | UUID |
   | name | TEXT | NOT NULL | Entity name |
   | type | TEXT | NOT NULL | Entity type (note, concept, person, project) |
   | content | TEXT | | Entity content (Markdown) |
   | metadata | TEXT | | JSON metadata |
   | created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation time |
   | updated_at | TEXT | | Last update time |
   ```

3. Document FTS5 virtual tables.

4. Document migration system.

**Effort**: 2-3h  
**Validation**:
- ER diagram is accurate
- All columns documented
- Migration system explained

---

### 36.4 Search Architecture Documentation
**Files**: `docs/SEARCH.md` (new)  
**Action**:

1. Document dual search system:
   ```markdown
   # Search Architecture
   
   ## Overview
   The search system uses a dual approach:
   - **FTS5**: Full-text search for exact keyword matching
   - **Orama**: Vector search for semantic similarity
   
   ## Search Pipeline
   1. User query → exact match (FTS5)
   2. If no results → semantic search (Orama)
   3. If no results → related entities (link traversal)
   
   ## Ranking Algorithm
   - Exact match: BM25 score
   - Semantic: Cosine similarity
   - Hybrid: Weighted average (configurable)
   ```

2. Document Orama schema and embedding model.

3. Document job queue for index updates.

**Effort**: 1-2h  
**Validation**:
- Search pipeline documented
- Ranking algorithm explained
- Configuration options listed

---

### 36.5 Developer Onboarding Guide
**Files**: `docs/DEVELOPMENT.md` (new)  
**Action**:

1. Create codebase walkthrough:
   ```markdown
   # Development Guide
   
   ## Architecture Overview
   [diagram]
   
   ## Key Abstractions
   - **Repository**: Data access layer
   - **ConnectionPool**: SQLite WASM worker management
   - **JobCoordinator**: Async job processing
   - **Orama**: Vector search engine
   
   ## How to Add a Feature
   1. Create `src/features/<name>/<Name>.tsx`
   2. Add lazy import in `App.tsx`
   3. Add view type to `View` union
   4. Add route in the view switch
   
   ## Common Debugging Patterns
   - SQLite worker issues: Check `ConnectionPool` logs
   - Search issues: Check Orama index state
   - Export issues: Check `ExportPanel` and `export-core.ts`
   ```

2. Add setup instructions.

3. Add testing instructions.

4. Add contribution guidelines.

**Effort**: 2-3h  
**Validation**:
- New contributors can understand codebase
- Common tasks are documented
- Debugging patterns are clear

---

### 36.6 LLM Provider Configuration Guide
**Files**: `docs/LLM-SETUP.md` (new)  
**Action**:

1. Document provider configuration:
   ```markdown
   # LLM Setup
   
   ## Providers
   
   ### OpenRouter
   1. Get API key from https://openrouter.ai
   2. Open Settings in the app
   3. Select "OpenRouter" provider
   4. Enter API key
   
   ### Kilo Gateway
   [similar]
   
   ## Model Selection
   - Free models: [list]
   - Paid models: [list]
   
   ## Environment Variables
   - `VITE_LLM_API_KEY`: Default API key
   - `VITE_LLM_API_BASE_URL`: Custom base URL
   ```

2. Add troubleshooting section.

**Effort**: 1-2h  
**Validation**:
- All providers documented
- Setup steps are clear
- Troubleshooting covers common issues

---

### 36.7 Deployment Guide
**Files**: `docs/DEPLOYMENT.md` (new)  
**Action**:

1. Document deployment options:
   ```markdown
   # Deployment
   
   ## Static Export
   ```bash
   pnpm run build
   # Output in dist/
   ```
   
   ## Hosting Platforms
   ### Netlify
   [steps]
   
   ### Vercel
   [steps]
   
   ### GitHub Pages
   [steps]
   
   ## Self-Hosting
   [steps]
   
   ## Browser Requirements
   - HTTPS required for OPFS
   - Chrome 86+, Firefox 111+, Safari 15.2+
   ```

2. Document OPFS browser requirements.

**Effort**: 1-2h  
**Validation**:
- Deployment steps work
- Browser requirements documented
- Self-hosting instructions clear

---

### 36.8 Repository API Documentation
**Files**: `docs/REPOSITORY-API.md` (new)  
**Action**:

1. Document all public methods:
   ```markdown
   # Repository API
   
   ## Entity Methods
   
   ### `createEntity(data: CreateEntityInput): Promise<Entity>`
   Creates a new entity.
   
   **Parameters:**
   - `data.name`: Entity name (required)
   - `data.type`: Entity type (note, concept, person, project)
   - `data.content`: Entity content (Markdown)
   - `data.metadata`: JSON metadata
   
   **Returns:** Created entity with ID and timestamps.
   
   **Throws:** `AppError` if validation fails.
   ```

2. Document error codes and their meanings.

**Effort**: 1-2h  
**Validation**:
- All methods documented
- Parameters and return types clear
- Error codes explained

---

### 36.9 Fix VERSION/CHANGELOG Sync
**Files**: `VERSION`, `CHANGELOG.md`, `README.md`  
**Action**:

1. Update `VERSION` file to `0.2.3`.

2. Update README badge to match.

3. Add version propagation script to CI:
   ```bash
   # scripts/propagate-version.sh
   VERSION=$(cat VERSION)
   sed -i "s/version-[0-9.]*/version-$VERSION/g" README.md
   ```

**Effort**: 0.5h  
**Validation**:
- VERSION file matches CHANGELOG
- README badge shows correct version

---

## Completion Criteria

- [ ] CLI reference documents all 17+ commands
- [ ] All exported components have JSDoc
- [ ] Database schema has ER diagram
- [ ] Search architecture documented
- [ ] Developer onboarding guide exists
- [ ] LLM setup guide exists
- [ ] Deployment guide exists
- [ ] Repository API documented
- [ ] VERSION/CHANGELOG in sync
- [ ] All quality gates pass

## Dependencies

- 36.3 (database docs) benefits from 34.1 (repository split)
- 36.4 (search docs) benefits from 34.4 (search split)
- 36.8 (repository API) benefits from 34.5 (IRepository interface)
