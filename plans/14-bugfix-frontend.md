# Plan 14: Frontend Bugfixes (P0)

**GOAP Goal**: G-STABILITY  
**Priority**: P0 (Fix immediately)  
**Estimated Total Effort**: 4-6 hours  
**GitHub Issues**: #171, #175, #176, #177, #178, #179, #180

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #175 | Bug | "Library" sidebar nav item points to non-existent view | **HIGH** |
| #176 | Bug | "Create new entity" button in Chat does nothing | **HIGH** |
| #171 | Bug | GraphInspector component defined but never rendered | **HIGH** |
| #177 | Bug | MIGRATION.md badge shows 0.2.4, VERSION says 0.1.0 | **HIGH** |
| #180 | Bug | CLI version hardcoded, not synced with VERSION file | MEDIUM |
| #179 | Bug | pre-commit-hook.sh references deleted QUICKSTART.md | MEDIUM |
| #178 | Bug | Broken discussions URL in ISSUE_TEMPLATE config | MEDIUM |

## Tasks

### 14.1 Fix "Library" Sidebar Nav
**File**: `src/components/SidebarNav.tsx`  
**Issue**: #175 — Library nav item points to non-existent view component  
**Action**:
1. Determine if a Library view should exist:
   - If yes: Create `src/features/library/LibraryView.tsx` with basic entity listing
   - If no: Remove the Library nav item from `SidebarNav.tsx`
2. If removing:
   - Remove `{ label: 'Library', path: '/library', icon: Library }` from nav items
   - Remove any route definition for `/library` in `App.tsx`
3. If adding:
   - Create minimal `LibraryView.tsx` with `getAllEntities()` grid
   - Add route in `App.tsx`
   - Component must be lazy-loaded (`React.lazy`)
**Effort**: 1h  
**Validation**: Nav item navigates to a working view; no routing errors

---

### 14.2 Fix "Create New Entity" Button
**File**: `src/features/chat/Chat.tsx`  
**Issue**: #176 — NoResultsState button has no `onClick` handler  
**Action**:
1. Line ~98: Add `onClick` handler to the button in `NoResultsState`:
   ```tsx
   onClick={() => navigate('/editor?action=create')}
   ```
2. Ensure the Editor route accepts query params for pre-populated entity name
3. If navigation to editor doesn't exist, create simple flow: open entity creation dialog
**Effort**: 1h  
**Validation**: Clicking the button navigates to entity creation flow

---

### 14.3 Handle GraphInspector Dead Code
**File**: `src/features/graph/GraphInspector.tsx`, `src/features/graph/GraphView.tsx`  
**Issue**: #171 — Component is defined but never imported/rendered  
**Action**:
1. Check if GraphInspector is intended functionality:
   - If useful: Import and render it in `GraphView.tsx` (e.g., as sidebar on node select)
   - If dead: Remove the entire file and any references
2. Decision: Based on codebase analysis, GraphInspector appears designed to show metadata about selected graph nodes. Render it as a conditional panel:
   ```tsx
   {selectedNode && <GraphInspector node={selectedNode} />}
   ```
**Effort**: 0.5h  
**Validation**: No dead components remain (verify with `npm run lint` dead-code detection)

---

### 14.4 Fix Version Inconsistencies
**Files**: `MIGRATION.md`, `VERSION`, `cli/index.ts`  
**Issue**: #177 — MIGRATION.md badge shows 0.2.4, VERSION says 0.1.0  
**Issue**: #180 — CLI `--version` reads hardcoded value, not VERSION file  
**Action**:
1. Update `MIGRATION.md` badge to match `VERSION` file (0.1.0):
   ```markdown
   ![Version](https://img.shields.io/badge/version-0.1.0-blue)
   ```
2. Fix CLI to auto-read VERSION file:
   ```typescript
   import { readFileSync } from 'fs';
   const version = readFileSync('./VERSION', 'utf-8').trim();
   ```
   Instead of hardcoded `'0.1.0'` string
**Effort**: 1h  
**Validation**: All version references match `VERSION` file; `cli --version` returns correct value

---

### 14.5 Fix Pre-Commit Hook QUICKSTART.md Reference
**File**: `.husky/pre-commit` or `.git/hooks/pre-commit` or `scripts/pre-commit-hook.sh`  
**Issue**: #179 — References deleted QUICKSTART.md  
**Action**:
1. Find the reference: `grep -r "QUICKSTART" . --include="*.sh"`
2. Replace with correct file reference or remove the line
**Effort**: 0.5h  
**Validation**: `grep -r "QUICKSTART" . --include="*.sh"` returns zero

---

### 14.6 Fix Broken Discussions URL
**File**: `.github/ISSUE_TEMPLATE/config.yml`  
**Issue**: #178 — Discussions URL broken  
**Action**:
1. Update `discussions` URL to correct value:
   ```yaml
   discussions: https://github.com/d-oit/do-knowledge-studio/discussions
   ```
2. Verify URL is accessible
**Effort**: 0.5h  
**Validation**: Discussions link in issue templates navigates correctly

---

## Completion Criteria
- [ ] "Library" nav either works or is removed
- [ ] "Create new entity" button opens entity creation flow
- [ ] GraphInspector is either rendered or removed
- [ ] All version references match `VERSION` file (0.1.0)
- [ ] CLI `--version` auto-reads from VERSION file
- [ ] No QUICKSTART.md references in hook scripts
- [ ] Discussions URL in issue template is valid
- [ ] `npm run typecheck` and `npm test` pass
