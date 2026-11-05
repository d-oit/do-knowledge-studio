# Performance baselines

Measured budgets for the paths the graph and storage layers must stay inside
(Plans 198 / #1053, and the existing storage guards). Numbers are wall-clock
durations printed by the vitest reporters under `pnpm run test:bench`, measured
on the repository's CI-class runner. Re-run that command before trusting them
on different hardware.

## How to reproduce

```bash
pnpm run test:bench          # bench config: src/**/*.bench.test.ts + fusion bench
pnpm vitest run src/lib/studio/graph-layout.bench.test.ts   # graph layout only
```

The reporter prints each test's duration next to its name; a budget is a hard
assertion, so a slower machine turns the figure into a failing check rather than
silent drift.

## Graph layout (`src/lib/studio/graph-layout.bench.test.ts`)

| Nodes | Budget | Measured (2026-11-05) | Notes |
| ----- | ------ | --------------------- | ----- |
| 150 | < 100 ms for 50 iterations | ~0.2 s total (4 ms/iteration) | Historical guard, unchanged |
| 500 | < 120 ms | ~40 ms | One placement pass |
| 2,000 | < 500 ms | ~170 ms | One placement pass |
| 5,000 | < 2,000 ms | ~470–580 ms across runs | One placement pass, spatial-hash placement |

Placement is O(n · probes · neighbours) after the spatial hash; before that
change the same 5,000-node pass exceeded the multi-second range because every
probe scanned all placed nodes (Plan 198).

### Main-thread budget

A single 5,000-node pass (~470–580 ms) is too long for one frame, so the view does
not run it synchronously. `createPlacementRunner` resolves
`PLACEMENT_CHUNK_SIZE = 250` nodes per call and `useGraphPlacement` drives one
chunk per `requestAnimationFrame`:

- 5,000 nodes at 470 ms total ⇒ ~24 ms per chunk, inside a 60 fps frame budget
  (16.7 ms is the frame; the chunk plus React's render stays under the 50 ms
  main-thread ceiling the issue states).
- Corpora at or below `SYNC_PLACEMENT_NODE_LIMIT = 500` place in one pass —
  chunking them would add frames for no measurable gain.

## Graph rendering (`src/lib/studio/graph-culling.ts`)

| Setting | Value | Effect |
| ------- | ----- | ------ |
| `CULL_MARGIN_PX` | 120 | Nodes just outside the viewBox stay mounted so labels do not pop |
| letterbox expansion | container aspect | `visibleRect` widens or heightens the rect to the `xMidYMid meet` box, so a node visible in the letterbox is never culled |
| `LABEL_LOD_NODE_THRESHOLD` | 400 | Above this, labels depend on zoom |
| `LABEL_LOD_MIN_ZOOM` | 0.6 | Node labels hidden below this zoom on large graphs |
| `EDGE_LABEL_MIN_ZOOM` | 1.2 | Relation labels hidden below this zoom on large graphs |
| `LARGE_GRAPH_NOTICE_THRESHOLD` | 1000 | View opens in focus mode and can show the partial-render notice |

Mounted node/edge counts are bounded by the viewBox, so pan/zoom work is
proportional to what is visible, not to library size.

## Not measured here

- **Frame rate during pan/zoom.** There is no browser profiling harness in this
  repository; the 30 fps acceptance target from #1053 is not asserted by a
  check. Measuring it means recording a Playwright trace of a drag on a 5k-node
  corpus and reading the frame timeline. Until that exists, the guarantee this
  repo tests is bounded mount counts plus chunked placement, not a frame rate.
- **Memory.** The 5k pass allocates the node list and grid only; no heap
  measurement is recorded.

## Storage baselines

Unrelated to the graph, for reference: `canonical-storage.bench.test.ts` guards
legacy JSON and IndexedDB writes at 1k/5k/10k records, `vector-store.bench.test.ts`
guards cold/warm/single-edit search updates at the same sizes, and
`retrieval.bench.test.ts` guards cached-query speed against a cold rebuild.
