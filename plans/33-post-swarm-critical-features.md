# Plan 33: Post-Swarm Critical Feature Gaps

**GOAP Goal**: G-FEATURES-V2  
**Priority**: P0 (Critical gaps from 2026-05-31 swarm analysis)  
**Estimated Total Effort**: 20-28 hours  
**Source**: `analysis/SWARM_ANALYSIS.md` — 6-agent parallel analysis  
**Date**: 2026-05-31

## Issue Summary

| # | Gap | Priority | Effort |
|---|-----|----------|--------|
| FG-C1 | No Library/Entity Browser view | Critical | 6-8h |
| FG-C2 | Search results don't navigate to entities | Critical | 0.5h |
| FG-C4 | No backlinks/bidirectional linking | Critical | 4-6h |
| FG-C3 | CLI uses separate database | Critical | 4-6h |
| FG-H10 | Chat is search-only, not LLM-powered | High | 2-3h |
| FG-H1 | Minimal editor toolbar | High | 2-3h |
| FG-H12 | No version history / undo-redo | High | 3-4h |

## Tasks

### 33.1 Library/Entity Browser View (CRITICAL)
**Files**: `src/features/library/LibraryView.tsx` (new), `src/app/App.tsx`, `src/components/SidebarNav.tsx`  
**Gap**: FG-C1 — Library nav routes to editor, no list view  
**Action**:

1. Create `src/features/library/LibraryView.tsx`:
   - Entity list with virtual scrolling (`@tanstack/react-virtual`)
   - Type filter chips (note, concept, person, project)
   - Sort by name, created_at, updated_at
   - Search input with debounce
   - Click entity → navigate to editor with entity loaded
   - Pagination or infinite scroll for large datasets

2. Update `src/app/App.tsx`:
   - Add `library` to `View` union type
   - Add lazy import for `LibraryView`
   - Route `currentView === 'library'` to `LibraryView`

3. Update `src/components/SidebarNav.tsx`:
   - Change Library route from `editor` to `library`

4. Add repository methods:
   - `getEntitiesPaginated(offset, limit, type?, sortBy?, search?)`
   - `getEntityCount(type?)`

**Effort**: 6-8h  
**Validation**:
- Library view shows all entities with type badges
- Filtering by type works
- Sorting by name/date works
- Clicking entity opens it in editor
- Virtual scrolling handles 1000+ entities

---

### 33.2 Search → Editor Navigation (CRITICAL)
**Files**: `src/app/App.tsx:97-103`  
**Gap**: FG-C2 — handleSearchResultClick switches view without loading entity  
**Action**:

1. Update `handleSearchResultClick` in `AppContent`:
   ```typescript
   const handleSearchResultClick = useCallback((result: SearchResult) => {
     setEditingEntityId(result.id);
     setCurrentView('editor');
     setIsSearchOpen(false);
   }, []);
   ```

2. Ensure `Editor` component uses `editingEntityId` to load and display the entity.

**Effort**: 0.5h  
**Validation**:
- Click search result → editor opens with that entity loaded
- Entity content, claims, and metadata display correctly
- Back button or navigation returns to previous state

---

### 33.3 Backlinks / Bidirectional Linking (CRITICAL)
**Files**: `src/db/repository.ts`, `src/features/editor/Editor.tsx`, `src/features/graph/GraphInspector.tsx`  
**Gap**: FG-C4 — Mentions create one-way links only  
**Action**:

1. Add `getBacklinks(entityId)` to repository:
   ```typescript
   async getBacklinks(entityId: string): Promise<Link[]> {
     return this.db.exec({
       sql: 'SELECT * FROM links WHERE target_id = ?',
       bind: [entityId],
       rowMode: 'object',
     });
   }
   ```

2. Add `getBacklinkCount(entityId)` for badge display.

3. Update `GraphInspector.tsx`:
   - Show "Referenced by" section with backlink entities
   - Display backlink count badge

4. Update `Editor.tsx`:
   - Show "Backlinks" section below entity content
   - List entities that reference this one
   - Click backlink → navigate to that entity

5. Consider auto-reverse links:
   - When creating a mention link A→B, optionally create B→A
   - Add UI toggle for "Create reverse link"

**Effort**: 4-6h  
**Validation**:
- Creating mention A→B shows B in A's backlinks
- GraphInspector shows "Referenced by" for entities with backlinks
- Editor shows backlinks section
- Backlink count badge displays correctly

