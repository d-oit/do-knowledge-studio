# Plan 18: Core Feature Gap Closure (P2)

**GOAP Goal**: G-FEATURES  
**Priority**: P2  
**Estimated Total Effort**: 12-16 hours  
**GitHub Issues**: #181, #182, #183, #184, #197

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #181 | Feature | Add entity editing and deletion in the UI | HIGH |
| #183 | Feature | Add mind map node editing (add, rename, delete) | MEDIUM |
| #184 | Feature | Add force-directed and hierarchical graph layout algorithms | MEDIUM |
| #182 | Feature | Add keyboard-accessible graph navigation | MEDIUM |
| #197 | Improvement | Fix accessibility gaps across the application | MEDIUM |

## Dependency
**Prerequisite**: Plan 16 (G-QUALITY) partially complete — codebase should be type-safe and have basic test coverage.

## Tasks

### 18.1 Entity Editing in UI
**Files**: `src/features/editor/Editor.tsx`, `src/features/graph/GraphView.tsx`, `src/features/entity/EntityDetail.tsx`  
**Issue**: #181 — `repository.updateEntity()` and `repository.deleteEntity()` exist but have no UI  
**Action**:

1. **Edit button on entity detail views**:
   - Add "Edit" icon button to entity card/detail component
   - On click, load entity into Editor with pre-populated fields
   - Save triggers `repository.updateEntity()`

2. **Delete button with confirmation dialog**:
   - Add "Delete" icon button (red, trash icon)
   - On click, show confirmation dialog: "Are you sure? This will also delete all claims and links for this entity."
   - Confirm triggers `repository.deleteEntity()`
   - Navigate away after deletion (to home or entity list)

3. **Keyboard shortcut**:
   - `Delete` key on selected entity shows confirmation dialog
   - `Enter` on selected entity opens editor

4. **Search index update**:
   - After edit: call `upsertToSearchIndex(entity, claims)`
   - After delete: call `removeFromSearchIndex(entityId)`

**Effort**: 3.5h  
**Validation**:
- Entity editing and deletion work end-to-end
- Search index updates after edits/deletes
- Confirmation dialog prevents accidental deletion
- E2E test: create → edit → delete flow passes

---

### 18.2 Mind Map Node Editing
**Files**: `src/features/mindmap/MindMapView.tsx`, `src/lib/mindmap.ts`  
**Issue**: #183 — Mind map nodes can't be edited (add, rename, delete)  
**Action**:

1. **Click-to-rename**:
   - Double-click on a mind map node opens inline text editing
   - On blur/enter, save new name via `repository.updateEntity()`
   - Update mind map data without full re-render

2. **Context menu**:
   - Right-click on node shows context menu:
     - "Add Child Node" → creates new entity with parent link
     - "Rename" → triggers inline editing
     - "Delete" → with confirmation, removes node and children
   - Use MindElixir's built-in context menu API or custom implementation

3. **Keyboard shortcuts**:
   - `Tab` on selected node → add child
   - `Delete` → delete with confirmation
   - `F2` → rename

**Effort**: 3h  
**Validation**:
- Mind map nodes can be added, renamed, and deleted
- Changes persist to SQLite database
- Undo/redo does not break after edits
- Mind map visual tree updates correctly after edits

---

### 18.3 Graph Layout Algorithms
**Files**: `src/features/graph/GraphView.tsx`, `src/lib/graph-layout.ts`  
**Issue**: #184 — Only one graph layout available  
**Action**:

1. **Force-directed layout** (existing — enhance with parameters):
   - Expose Sigma.js `forceAtlas2` settings (gravity, scaling, slowDown)
   - Add layout control panel in GraphControls.tsx
   - Show running/cooling state indicator

2. **Hierarchical layout** (new):
   - Use `dagre` library or implement simple layered layout
   ```bash
   pnpm add dagre @types/dagre
   ```
   - Rank entities by link direction/type
   - Assign levels: entities with incoming links rank higher
   - Apply `graphology-layout-dagre` or custom `graphology-layout` worker

3. **Layout toggle UI**:
   - Dropdown/buttons in GraphControls.tsx
   - "Force-Directed" | "Hierarchical" | "Radial" (if applicable)
   - Re-layout on toggle without full graph re-render

**Effort**: 3h  
**Validation**:
- Layout toggle switches between force-directed and hierarchical
- Hierarchical layout correctly ranks entities by link direction
- Layout changes are smooth on graphs with 100+ nodes

---

### 18.4 Keyboard-Accessible Graph Navigation
**Files**: `src/features/graph/GraphView.tsx`, `src/features/graph/GraphControls.tsx`  
**Issue**: #182 — Graph cannot be navigated with keyboard  
**Action**:

1. **Node navigation**:
   - `Tab` / `Shift+Tab`: cycle through visible nodes
   - Focus ring on currently selected node (high-contrast, visible)
   - `Enter` / `Space`: select/focus node
   - `Escape`: deselect current node

2. **Graph interaction**:
   - Arrow keys: pan the graph viewport
   - `+` / `-`: zoom in/out
   - `Home`: reset view (fit all nodes)
   - Delete: delete selected entity (with confirmation)

3. **Focus management**:
   - Trap focus within graph container when active
   - Skip link: provide "Skip to graph" landmark
   - ARIA attributes: `role="graph"`, `aria-label="Knowledge Graph"`

4. **Screen reader announcements**:
   - On node select: announce entity name, type, claim count
   - On layout change: announce new layout type
   - On error: announce error message

**Effort**: 2.5h  
**Validation**:
- Full graph navigation possible without mouse
- Screen reader announces node information on selection
- Focus ring meets 3:1 contrast ratio minimum
- All keyboard controls documented

---

### 18.5 Accessibility Improvements
**Files**: Multiple — comprehensive audit  
**Issue**: #197 — Accessibility gaps across the application  
**Action**:

1. **Automated audit**:
   - Run axe-core or Lighthouse accessibility audit
   - Document all violations per WCAG 2.2 AA

2. **Priority fixes**:
   - Color contrast: All text meets 4.5:1 ratio (normal) / 3:1 (large)
   - Focus indicators: All interactive elements have visible focus styles
   - ARIA labels: All icon buttons have `aria-label`
   - Form labels: All inputs have associated labels
   - Heading hierarchy: Proper h1-h6 structure on all views
   - Landmarks: `main`, `nav`, `search` landmarks on each page

3. **Screen reader testing**:
   - Test with VoiceOver (macOS) and NVDA (Windows)
   - Fix any missing announcements or confusing navigation

4. **Mobile accessibility**:
   - 44x44px minimum tap targets (AGENTS.md guardrail)
   - Touch targets not overlapping
   - Sufficient spacing between interactive elements

**Effort**: 3h  
**Validation**:
- axe-core automated audit: zero critical/serious violations
- All interactive elements have visible focus indicators
- Color contrast meets WCAG 2.2 AA
- All icon buttons have `aria-label`
- Tap targets ≥44x44px on mobile views

---

## Completion Criteria
- [ ] Entity editing and deletion available in UI with confirmation dialog
- [ ] Mind map nodes can be added, renamed, deleted via click/keyboard
- [ ] Graph layout toggle switches between force-directed and hierarchical
- [ ] Graph is fully navigable via keyboard (Tab, arrows, Enter, Escape)
- [ ] Automated axe-core audit passes with zero critical/serious violations
- [ ] All interactive elements have visible focus indicators
- [ ] All icon buttons have `aria-label`
- [ ] Tap targets ≥44x44px on mobile
- [ ] All quality gates pass: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`
