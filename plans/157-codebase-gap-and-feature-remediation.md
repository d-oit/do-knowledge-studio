# Plan 157 — Codebase Gap Remediation: Dead Features, Undo Integrity, PWA & A11y

**Date**: 2026-09-28
**Method**: GOAP (Goal-Oriented Action Planning) with multi-agent audit
**Status**: Complete
**Supersedes**: Nothing. Implements the D1/D4/D5 findings of
[`131-goap-swarm-improvement-audit-2026-08-22.md`](131-goap-swarm-improvement-audit-2026-08-22.md)
that this pass closed, plus the PWA and live-announcer gaps the audit ranked
below P0 but which are consumer-visible.

## Context

A multi-agent scout audit of the Knowledge Studio codebase found unfulfilled
implementations, orphaned features, and gaps against 2026 Next.js 16 / React
19 / PWA / accessibility practice:

1. **Dead or half-implemented UI** — the graph "Save snapshot" wrote
   `dks-graph-snapshot` that nothing read (D4.1); the mind map "Compact"
   toggle flipped state no renderer consumed (D4.2).
2. **Undo/redo data loss** — history snapshots held entities only, so
   undoing an entity deletion dropped the entity's claims forever, and any
   claim edit was invisible to history (D1.6). Undo/redo also left
   `editingEntityId`/`selectedEntityId` dangling (D1.22).
3. **Unmount leak** — `useAiHarnessChat` had no cleanup, so a streaming
   background request kept running and kept setting state on an unmounted view.
4. **PWA not installable** — `manifest.webmanifest` shipped SVG-only icons,
   which Chrome and Android reject for installability, and the service worker
   registered with no `updateViaCache` policy and no lifecycle management.
5. **Silent mutations** — `src/lib/a11y/announcer.tsx` mounted a live region at
   the root layout that no view ever spoke into, so every consequential
   mutation was silent for screen-reader users.

## Approach

### Phase 1 — MindMap & Graph feature completion

**Mind map density (D4.2).** New `views/mindmap-density.ts` holds the two
density token sets; `mindmap-view.tsx` resolves them with
`getMindMapDensity(compact)` and applies indent, row padding, sibling gap,
label size, badge scale, and connector geometry from that single source. The
toggle button's label and the status bar both report the active density.

Compact reclaims space from chrome only. Interactive targets keep their 44px
floor (AGENTS.md UI guardrails / WCAG 2.5.8), so the toggle is a density
control and never an accessibility setting — a pinned test asserts this.

**Graph snapshots (D4.1).** New `lib/studio/graph-snapshot.ts` owns the whole
round trip: `buildGraphSnapshot`, `saveGraphSnapshot`, `readGraphSnapshot`,
`clearGraphSnapshot`, and the `GraphLayout` union. The payload grew from
`{layout, selectedEntityId, focusMode}` to also carry the viewport
(`panX`, `panY`, `zoom`), so a restore returns the canvas the user left.
Every read is Zod-validated — localStorage is user-writable and outlives
deploys that change the layout union — and an unusable entry is cleared rather
than left to wedge the button.

`graph-view.tsx` gained `restoreSnapshot` and `clearSnapshot` callbacks and
`hasSnapshot` state; `graph-toolbar.tsx` gained "Restore snapshot" and "Clear
snapshot" buttons, both disabled when no snapshot exists. The duplicate
`LayoutType` alias now re-exports `GraphLayout` instead of re-declaring the
union.

Restore only re-applies a selection that still names an entity in the current
corpus: a snapshot taken before an import must not leave focus mode pointed at
a deleted node.

### Phase 2 — AI harness lifecycle

`useAiHarnessChat` gained an unmount `useEffect` whose cleanup aborts the
in-flight `AbortController` and clears the ref, so a provider stream cannot
outlive the view or keep calling `setMessages` on an unmounted hook.

### Phase 3 — Store integrity and decomposition

**History shape.** `lib/studio/history-snapshot.ts` introduces
`HistorySnapshot = { entities: Entity[]; claims: Claim[] }` plus three pure
helpers: `snapshotCorpus`, `resolveDanglingId`, and `reconcileSnapshot`.
Every history entry now carries the full corpus, so one undo step is a
complete transaction. `reconcileSnapshot` drops claims and links that point at
entities the restored state does not contain, so a snapshot written before a
rename or delete can never reintroduce an orphan.

