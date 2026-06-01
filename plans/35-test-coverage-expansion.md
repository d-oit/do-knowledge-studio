# Plan 35: Test Coverage Expansion

**GOAP Goal**: G-TESTING  
**Priority**: P1 (Critical gaps identified in swarm analysis)  
**Estimated Total Effort**: 20-28 hours  
**Source**: `analysis/SWARM_ANALYSIS.md` — Test coverage perspective  
**Date**: 2026-05-31

## Issue Summary

| Module | LOC | Current Tests | Gap |
|--------|-----|---------------|-----|
| `src/features/mindmap/MindMapView.tsx` | 415 | 0 | Critical |
| `cli/index.ts` + `cli/db.ts` | 685 | 0 | Critical |
| `src/features/graph/GraphView.tsx` | 793 | 0 | High |
| `src/features/editor/ClaimExtension.ts` | ~200 | 0 | High |
| `src/features/editor/MentionExtension.ts` | ~200 | 0 | High |
| `src/hooks/useFocusTrap.ts` | 45 | 0 | High |
| `src/lib/llm/markdown.tsx` | 126 | 0 | High |
| `src/app/App.tsx` | 307 | 0 | Medium |
| `src/db/DbProvider.tsx` | ~100 | 0 | Medium |
| `tests/e2e/` | — | Smoke only | High |

## Tasks

### 35.1 Mind Map Unit Tests (CRITICAL)
**Files**: `src/features/mindmap/__tests__/MindMapView.test.tsx` (new)  
**Action**:

1. Extract `buildTree()` to `src/lib/mindmap-tree.ts` for isolated testing.

2. Add tests for `buildTree()`:
   - Empty entities array → empty tree
   - Single entity → single root node
   - Parent-child links → correct tree structure
   - Depth limit respected
   - Relation filtering (only outgoing links)
   - Null/undefined entity handling
   - Circular reference protection

3. Add tests for `addAriaToNodes()`:
   - Adds aria attributes to mind map nodes
   - Handles empty node list

4. Add tests for operation handlers:
   - `handleAddChild` creates entity and link
   - `handleRename` updates entity name
   - `handleDelete` removes entity and links
   - Error handling for failed operations

**Effort**: 4-5h  
**Validation**:
- All `buildTree()` edge cases covered
- Operation handlers persist correctly
- Accessibility helpers work

---

### 35.2 CLI Tests (CRITICAL)
**Files**: `cli/__tests__/` (new directory)  
**Action**:

1. Create `cli/__tests__/db.test.ts`:
   - Database initialization with temp file
   - Schema creation
   - Connection close

2. Create `cli/__tests__/commands.test.ts`:
   - `entity-create` → entity exists in DB
   - `entity-list` → returns correct entities
   - `entity-get` → returns correct entity
   - `entity-update` → entity is updated
   - `entity-delete` → entity is removed
   - `claim-create` → claim exists
   - `link-create` → link exists
   - `note-create` → note exists
   - `search` → returns results
   - `db:status` → shows migration status
   - `db:backup` → creates backup file

3. Use Commander's programmatic API for testing.

4. Test error paths:
   - Missing entity ID
   - Invalid arguments
   - File not found
   - Database initialization failure

**Effort**: 5-6h  
**Validation**:
- All CLI commands work with temp database
- Error messages are helpful
- Exit codes are correct

---

### 35.3 Graph View Tests (HIGH)
**Files**: `src/features/graph/__tests__/GraphView.test.tsx` (new)  
**Action**:

1. Extract graph data transformation to `src/lib/graph-data.ts`:
   - `buildGraphologyInstance(entities, links)`
   - `computeLayout(graph, type)`

2. Add tests for `buildGraphologyInstance()`:
   - Empty arrays → empty graph
   - Entities → nodes with correct attributes
   - Links → edges with correct direction
   - Duplicate handling

3. Add tests for GraphControls:
   - Save snapshot → snapshot exists in DB
   - Load snapshot → graph state restored
   - Snapshot diff → correct differences shown

