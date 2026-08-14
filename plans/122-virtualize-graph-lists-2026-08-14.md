# Plan 122 — Reactivate Task 138: Virtualize Graph-Adjacent Lists (2026-08-14)

Date: 2026-08-14
Status: PLANNING — implementation track reactivated from Task 138 (was DEFERRED)

## Purpose

Reactivate the deferred **Task 138 — Virtualize graph-adjacent lists** (P1, perf) as
the next feature track. Deferral rationale was: virtualization not needed for current
data volumes, revisit if users report issues with 1000+ items. This track implements
the fix proactively so large libraries (500+ entities, frequent snapshots) stay
responsive without waiting for user reports.

## Current State (re-verified 2026-08-14)

- **SearchPanel** — already virtualized with `@tanstack/react-virtual` ✅
- **GraphControls** — snapshot list renders **all** items eagerly ❌ (the gap)
- **GraphView** — selection info minimal; `GraphInspector` relationship/claim lists are
  small but can grow with dense claim graphs
- **SidebarNav** — 6 items, no virtualization needed ✅
- `@tanstack/react-virtual` is already a dependency (used by SearchPanel) — no new deps

## Waves

### W1 — Virtualize the GraphControls snapshot list

- Wrap the snapshot list in a `useVirtualizer` container (same pattern as SearchPanel)
- Preserve keyboard navigation and double-click-to-restore behavior on virtualized items
- Keep the active/diff selection state working with recycling rows
- Guard: empty list and few-items cases render without the virtualizer overhead

### W2 — Cap + "Show all" paging

- Cap initial snapshot display at 10 items (extract `SNAPSHOT_INITIAL_LIMIT = 10` constant)
- Add a "Show all N snapshots" control that expands the list
- Keep the cap semantics documented in the GraphControls component header

### W3 — Verify inspector lists + perf validation

- Audit `GraphInspector` relationship/claim lists; add virtualization only if the
  growth path justifies it (claims per entity can grow without bound)
- Perf validation: build a seeded dataset with 1000+ snapshots and confirm the
  snapshot list renders a bounded DOM (measure with React Profiler in dev)
- Run the existing graph E2E tests (`e2e/graph.spec.ts` etc.) to confirm no regression

## Acceptance Criteria

- [ ] Snapshot list renders a bounded set of DOM nodes regardless of total count
- [ ] Keyboard navigation, double-click restore, and diff selection unchanged
- [ ] Initial view capped at 10 snapshots with a working "Show all" control
- [ ] Full quality gate green (lint, typecheck, 2210+ tests, BATS, links)
- [ ] Plan 122 marked DONE with the merged PR(s) referenced

## Notes

- Pure front-end change; no data model, export, or search behavior affected — no ADR
  required (mirrors the existing SearchPanel virtualization precedent)
- Reuse the SearchPanel virtualizer pattern rather than introducing a new abstraction
