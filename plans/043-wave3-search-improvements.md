# Wave 3 Search Improvements (C6, C7, C8)

## Goals

- **C6** — Notes appear as first-class search docs and the `Notes` filter
  returns note hits; results map to parent entity when available.
- **C7** — The semantic toggle actually controls the search pipeline. When
  off, skip the semantic stage; when on, run the full pipeline
  (exact → semantic → related).
- **C8** — Graph controls expose type filter, relation filter, node search,
  and degree filter, with a callback for the parent view to apply them.

## Approach

### C6 — Notes indexing

`progressive.ts` already creates `SearchDocument` entries for notes
(`buildNoteDoc`) and indexes them in `initSearch`. The main gaps are:

- `entity_search_idx` / `claim_search_idx` FTS5 tables do not include notes
  → `hydrateFts5Index` is updated to hydrate a `note_search_idx` table
  (mirrors existing pattern).
- `upsertToSearchIndex` for a parent entity only re-indexes its claims; it
  does not refresh linked notes. Add a helper to re-index linked notes when
  the parent changes, plus a "parent" mapping so note search hits can be
  routed back to the owning entity.
- The `Notes` filter (`type: 'note'`) already routes through `searchKnowledge`
  but `repository.searchRelated` did not include note hits. Notes are now
  included via Orama results; additionally we expose a `noteToEntity` map for
  routing.

### C7 — Semantic toggle

`progressiveSearch` currently runs the semantic stage whenever the
embeddings plugin is ready, regardless of the UI toggle. Wire the
`useSemantic` option through:

- Add a `semantic?: boolean` flag to `progressiveSearch` options.
- When `semantic === false`, skip the semantic stage entirely.
- The SearchPanel already calls `progressiveSearch` with options — pass the
  new flag from the `useSemantic` state.

### C8 — Graph filters

Add a self-contained `GraphFiltersPanel` component (sibling rendered when
toggled) inside `GraphControls.tsx` that:

- Renders checkboxes for entity types pulled from the supplied nodes.
- Renders checkboxes for link/relation labels pulled from the supplied edges.
- Renders a node search input that emits matching node ids.
- Renders a degree slider (min connections) for degree-based filtering.

The component is purely presentational — it surfaces `onFiltersChange` so
`GraphView` (or any parent) wires it into `filteredData`. The data flow
stays in `GraphView.tsx`; the controls panel is the API surface.

## Files Touched

| File | Change |
|------|--------|
| `src/lib/search/progressive.ts` | Add `semantic` option, FTS5 note index, parent-entity map |
| `src/lib/search/fts5-hydrator.ts` | Hydrate `note_search_idx` |
| `src/features/search/SearchPanel.tsx` | Wire `useSemantic` into `progressiveSearch` |
| `src/features/graph/GraphControls.tsx` | Add `GraphFiltersPanel` |
| `src/features/graph/GraphView.tsx` | Consume filter callbacks and update `filteredData` |
| `src/features/search/__tests__/SearchPanel.test.tsx` | New tests for semantic toggle behaviour |
| `src/features/graph/__tests__/GraphControls.test.tsx` | New tests for filter widgets |
| `src/lib/search/__tests__/progressive.test.ts` (new) | Notes index + semantic toggle tests |

## Verification

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test`
- New unit tests cover all three tasks.
