# Plan 170 — Graph Revision Comparison Overlay

**Date:** 2026-10-16  
**Status:** In progress  
**Related:** Plan 166 (Unscheduled feature candidate), Plan 157, Plan 169, [ADR 037](ADRs/037-url-addressable-view-state.md).

## Problem & Motivation

The knowledge graph view supports saving and restoring canvas snapshots (`src/lib/studio/graph-snapshot.ts`), which capture layout algorithm (`force`, `circular`, `hierarchical`), viewport transform (`panX`, `panY`, `zoom`), selected entity, focus mode, and timestamp. However:
1. Users who modify their knowledge library (adding/removing entities, linking/unlinking relations) or switch layouts have no visual way to compare what changed since the last saved snapshot without destructively restoring over current state.
2. Plan 166 identified **Graph revision comparison** as a high-value unscheduled candidate: diffing a stored snapshot against the current graph, listing added/removed entities and edges, in a read-only, non-destructive comparison dialog.

## Architectural Invariants & Requirements

1. **Read-Only Non-Destructive Diff**:
   - Comparison operates strictly read-only: snapshot data, current graph entities, and viewport remain unmodified while comparing.
   - If no snapshot is stored (`hasSnapshot: false`), the comparison trigger is disabled.
2. **Pure Diff Engine (`diffGraphSnapshot`)**:
   - Compare snapshot's saved metadata and entities against current library entities.
   - To support entity and topology diffing without breaking backwards compatibility with existing stored snapshots:
     - `GraphSnapshot` is extended with an optional `entityIds: string[]` and `edgeKeys: string[]` (e.g. `${sourceId}-${targetId}`).
     - When present in newer snapshots, exact set differences classify added, removed, and retained entities and connections.
     - When absent (backwards compatibility with existing v1 snapshots), the comparison presents viewport and layout delta (`layout`, `zoom`, `pan`, `focusMode`, `selectedEntityId`) and current topology context without crashing.
3. **Modal / Overlay UX & Accessibility**:
   - Triggered via a new toolbar button: `Compare with snapshot` (icon: `GitCompare` or `Diff`) with tooltip disclosure.
   - Accessible dialog (`role="dialog"`, `aria-labelledby`, `aria-describedby`, `Escape` to close, focus trap).
   - Theme tokens: Saffron (`--color-saffron`), ink/surface tokens, and semantic diff badges (green for added, red/muted for removed, saffron for modified viewport/layout).
   - Mobile responsive: fits within viewport with scrollable content.

## Implementation Steps

1. **Step 1: Diff Engine & Types (`src/lib/studio/graph-snapshot.ts`)**:
   - Extend `GraphSnapshot` schema and interface with optional topology signature (`entityIds`, `edgeKeys`).
   - Implement `diffGraphSnapshot(snapshot: GraphSnapshot, currentEntities: Entity[]): GraphSnapshotDiff`.
   - Add comprehensive unit tests in `src/lib/studio/graph-snapshot.test.ts`.
2. **Step 2: Comparison Dialog Component (`src/components/studio/views/graph-comparison-dialog.tsx`)**:
   - Build accessible modal presenting layout changes, viewport shifts, added/removed entity counts, and itemized diff lists.
3. **Step 3: Graph View & Toolbar Integration**:
   - Wire `Compare` button in `GraphToolbar` enabled when `hasSnapshot === true`.
   - Wire dialog state in `GraphView`.
4. **Step 4: Playwright E2E Test (`e2e/graph-comparison.spec.ts`)**:
   - Save snapshot, add entity/edge, open comparison overlay, assert diff reflects added elements, close dialog.
5. **Step 5: Verification & Merge**:
   - Run minimal quality gate, commit, push, create PR, and merge after green checks.
