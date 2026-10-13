# ADR 037: URL-Addressable View State

## Status

Implemented in Plan 165, Step 3 (2026-10-13). The URL/hash synchronization
lives in `src/lib/studio/view-hash.ts` and
`src/lib/studio/view-hash-sync.ts`, wired from `app-shell.tsx`.

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

- Canonical form: `#/library`, `#/graph`, `#/editor`, etc. derived from the
  shared `VIEW_IDS` tuple and `ViewId` type — no free-text route values.
- On view change (any source: sidebar, drawer, command palette, shortcuts):
  update the hash with native `history.pushState` so each hop is a history
  entry; Next.js integrates native History API calls with its App Router.
- On `popstate`/`hashchange`: parse the hash and set `currentView` when it
  names a known view.
- On load: a recognized view hash wins over persisted state. A missing hash or
  skip-link anchor leaves the persisted/default view intact. Unknown view
  hashes resolve to home and are normalized with `replaceState`.

Hash routing is chosen over path URLs because it needs no server rewrites,
cannot collide with future real routes, and keeps the single-route Next.js
model intact.

## Consequences

- Deep links (`…/#/mindmap`), bookmarks, and docs snippets work.
- Browser Back/Forward navigates between views as expected.
- Reload restores the exact view from the URL, not just last-session
  state.
- Implementation is contained: one sync module + wiring in
  `app-shell.tsx`; no changes to store persistence semantics (the
  persisted `currentView` remains the offline default).
- Browser E2E coverage verifies deep-link load, reload restoration, invalid
  route fallback, and Back/Forward traversal across all configured viewports.
