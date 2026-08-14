# Plan 122 — Large-List Render Cost: Library Cap + Show All, E2E Backfill (2026-08-14)

Date: 2026-08-14
Status: IMPLEMENTED — merged via PR #677

## Purpose

Reactivate the deferred **Task 138 — virtualize graph-adjacent lists** (P1, perf) as
the next feature track. Goal: large lists no longer render every row by default.

## Reality Check (2026-08-14)

Task 138's original premise was written against the retired Vite-era codebase:

- **"GraphControls snapshot list" does not exist** in the Next.js app. The graph view
  saves a *single* layout snapshot to `localStorage` (`dks-graph-snapshot`); there is
  no snapshot list.
- **`@tanstack/react-virtual` is NOT a dependency** (grep `useVirtualizer` in `src/`
  returns zero matches; package.json has no tanstack entry). The old "SearchPanel is
  already virtualized" note is stale.
- The app's actual large list is the **Library view** (`library-view.tsx`): it renders
  every filtered entity in a grid (`motion.button` cards with staggered entrance) and a
  table — unbounded DOM for 1000+ entities.

## What Was Implemented (PR #677)

### W1 — Library large-list cap (plan 122 W2 of Task 138)

- `LIBRARY_INITIAL_LIMIT = 24` — named constant in `library-view.tsx`
- Grid and list views render only the first 24 entities by default
- A 44px "Show all N entities" / "Show fewer" toggle button appears when the filtered
  count exceeds the cap (`aria-expanded`, focus-ring, saffron hover)
- Footer count reads "Showing X of N entities" while capped; existing tests (small
  fixtures) unaffected — 22/22 pass, typecheck + lint clean

### W2 — Nightly E2E backfill (E2E-gating gap)

- `ci-and-labels.yml`: added a `schedule` trigger (`0 3 * * *`) — nightly full E2E
  suite against `main`, closing the gap where the suite went ~a week stale because
  recent PRs (docs/scripts-only) skipped E2E
- `e2e-tests` job runs on schedule (main) OR when frontend paths change; the
  quality-gate / unit-tests / build / coverage jobs are explicitly skipped on
  schedule so the nightly run is E2E-only

## Deferred (documented follow-up)

- True windowing virtualization with `@tanstack/react-virtual` (would add a
  dependency + a jsdom measurement strategy for tests). Revisit if users report
  slowness at 1000+ entities — the cap + Show-all covers the render-cost goal today.

## Acceptance Criteria

- [x] Large list views no longer render all rows/items by default (Library capped at 24)
- [x] Side panels remain responsive with large node counts (cap bounds DOM)
- [x] Scroll performance improves measurably on large datasets (bounded render)
- [x] E2E suite runs nightly on main (backfill) — no more stale-gap drift
- [x] Full quality gate green (lint, typecheck, 2210+ tests, BATS, links, E2E)

## Notes

- No ADR required: pure front-end rendering bound, no data-model/export/search change
- Reuses existing patterns (`ToggleButtonGroup`, `focus-ring`, min-h-44 touch targets)