Claim CRUD (`addClaim`, `updateClaim`, `deleteClaim`) now pushes history, and
a new `addClaims` batch API lets the claims panel's bulk extract land as one
undo step instead of N. Undo/redo clear `selectedEntityId`/`editingEntityId`
when the restored corpus no longer contains them.

**Decomposition.** `store.ts` was 610 LOC (over the 500 ceiling) and spanned
six concerns. It is now a 189-LOC composition root:

| Module | Lines | Owns |
|---|---|---|
| `store.ts` | 189 | Persist wiring, `useFilteredEntities`, `useStats`, cross-tab bootstrap |
| `store-types.ts` | 102 | The `StudioState` shape |
| `seed-state.ts` | 68 | `buildSeedState`, cloned per call (closes D1.25) |
| `history-snapshot.ts` | 52 | `HistorySnapshot` and its pure helpers |
| `slices/ui-slice.ts` | 81 | Navigation, library controls, panels |
| `slices/entities-slice.ts` | 96 | Entity CRUD |
| `slices/claims-slice.ts` | 74 | Claim CRUD |
| `slices/history-slice.ts` | 70 | Undo/redo |
| `slices/chat-slice.ts` | 111 | Local BM25 chat |
| `slices/data-slice.ts` | 96 | Import, rollback, reset |
| `slices/slice-types.ts` | 20 | `StudioSlice<S>` |

`StateCreator<S, [], [], S>` forces a slice to declare the *entire* store
type, which makes composition a type error by construction. `StudioSlice<S>`
(`slices/slice-types.ts`) instead accepts the subset a slice owns while still
typing `get()` as the full store — so a slice can call `pushHistory` without
importing the history slice, and nothing imports `store.ts`, keeping the
module graph acyclic.

The shape change rippled correctly rather than being papered over:
`hydration.ts` rebases history through `snapshotCorpus`; `cross-tab.ts` rebases
with claims included; `recovery-helpers.ts` validates each history row as a
full `{entities, claims}` object (closing D1.23) and reconciles it on restore.

### Phase 4 — PWA

**Icons.** `public/logo.svg` uses `currentColor` plus a
`prefers-color-scheme` query, neither of which a manifest icon can carry, so
`scripts/generate-pwa-icons.py` rasterizes the mark from the same 30×30
viewBox geometry with the light-theme saffron resolved. It emits
`icon-192.png` and `icon-512.png` (Chrome/Android installability floors) plus
an `icon-maskable-512.png` scaled into the 80% safe zone. The script is
checked in so the icons are reproducible, not mystery binaries.

**Manifest.** Added `id`, `orientation`, `categories`, `dir`, and `lang`
alongside the raster icons.

**Service worker.** `service-worker-registration.tsx` registers with
`{ scope: '/', updateViaCache: 'none' }`, runs an hourly `registration.update()`
check, re-checks on `visibilitychange` and `online`, purges superseded `dks-*`
caches when a new worker activates, and removes every listener and the interval
on unmount. A shared in-flight promise collapses event bursts into one request.

### Phase 5 — Live announcements

`useAnnouncer` now returns a no-op outside its provider instead of throwing: a
missing live region must never take down the action it was describing. The
root layout mounts the provider for the real app.

Announcements wired into the consequential mutations, with strings in the new
`lib/i18n/messages/announce.ts` scope:

| Trigger | Announcement |
|---|---|
| Sidebar view switch | `Switched to <nav label>` (silent on re-selecting the current view) |
| Editor save | `Saved <name>` / `Created <name>` |
| Inspector delete | `Deleted <name>` |
| Import success | `Imported N entities and M claims` |
| Import failure | `Import failed, your previous library was restored` |
| Reset to demo data | `Restored the demo library` |
| Graph snapshot save/restore/clear | `Snapshot saved/restored/cleared` |
| Mind map density toggle | `Density set to <density>` |

## Files

