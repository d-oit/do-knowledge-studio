# Plan 198 — Graph scalability budgets and rendering path (#1053)

Status: implemented on `feat/1053-graph-scalability` (2026-11-05).

## Problem

The graph is SVG, the only layout benchmark covered 150 nodes, and nothing
bounded what a large imported or synced library would do. Placement scanned
every placed node for each probe, so it was O(n²): at 5k nodes a single pass ran
into the seconds range, blocking the main thread before the canvas painted.

## Decisions

1. **Fix the algorithm before the renderer.** Placement now uses a uniform
   spatial hash (`NodeGrid` in `graph-layout.ts`) with cells one preferred
   spacing wide. Clearance only ever tests a fixed radius, so reading the
   candidate's own cells plus neighbours answers the same question the linear
   scan did. Final positions are unchanged: seed nodes are authored, and
   unseeded nodes still resolve in deterministic id order.
2. **Chunk placement instead of moving it off-thread.** `createPlacementRunner`
   resolves `PLACEMENT_CHUNK_SIZE = 250` nodes per call;
   `useGraphPlacement` drives one chunk per animation frame above
   `SYNC_PLACEMENT_NODE_LIMIT = 500`. A Web Worker would need the corpus
   serialized into it and the result back, for a one-shot computation that
   already holds the main thread inside the 50 ms ceiling once chunked.
3. **Cull to the viewBox.** `graph-culling.ts` mirrors `canvasViewBox` maths and
   returns only the nodes (plus a 120-unit margin) and edges an SVG can show.
   `visibleRect` also adds the letterboxing `preserveAspectRatio="xMidYMid meet"`
   introduces on the wider axis, so a node drawn in the letterbox is kept.
   The toolbar counts still describe the graph in scope; culling changes what
   is mounted, not what exists.
4. **Level of detail by zoom.** Past 400 nodes, node labels hide below zoom 0.6
   and relation labels below zoom 1.2 — the zooms where they overlap into a
   smear anyway.
5. **Tell the user.** A `role="status"` strip reports progressive placement and
   partial rendering. A library at or past 1000 nodes opens in focus mode, so
   the first paint is a neighborhood rather than every node.
6. **Keep SVG; do not add a Canvas 2D renderer.** Culling plus LOD exists to
   keep the accessible SVG path (focusable nodes, ARIA labels, keyboard
   navigation) as the only renderer. A second renderer would double the
   interaction surface for a path that has not yet been shown to need it. This
   is recorded in ADR 052.

## Delivered

- `src/lib/studio/graph-layout.ts`: `NodeGrid`, `createPlacementRunner`,
  `PLACEMENT_CHUNK_SIZE`; `placeGraphNodes` delegates to the runner.
- `src/lib/studio/use-graph-placement.ts`: frame-chunked placement hook.
- `src/lib/studio/graph-culling.ts`: `viewBoxRect`, `cullNodes`, `cullEdges`,
  `shouldShowNodeLabels`, `shouldShowRelationLabels`, `isLargeGraph`.
- `src/components/studio/views/graph-view.tsx`: culled render pass, LOD labels,
  partial-placement and partial-render status strip, focus mode default.
- `src/components/studio/views/graph-elements.tsx`: `showRelationLabel`.
- `src/lib/studio/graph-layout.bench.test.ts`: 500 / 2k / 5k budgets plus a 2k
  determinism check.
- `plans/perf-baselines.md`, ADR 052.

## Verification

- `pnpm run test:bench`: graph layout 12 tests pass; 5k measured ~470 ms against
  a 2,000 ms ceiling.
- `graph-placement-progressive.test.ts`: chunked runner reaches exactly the
  single-pass positions, chunk boundaries included.
- `graph-culling.test.ts`: viewBox maths, margin behaviour, edge endpoint rule,
  both LOD switches, notice threshold.
- Existing `graph-layout.test.ts` (clearance, determinism, click safety) and
  both graph view suites pass unchanged.

## Known gap

The 30 fps pan/zoom target is **not** asserted by any check: the repository has
no browser frame-timeline harness. `plans/perf-baselines.md` states the measured
guarantees (bounded mount counts, ~24 ms placement chunks) and how to measure
the frame rate with a Playwright trace. That gap is a follow-up, not a claim.
