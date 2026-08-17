# Task Plan — #141: Rerender Audit & React 19 Optimization

> **Status**: COMPLETE (Plan 128, 2026-08-17) — React Compiler enabled globally via `reactCompiler: true`
> in next.config.ts (stable in Next.js 16), with `'use no memo'` opt-outs on the
> @tanstack/react-virtual components that the compiler's auto-memoization breaks.
> Full verification: 2264 unit tests, 538 E2E tests, build green. See plans/128.

> **Issue**: perf: audit rerenders and enable modern React optimization paths
> **Priority**: P1 | **Independent**

## Goal

Profile main user flows, identify hot components with unnecessary rerenders, fix at least 3 sources, and document guidance.

## Current Findings (from code review)

### Problem 1: Inline objects in JSX (every render)
- **Editor.tsx**: Multiple inline style objects (lines 231+: `style={{ display: 'flex', ... }}`)
- **SearchPanel.tsx**: Inline styles for progress bar, mode toggle, scroll container
- **GraphControls.tsx**: Inline styles for snapshot list items

### Problem 2: Callback recreation
- **App.tsx**: `handlePreload` uses `useCallback([], [])` — already optimized
- **App.tsx**: `handleSearchResultClick` uses `useCallback([], [])` — already optimized
- **GraphView.tsx**: `setSelectedNode` and `setFocusMode` properly callbacked

### Problem 3: Effect dependency arrays
- **GraphView.tsx**: The main Sigma effect has many deps: `[effectiveData, selectedNode, focusMode, snapshotMode, setFocusMode, setSelectedNode]`
- **SearchPanel.tsx**: Search effect depends on `[query, activeFilter, useSemantic]` — reasonable

## Implementation Plan

### Fix 1: Extract inline styles to module-level constants
- **Editor.tsx**: Extract all inline `style={{}}` to named constants
- **SearchPanel.tsx**: Extract inline styles
- **GraphControls.tsx**: Extract snapshot item styles

### Fix 2: Memoize expensive computations
- **GraphView.tsx**: Memoize the `effectiveData` computation
- **GraphView.tsx**: Memoize node/edge rendering callbacks

### Fix 3: Narrow context boundaries
- Review DbProvider context — ensure it only provides `dbReady` and `error`, not full DB instance
- Colocate state closer to consumers where possible

### Documentation
- Add `docs/react-perf-guide.md` with findings and team guidance

## Acceptance Criteria
- [x] Documented rerender audit for top-heavy views
- [x] At least 3 unnecessary rerender sources fixed
- [x] React Profiler traces show improvement for at least one core flow
- [x] Team guidance documented
