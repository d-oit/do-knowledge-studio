# ADR 037: URL-Addressable View State

## Status

Proposed — implemented via Plan 130
(`plans/130-goap-uiux-testpyramid-errorhandling-2026-08-22.md`).

## Context

The studio is a single-route SPA: `src/app/page.tsx` renders
`AppShell`, and the active view lives in Zustand state
(`currentView`, persisted to localStorage around
`src/lib/studio/store.ts:407`). Views switch via sidebar/drawer/
command palette with lazy-loaded chunks behind a Suspense boundary.

Consequences of state-only navigation:

- **No deep links** — "open the graph view" or "link to the export
  panel" cannot be shared, bookmarked, or documented.
- **No back/forward integration** — browser Back exits the app
  entirely instead of returning to the previous view, which users
  expect after switching views.
- **No restore-to-context on reload** beyond the persisted last view;
  in-app history is lost.

A full Next.js route-per-view migration was considered and rejected:
views share one persistent three-pane shell, all state is client-side,
and per-route server rendering adds nothing for a local-first tool —
it would multiply files and hydration complexity for zero user value.

## Decision

Synchronize `currentView` with the URL **hash**, not the History API
router:

- Canonical form: `#/library`, `#/graph`, `#/editor`, etc. derived
  from the existing `ViewId` union — one constant map, no free-text.
- On view change (any source: sidebar, drawer, command palette,
  shortcuts): update `location.hash` via `history.pushState` so each
  hop becomes a history entry.
- On `popstate`/`hashchange`: parse and set `currentView` if valid.
- On load: hash wins over the persisted value; unknown or missing hash
  falls back to the persisted/default view (backward compatible).
- Invalid hashes never throw; they resolve to home.

Hash routing is chosen over `history.pushState` path URLs because it
works under static export/file:// contexts, needs no server rewrites,
cannot collide with future real routes, and keeps the single-route
Next.js model intact.

## Consequences

- Deep links (`…/#/mindmap`), bookmarks, and docs snippets work.
- Browser Back/Forward navigates between views as expected.
- Reload restores the exact view from the URL, not just last-session
  state.
- Implementation is contained: one sync module + wiring in
  `app-shell.tsx`; no changes to store persistence semantics (the
  persisted `currentView` remains the offline default).
- E2E additions: deep-link load spec and Back/Forward traversal spec
  across viewports (Plan 130 G6).
