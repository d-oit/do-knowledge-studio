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
     - `GraphSnapshot` is extended with an optional topology payload: `entities: {id, name}[]` and `edges: {from, to}[]`.
     - When present in newer snapshots, exact set differences classify added, removed, and retained entities and connections.
     - Edge identity is canonicalized through `JSON.stringify([from, to])` so ids containing hyphens cannot collapse distinct endpoint pairs (`a-b → c` vs `a → b-c`) into one key.
     - When absent (backwards compatibility with existing v1 snapshots), the comparison presents viewport and layout delta (`layout`, `zoom`, `pan`, `focusMode`, `selectedEntityId`) and current topology context without crashing.
   - The diff reports focus mode and selection changes (`focusModeChanged`, `selectionChanged` with previous/current display names) alongside layout, zoom, and pan deltas.
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

## Review Resolution (PR #974)

Initial commit `4718d8c`; review fixes in `af9567b`. All five nexus-check findings verified and fixed, threads replied and resolved:

| Finding | Resolution |
| --- | --- |
| Hyphen-joined edge keys ambiguous (`a-b → c` vs `a → b-c`) | Structured `{from,to}` refs + `JSON.stringify([from,to])` identity; regression test asserts 1 added / 1 removed / 0 retained for the colliding pair |
| Dialog showed only counts for removed entities/edges | Itemized lists: removed entity names, added/removed connections with endpoint display names |
| `focusMode` / `selectedEntityId` absent from comparison | `compareSnapshot` passes both; diff reports `focusModeChanged` / `selectionChanged` with display names; dialog renders both rows |
| Pan delta computed but never rendered | Viewport section renders `Δx/Δy` next to zoom; test asserts `Δx +30.00, Δy -20.00` |
| Test name overstated coverage | Split into header-close and footer-close tests with accurate names |

Verification at `af9567b`: lint + typecheck green locally; 2986 unit tests pass (196 files); `e2e/graph-comparison.spec.ts` green on chromium.

## Second Review Pass (code-review-assistant)

A structured review of `af9567b` raised two P1s and three P2s; all fixed before merge:

| Finding | Resolution |
| --- | --- |
| Modal keystrokes bubbled into the canvas keydown handler — Delete destroyed the selected entity and arrows panned the graph behind the dialog | `useGraphKeyboard` early-returns while `isCompareOpen`; jsdom test added, and the Playwright e2e was watched failing with the shield removed |
| ~20 hardcoded user-facing strings in the new dialog | All strings moved to `graph.comparison.*` keys in `src/lib/i18n/messages/graph.ts` |
| Edge-list React keys re-introduced the concatenation ambiguity | Dialog keys use the exported `edgeIdentity` |
| Dangling links and duplicate connections inflated edge deltas | `diffGraphSnapshot` projects both edge sets (endpoint existence + dedupe) exactly like the canvas projection |
| `graph-view.tsx` grew past its already-oversized 618 lines | Snapshot/comparison state, canvas keyboard, and PNG export extracted into `use-graph-snapshot-comparison.ts`, `use-graph-keyboard.ts`, `export-graph-png.ts`; view is now 483 lines (under the 500 cap) |

Also fixed from the P3 list: module-scope `Intl.DateTimeFormat` formatter; per-section topology gating (`hasEntityData` / `hasEdgeData`); zoom/pan rows report `Unchanged` instead of `+0.00`; `aria-describedby` targets the one-line summary. An invisible NUL-byte defect in the earlier dialog revision (`key={\`${from}\0${to}\`}`) was found in this pass and eliminated by the rewrite.

## Third Review Pass (bot findings on `f75bc5e`)

| Finding | Resolution |
| --- | --- |
| Edge-only snapshot payloads lost every saved edge (empty endpoint set filtered all of them) | `projectEdges` takes a nullable inventory: no entity list means dedupe-only; test `counts saved edges from a snapshot without an entity inventory by identity only` |
| PNG export stranded its blob URL when the SVG image failed to load | `img.onerror` revokes the URL, same as the `onload` path |
| Junk stored timestamp could throw `RangeError` from `Intl.DateTimeFormat` and kill the dialog | Unparseable timestamps fall back to the raw string; dialog test asserts no crash |
| Pan-delta i18n comment example didn't match the rendered `Δx/Δy` form | Comment corrected |
| Shield test dispatched keys on the canvas, not through the claimed dialog bubbling path | Test now dispatches on the dialog's close control, exercising real React bubbling to the canvas handler |