---

### 33.4 CLI Database Unification (CRITICAL)
**Files**: `cli/db.ts`, `cli/index.ts`  
**Gap**: FG-C3 — CLI uses `.studio-cli.db`, browser uses OPFS  
**Action**:

1. **Option A (Recommended)**: Share database file
   - Move CLI database to `~/.local/share/do-knowledge-studio/data.db`
   - Add configuration option for database path
   - Document shared database location

2. **Option B**: Bidirectional sync
   - Add `cli sync-db` command to sync between CLI and browser databases
   - Use SQLite export/import

3. Update `cli/db.ts`:
   ```typescript
   const DB_PATH = process.env.DKS_DB_PATH || 
     path.join(os.homedir(), '.local/share/do-knowledge-studio/data.db');
   ```

4. Add database lock mechanism to prevent concurrent writes.

**Effort**: 4-6h  
**Validation**:
- CLI and browser app show same entities
- No data corruption from concurrent access
- Database path is configurable

---

### 33.5 Wire Chat to LLM Providers (HIGH)
**Files**: `src/features/chat/Chat.tsx`, `src/lib/llm/`  
**Gap**: FG-H10 — Chat is search-only, not LLM-powered  
**Action**:

1. Update `Chat.tsx` to use LLM providers:
   - Import `loadConfig`, `createProvider` from `src/lib/llm/config.ts`
   - On user message: search knowledge base + send to LLM with context
   - Use streaming for real-time responses

2. Add message history persistence:
   - Store conversations in localStorage or SQLite
   - Load previous messages on mount

3. Update chat UI:
   - Show typing indicator during LLM response
   - Display source citations from search results
   - Add "Clear conversation" button

**Effort**: 2-3h  
**Validation**:
- Chat responds with LLM-generated answers
- Search results are used as context
- Streaming responses display correctly
- Conversation persists across page reloads

---

### 33.6 Expand Editor Toolbar (HIGH)
**Files**: `src/features/editor/Editor.tsx:248-281`  
**Gap**: FG-H1 — Minimal toolbar, no italic/lists/code/links  
**Action**:

1. Add toolbar buttons using existing TipTap StarterKit extensions:
   - Italic (Ctrl+I)
   - Bullet List
   - Ordered List
   - Code Block
   - Blockquote
   - Link (with URL input popover)
   - Horizontal Rule

2. Add keyboard shortcut tooltips on hover.

3. Add "More formatting" dropdown for less common options.

**Effort**: 2-3h  
**Validation**:
- All toolbar buttons work (italic, lists, code, links)
- Keyboard shortcuts function correctly
- Toolbar is responsive on mobile
- Formatting persists in editor content

---

### 33.7 Add Undo/Redo (HIGH)
**Files**: `src/features/editor/Editor.tsx`, `src/features/graph/GraphView.tsx`, `src/features/mindmap/MindMapView.tsx`  
**Gap**: FG-H12 — No undo/redo anywhere  
**Action**:

1. **Editor**: Enable TipTap History extension
   - Add undo/redo buttons to toolbar
   - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)

2. **Graph**: Implement operation stack
   - Track node additions, deletions, moves
   - Ctrl+Z reverts last operation
   - Max stack size: 50 operations

3. **Mind Map**: Use MindElixir built-in undo if available
   - Otherwise implement operation stack similar to graph

4. Add undo/redo buttons to main toolbar (global).

**Effort**: 3-4h  
**Validation**:
- Ctrl+Z undoes last edit in all views
- Ctrl+Shift+Z redoes
- Undo/redo buttons show correct state (disabled when stack empty)
- Operations are reversible without data loss

---

## Completion Criteria

- [ ] Library view shows all entities with filtering and sorting
- [ ] Search results navigate to entity in editor
- [ ] Backlinks appear in editor and graph inspector
- [ ] CLI and browser share same database
- [ ] Chat uses LLM providers for AI responses
- [ ] Editor toolbar has italic, lists, code, links
- [ ] Undo/redo works in editor, graph, and mind map
- [ ] All quality gates pass: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`
- [ ] E2E tests cover new features

## Dependencies

- 33.2 (search navigation) → 33.1 (library view) — both need entity loading
- 33.3 (backlinks) → 33.1 (library view) — library should show backlink counts
- 33.5 (Chat LLM) → 33.2 (search navigation) — chat needs search context
- 33.7 (undo/redo) → all other tasks — should be implemented last