4. Add tests for GraphInspector:
   - Entity details display correctly
   - Claims list renders
   - Relations list renders

**Effort**: 4-5h  
**Validation**:
- Graph data transformation is correct
- Snapshot operations work
- Inspector displays correct data

---

### 35.4 Editor Extension Tests (HIGH)
**Files**: `src/features/editor/__tests__/ClaimExtension.test.ts`, `MentionExtension.test.ts`  
**Action**:

1. Test ClaimExtension:
   - Extension registers correctly
   - Input rule matches claim syntax
   - Node view renders
   - Claim creation triggers repository call

2. Test MentionExtension:
   - Extension registers correctly
   - Suggestion popup appears on `@`
   - Filtering works correctly
   - Selection creates mention link
   - Keyboard navigation in suggestion list

3. Mock TipTap editor state for isolated testing.

**Effort**: 3-4h  
**Validation**:
- Extensions register and work
- Input rules match correctly
- Suggestion popup filters and selects

---

### 35.5 Quick Win Tests (HIGH)
**Files**: Multiple  
**Action**:

1. `src/hooks/__tests__/useFocusTrap.test.ts`:
   - Tab wraps from last to first
   - Shift+Tab wraps from first to last
   - Previous focus restored on unmount
   - No focus management when inactive
   - Handles empty focusable elements

2. `src/lib/llm/__tests__/markdown.test.ts`:
   - Heading levels (h1-h6)
   - Unordered and ordered lists
   - Code blocks (fenced)
   - Inline bold, italic, strikethrough, code
   - Links with target="_blank"
   - XSS vectors in markdown
   - Unclosed code blocks
   - Empty input

3. `src/db/__tests__/DbProvider.test.tsx`:
   - Renders children when ready
   - Shows error state on failure
   - Throws when used outside provider

**Effort**: 2-3h  
**Validation**:
- Focus trap accessibility works
- Markdown renders correctly
- DbProvider handles all states

---

### 35.6 E2E Test Expansion (HIGH)
**Files**: `tests/e2e/`  
**Action**:

1. `tests/e2e/entity-crud.spec.ts`:
   - Create entity → verify appears in list
   - Edit entity → verify changes persist
   - Delete entity → verify removed
   - Search entity → verify appears in results

2. `tests/e2e/search-navigation.spec.ts`:
   - Search for entity → click result → verify editor opens with entity

3. `tests/e2e/graph-interaction.spec.ts`:
   - Click node → verify selection
   - Toggle focus mode → verify filtering
   - Save snapshot → verify persistence

4. `tests/e2e/mindmap-interaction.spec.ts`:
   - Click node → verify selection
   - Add child → verify creation
   - Rename node → verify update

5. `tests/e2e/export.spec.ts`:
   - Click export → verify file download
   - Verify exported content is valid

**Effort**: 4-6h  
**Validation**:
- All critical user journeys covered
- Tests run in CI
- No flaky tests

---

### 35.7 Raise Coverage Thresholds
**Files**: `vitest.config.ts`  
**Action**:

1. Update coverage thresholds:
   ```typescript
   thresholds: {
     branches: 40,
     functions: 50,
     lines: 50,
     statements: 50,
   }
   ```

2. Add coverage badge to README.

3. Set up coverage reporting in CI.

**Effort**: 1h  
**Validation**:
- Thresholds enforced in CI
- Coverage badge shows current percentage

---

## Completion Criteria

- [ ] Mind map has 80%+ unit test coverage
- [ ] CLI has 80%+ test coverage
- [ ] Graph view has 70%+ test coverage
- [ ] Editor extensions have 70%+ test coverage
- [ ] useFocusTrap, markdown, DbProvider have tests
- [ ] E2E covers CRUD, search, graph, mindmap, export
- [ ] Coverage thresholds raised to 40-50%
- [ ] All quality gates pass

## Dependencies

- 35.3 (graph tests) benefits from 34.2 (GraphView split)
- 35.4 (extension tests) benefits from 34.3 (AIHarness split)
- 35.6 (E2E) depends on features being wired (Plan 33)
- 35.7 (thresholds) should be done last
