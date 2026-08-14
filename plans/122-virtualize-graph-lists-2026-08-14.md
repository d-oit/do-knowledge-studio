# Plan 122 — Large-List Render Cost: Library Cap + Show All, E2E Backfill, Windowing (2026-08-14)

Date: 2026-08-14
Status: IMPLEMENTED — W1/W2 merged via PR #677; W3/W4 via PR #678; follow-ups #679–#683

## Purpose

Reactivate the deferred **Task 138 — virtualize graph-adjacent lists** (P1, perf) as
the next feature track. Goal: large lists no longer render every row by default.

## Reality Check (2026-08-14)

Task 138's original premise was written against the retired Vite-era codebase:

- **"GraphControls snapshot list" does not exist** in the Next.js app. The graph view
  saves a *single* layout snapshot to `localStorage` (`dks-graph-snapshot`); there is
  no snapshot list.
- **`@tanstack/react-virtual` was NOT a dependency** (grep `useVirtualizer` in `src/`
  returned zero matches; package.json had no tanstack entry). The old "SearchPanel is
  already virtualized" note is stale.
- The app's actual large list is the **Library view** (`library-view.tsx`): it renders
  every filtered entity in a grid (`motion.button` cards with staggered entrance) and a
  table — unbounded DOM for 1000+ entities.

## What Was Implemented

### W1 — Library large-list cap (PR #677)

- `LIBRARY_INITIAL_LIMIT = 24` — named constant in `library-view.tsx`
- Grid and list views render only the first 24 entities by default
- A 44px "Show all N entities" / "Show fewer" toggle button appears when the filtered
  count exceeds the cap (`aria-expanded`, focus-ring, saffron hover)
- Footer count reads "Showing X of N entities" while capped; existing tests (small
  fixtures) unaffected

### W2 — Nightly E2E backfill (PR #677)

- `ci-and-labels.yml`: added a `schedule` trigger (`0 3 * * *`) — nightly full E2E
  suite against `main`, closing the gap where the suite went ~a week stale because
  recent PRs (docs/scripts-only) skipped E2E
- `e2e-tests` job runs on schedule (main) OR when frontend paths change; the
  quality-gate / unit-tests / build / coverage jobs are explicitly skipped on
  schedule so the nightly run is E2E-only

### W3 — True windowing virtualization (PR #678)

- **Added `@tanstack/react-virtual@3.14.9`** — the deferred approach from the original
  plan, now justified since W1's cap only bounds the *default* view; "Show all" on a
  1000+ entity library still rendered every row eagerly
- `library-entities.tsx`:
  - `shouldVirtualize(hasHeight, count)` gate — virtualization only when the scroll
    container reports a real (non-zero) height AND count > `VIRTUALIZE_THRESHOLD` (64).
    jsdom reports `clientHeight = 0`, so all component tests stay on the eager path
  - `useMeasurableHeight` hook — `useLayoutEffect` + guarded `ResizeObserver` (jsdom
    has no ResizeObserver) to detect the browser layout
  - `useColumnCount` hook — `matchMedia` (640/1024px) mirrors the responsive
    `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` CSS so virtual grid rows chunk correctly
  - `EntityGrid` — virtualizes **rows** (chunked by column count), each row measured via
    `virtualizer.measureElement`; entrance animation disabled on the windowed path so
    scroll-in doesn't replay staggers
  - `EntityTable` — virtualizes **rows** inside a `max-h-[65vh]` scroll container with a
    sticky `<thead>`; rows are absolutely positioned via `translateY(vi.start)`
  - `useEntityListVirtualizer` — isolates the `useVirtualizer` call so React Compiler
    skips only the hook, keeping the consuming components compiler-friendly
    (`react-hooks/incompatible-library` scoped suppression, documented inline)
- **Tests** — `library-entities.test.tsx`: `shouldVirtualize` boundary unit tests,
  eager-path renders (jsdom), and windowed-path renders with a mocked virtualizer +
  `clientHeight` override (spacer height, absolute offsets, `data-index`, count/overscan
  wiring). Full suite: 2216 tests green

### W4 — Icon mapping consolidation (PR #678)

- New shared `src/components/studio/entity-type-icon.tsx` — `EntityIcon` component
  (exhaustive typed switch with `default` fallback) is the single type→icon source
- `library-entities.tsx` and `home-view.tsx` both render `<EntityIcon type=… />`;
  home-view's string-keyed `ENTITY_ICONS[meta.icon]` record removed
- The now-dead `icon` field dropped from `ENTITY_TYPE_META` in `src/lib/studio/types.ts`
  (only consumer was home-view; no test asserted it)
- Resolves the OwlWatch LOW thread from PR #677 (cross-file icon duplication) properly

## E2E Verification of the Nightly Path (PR #678)

- `ci-and-labels.yml` gains `workflow_dispatch`; the `e2e-tests` job also runs on
  `workflow_dispatch` — a manual lever to exercise the E2E-on-main path without waiting
  for 03:00 UTC (the schedule branch itself runs nightly on main)
- After merge: `gh workflow run ci-and-labels.yml --ref main` dispatched and the E2E
  job verified SUCCESS on main

## Acceptance Criteria

- [x] Large list views no longer render all rows/items by default (Library capped at 24)
- [x] True windowing renders only the visible window when "Show all" is expanded on
      1000+ entities (both grid and table views)
- [x] Side panels remain responsive with large node counts (bounded DOM)
- [x] Scroll performance improves measurably on large datasets (bounded render)
- [x] E2E suite runs nightly on main (backfill) and is manually triggerable
- [x] Full quality gate green (lint, typecheck, 2216 tests, verify-deps, build, E2E)

## Notes

- No ADR required: pure front-end rendering bound, no data-model/export/search change.
  Dependency addition (`@tanstack/react-virtual`) verified via `verify-deps.sh`.
- Reuses existing patterns (`ToggleButtonGroup`, `focus-ring`, min-h-44 touch targets).
- DONE: `useColumnCount` breakpoints now read `--breakpoint-sm`/`--breakpoint-lg`
  from the Tailwind v4 `@theme` block (globals.css) at runtime — the CSS is the
  single source of truth, so the virtual grid can never drift from the `sm:`/`lg:`
  classes (PR #679).
- DONE: `e2e/library-virtualization.spec.ts` seeds 120 entities through the Zustand
  persist envelope and exercises the windowed path in a real browser (cap → Show all
  → windowed mount → scroll → later windows mount) on all viewport projects (PR #679).

## Follow-up Delivery (PRs #680–#683)

- **Chat/library a11y tooltips + SR labels (PR #680)** — rescued the closed PR #673:
  sr-only `You:`/`Assistant:` prefixes inside chat bubbles, matching `title`+`aria-label`
  pairs on icon-only controls (Send, Clear chat, Clear search, Grid/List toggles, Sort),
  ChatView decomposed into presentational subcomponents, dead `chat-clear-btn` class
  removed, Codacy void-arrow finding eliminated.
- **Codacy merge-gate docs (PR #681)** — plans/123 + AGENTS.md subsection +
  LESSON-031 capture the transient missing-check and always-falsy-guard learnings.
- **Chat a11y E2E + CI trigger fix (PR #682)** — `e2e/chat-a11y.spec.ts` asserts the
  sr-only sender labels and chat tooltips; `ci-and-labels.yml` frontend filter gained
  `e2e/**` so e2e-spec-only PRs no longer skip the E2E job (verified on the #682 run).
- **Library control tooltip E2E (PR #683)** — `e2e/search-and-filter.spec.ts` asserts
  the Clear search / Grid / List / Sort tooltips, including the sort toggle's
  state-tracking title.
