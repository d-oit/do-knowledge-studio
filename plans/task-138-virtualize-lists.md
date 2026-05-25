# Task Plan — #138: Virtualize Graph-Adjacent Lists

> **Issue**: perf: virtualize graph-adjacent lists and cap large-view render cost
> **Priority**: P1 | **Independent**

## Goal

Ensure graph-adjacent lists (inspector, snapshots, search results, related notes) don't render all items at once. Virtualize long lists and add paging.

## Current State

- **SearchPanel.tsx**: Already uses `@tanstack/react-virtual` ✅ — well-implemented with `useVirtualizer`
- **GraphControls.tsx**: Snapshot list renders all items without virtualization — needs fix
- **GraphView.tsx**: No adjacent lists currently, but the inspector/selection info is minimal
- **SidebarNav.tsx**: Navigation list is small (6 items) — no virtualization needed

## Implementation Plan

### 1. Virtualize Snapshot List in GraphControls
- Add `@tanstack/react-virtual` (already a dependency, used in SearchPanel)
- Wrap snapshot list in virtualized container
- Maintain keyboard navigation and double-click behavior
- Keep diff selection working with virtualized items

### 2. Add "Show More" Defaults
- Cap initial snapshot display to 10 items
- Add "Show all N snapshots" button
- Use paging for very large snapshot collections

### 3. Verify Graph Inspector Performance
- Check `GraphInspector.tsx` for potential list rendering issues
- Add virtualization if relationship/claim lists can grow large

## Acceptance Criteria
- [ ] Large list views no longer render all rows/items by default
- [ ] Side panels remain responsive with large node counts
- [ ] Scroll performance improves measurably on large datasets