**New**
- `src/components/studio/views/mindmap-density.ts`
- `src/lib/studio/graph-snapshot.ts` (+ test)
- `src/lib/studio/history-snapshot.ts` (+ test)
- `src/lib/studio/seed-state.ts` (+ test)
- `src/lib/studio/store-types.ts`
- `src/lib/studio/slices/{ui,entities,claims,history,chat,data}-slice.ts`, `slice-types.ts`
- `src/lib/i18n/messages/mindmap.ts`, `announce.ts`
- `src/components/studio/service-worker-registration.test.tsx`
- `src/components/studio/announcer-integration.test.tsx`
- `scripts/generate-pwa-icons.py`
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`

**Modified**
- `src/lib/studio/store.ts`, `hydration.ts`, `cross-tab.ts`, `recovery-helpers.ts`
- `src/components/studio/views/{graph-view,graph-toolbar,mindmap-view,editor-view,editor-claims-panel,use-ai-harness-chat,use-export-handlers}.tsx|ts`
- `src/components/studio/{sidebar,right-panel,service-worker-registration}.tsx`
- `src/lib/a11y/announcer.tsx`
- `src/app/layout.tsx` (announcer must wrap the app, not sit beside it)
- `public/manifest.webmanifest`

## Verification

- `pnpm test` — 177 test files, 2737 tests, all green.
- `pnpm typecheck` — clean.
- `pnpm lint` — clean, no warnings.
- `pnpm run build` — clean, no warnings.
- LOC ceiling: every touched source file is under 500. `store.ts` 189
  (was 610); largest slice 111; `graph-view.tsx` 498; `mindmap-view.tsx` 497.
- Behavioral coverage: undo-after-delete restores claims, undo of a claim edit
  and of a claim deletion, redo replays the claim side, dangling selection and
  edit ids are cleared, orphan links are never restored, bulk extract is one
  undo step, unmount aborts an in-flight stream, compact density changes real
  CSS classes while keeping 44px targets, graph snapshot save/restore/clear
  round trip, corrupt snapshot entries are dropped, manifest icons exist at the
  required sizes, and announcements reach the live region end-to-end.

### Browser verification (not just unit tests)

Driving the production build in Chromium caught two defects the unit tests
structurally could not:

1. **`<Announcer />` was mounted as a sibling of `{children}`** in the root
   layout, not as a wrapper. A provider only supplies context to *its own
   children*, so every `useAnnouncer()` call in a view resolved to the no-op
   and the live region stayed empty. This had been latent since the component
   was added — no test rendered the real layout tree. Fixed by wrapping the app.
2. **The mind map and graph `Delete` actions announced nothing.** The first
   announcement pass wired the Inspector's delete only, leaving the two
   keyboard/toolbar delete paths silent. Both now route through a single
   `deleteFocusedNode` / announced branch.

Measured in Chromium against the production build:

- Compact density: `px-3` → `px-2.5`, `py-1.5` → `py-1`, label `13px` → `12px`,
  per-level indent `28px` → `18px`, status bar reads "Comfortable" → "Compact",
  and the expand/collapse control measures exactly 44 × 44 px in both states.
- Graph snapshot: saved `circular` + focus mode, moved to `hierarchical`,
  restored back to `circular` with focus still engaged; Clear emptied
  `dks-graph-snapshot` and re-disabled both buttons.
- Live region: "Switched to Timeline", "Switched to Home",
  "Density set to Compact", "Snapshot saved", "Snapshot restored",
  "Snapshot cleared", "Created Announce Probe" all reached the region;
  re-selecting the current view stayed silent as designed.
- PWA: service worker registered at scope `http://localhost:3000/`, manifest
  served 200 with all five icons at the declared sizes.

## Findings Left Open

- The manifest ships **no `shortcuts` array**: the app has no `?view=`
  deep-link support, so shortcuts would have launched the wrong view. Adding
  them needs the deep-link feature first.
- Announcement coverage is uneven by design: the sidebar, mind map density,
  and both delete paths are covered end-to-end by
  `announcer-integration.test.tsx` and by Chromium. The editor save, inspector
  delete, import, and reset triggers are verified by their own component tests
  and by the browser pass, but have no dedicated live-region test.
- D1.14's original 497-LOC store is now 189 LOC with each concern in its own
  module; the remaining Plan 131 dead primitives (`EmptyState`, `FieldLabel`,
  `ToolbarBtn` in `ui/shared-primitives.tsx`) were left alone as out of scope.
