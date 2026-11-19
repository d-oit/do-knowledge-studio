# Performance baselines

Measured budgets for the paths the graph and storage layers must stay inside
(Plans 198 / #1053, and the existing storage guards). Numbers are wall-clock
durations printed by the vitest reporters under `pnpm run test:bench`, measured
on the repository's CI-class runner. Re-run that command before trusting them
on different hardware.

```bash
pnpm run test:bench          # bench config: src/**/*.bench.test.ts + fusion bench
pnpm vitest run src/lib/studio/graph-layout.bench.test.ts   # graph layout only
pnpm vitest run src/lib/studio/graph-filter.bench.test.ts   # filter/query CPU budgets
pnpm exec playwright test e2e/graph-frame-timeline.spec.ts --project=chromium  # frame timeline
GRAPH_BENCH_SIZES=1,5,10 pnpm exec playwright test e2e/graph-frame-timeline.spec.ts --project=chromium  # 1k/5k/10k sweep
```

The E2E runner prints, next to the percentile floors, the browser/OS/hardware
context it measured under (user agent, platform, `navigator.deviceMemory`,
`hardwareConcurrency`, viewport) and heap samples (`JSHeapUsedSize` from the
Chromium metrics API) at load and after a drag. That metadata is the
`env=`/`heapLoaded=`/`heapAfterPan=` fields of the printed `[frame-timeline]`
lines; never trust a percentile without the context that produced it.

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

## Entity revision capture (`src/lib/studio/revisions.bench.test.ts`)

| Operation | Budget | Notes |
| --------- | ------ | ----- |
| Capture decision, 200 saves of a 50k-character note | < 200 ms total | The save path runs it twice per commit (previous + next) |
| Snapshot signature, 50k-character note | < 1 ms per call | Content compare used by every capture decision |
| Eviction plan for 1,000 revisions | < 50 ms | Runs after a capture, never on the typing path |

Capture is fire-and-forget: the store action records it and returns, so a slow
IndexedDB write cannot add latency to a save. The bench bounds the synchronous
decision (`shouldCaptureRevision`) and the signature it computes.

## Graph frame timeline (`e2e/graph-frame-timeline.spec.ts`)

Plan 198 recorded the 30 fps pan/zoom target as unasserted because the repo had
no browser frame harness. Plan 207 added one: the spec seeds 5,000 nodes with
2 links each through the shared store fixture, waits for progressive placement,
then records the real interval between animation frames while a drag runs and,
separately, while a wheel zoom runs.

Frame intervals, measured 2026-11-13 (Chromium 156 headless, software rendering):

| Phase | Developer machine | CI runner (run 43431371176) | Worst (local) | Ceiling asserted |
| ----- | ----------------- | --------------------------- | ------------- | ---------------- |
| Pan (default focus-mode view) | p50 50–67 ms, p95 ~1,030–1,050 ms | p50 75.0 ms, p95 1,062.4 ms | ~1,170 ms | p50 ≤ 120 ms, p95 ≤ 1,500 ms |
| Wheel zoom | p50 50–67 ms, p95 ~950–970 ms | p50 66.7 ms, p95 967.4 ms | ~1,100 ms | p50 ≤ 120 ms, p95 ≤ 1,500 ms |
| Pan after zooming out to the whole graph | p50 ~183 ms | not sampled | ~1,100 ms | not sampled by the spec |

Both runner classes sit inside the ceilings (the CI run is the slower of the
two at p50 75 ms, still 1.6× under the 120 ms floor), which is what makes the
floor a usable signal rather than a machine-specific tuning.

### Where the p95 tail comes from (2026-11-13)

A size sweep with a temporary `longtask` observer (Plan 210) — same spec, same
gestures, same headless software rendering, only `NODE_COUNT` changed:

| Nodes | Pan p50 | Pan p95 | Worst | Mounted circles | Long-task total |
| ----- | ------- | ------- | ----- | --------------- | --------------- |
| 50 | 16.7 ms | 16.8 ms | 33.4 ms | not probed | not probed |
| 500 | 16.7 ms | 200 ms | 300 ms | 804 | 8.3 s |
| 5,000 | 50.1 ms | 1,050 ms | 1,250 ms | 7,720 | 74.6 s |

The tail is the app's own main-thread work, not the harness: at 50 nodes this
harness resolves 60 fps with a 33.4 ms worst frame. Cost tracks the mounted DOM
(2 circles per node, ~77–80% of the corpus mounted at the fit view); mounted
edge paths stay constant at 105, so edges are batched and not the scaling term.
The 30 fps target is therefore a scaling problem rather than an impossible one
— the premise ADR 052's keep-SVG decision rests on.

### After the node-core LOD (Plan 211)

A CDP trace attributed 19.1 s of 24.7 s of main-thread task time to React's
scheduler flushes (paint 1.5 s, layout 1.6 s, GC 0.65 s), so the fix reduced
mounted elements rather than paint work. The decorative inner core dot is now
gated at `LABEL_LOD_NODE_THRESHOLD` (400 visible nodes), the same threshold
that already drops labels:

| Phase | Before | After |
| ----- | ------ | ----- |
| Pan p50 | 50.0 ms | 33.3 ms |
| Pan p95 | ~1,030 ms | 550–600 ms |
| Zoom p50 | 50–66.7 ms | 33.3–50 ms |
| Zoom p95 | ~950 ms | 500–540 ms |

At 5,000 nodes the median pan frame now meets the 30 fps target on software
rendering. The p95 tail remains ~550 ms because ~3,860 nodes are still mounted
at the fit view; batching node rendering is the open path there (ADR 052).

**The CI runner did not reproduce this gain.** The post-change CI run reported
pan p50 66.7 ms / p95 1,049.9 ms against 75.0 ms / 1,062.4 ms before it — a
difference inside run-to-run noise, because the E2E job runs every project in
parallel on a two-core runner and the frame timeline then measures CPU
contention rather than the app. The before/after above was measured
sequentially on a quiet machine, four runs per configuration. Treat the CI
column as a signal that the floors are stable, never as a comparison between
configurations; that is exactly why the node-core LOD is guarded by a DOM
assertion and a unit test rather than by a tightened frame ceiling.

**The 30 fps target is measured, not met.** At 1000/30 = 33.3 ms per frame the
target implies 30 fps; this runner delivers 15–20 fps median, and the idle
control is a clean 16.7 ms, so the gap is the work the page does rather than a
throttled animation clock. Under software rendering the SVG path pays a full
CPU raster of the mounted nodes on every pan frame. Two consequences are
recorded rather than papered over:

- The assertion is a **regression floor**, not the product target: p50/p95
  ceilings with ~2× headroom over the baseline above. It is falsifiable —
  disabling `cullNodes`/`cullEdges` raises pan p50 to 216.7 ms and fails it
  (verified by injection on 2026-11-13), which is the failure the guard exists
  for.
- Asserting 33.3 ms would require a GPU-backed runner. No runner in this
  project has one, so a 30 fps assertion here would be red everywhere and mean
  nothing. Whether the SVG path reaches 30 fps on a GPU is therefore still
  unmeasured, and `ADR 052`'s "keep SVG, no Canvas renderer" decision has been
  taken without that measurement.

The p95 figures are dominated by periodic ~1 s stalls present at baseline and
with culling disabled alike; they are guarded only against getting worse, not
explained by this baseline. The spec runs in the `chromium` project only — a
frame cadence describes one rendering engine on one viewport, so repeating it
under emulated WebKit and phone viewports would produce four numbers for four
emulators.

## Graph query evaluation (`src/lib/studio/graph-filter.bench.test.ts`)

Issue #1163 adds deterministic corpus fixtures and CPU budgets for the pure
query paths that run on the main thread before placement. The fixture
(`src/lib/studio/graph-bench-fixture.ts`) is a seeded, reproducible 1k/5k/10k
corpus with ring + shortcut edges (average degree ≈ 2.25), a spread of entity
types and tags, labels, and ~1.5 claims per entity — the same corpus the
perf-baselines runner and the E2E sweep can reload through the store fixture.

Budgets (regression floors, not measured targets — the first CI run prints the
measured values in the reporter next to the test names):

| Nodes | `filterGraph` ceiling | `evaluateGraphQuery` ceiling (nested query) |
| ----- | --------------------- | ------------------------------------------- |
| 1,000 | < 25 ms | < 25 ms |
| 5,000 | < 120 ms | < 150 ms |
| 10,000 | < 250 ms | < 300 ms |

These cover the "filtering" item of the benchmark scope. Selection, path
highlighting, and initial render are covered by the browser harness: selection
and path highlighting are additive SVG state (no per-frame corpus scan), and
initial render is the placement + DOM work the frame timeline already bounds.

## Not measured here

- **Frame rate on GPU hardware.** See the section above: the harness records
  software-rendered timings, which is what every runner available to this
  project provides.
- **Physical mobile devices.** The `mobile` project emulates an iPhone 13
  viewport in software; it is not a device, and no physical-device run exists
  in this repo.
- **Memory on non-Chromium engines.** Heap samples come from the Chromium
  metrics API (`page.metrics()`) and are `null` where that API is absent; the
  timeline spec therefore runs in the `chromium` project only.

## Frame-timeline sweep record (2026-11-18, issue #1163)

Recorded by `GRAPH_BENCH_SIZES=1,5,10 pnpm exec playwright test
e2e/graph-frame-timeline.spec.ts --project=chromium` on the CI-class Linux
runner (Linux x86_64, Chromium 156.0.8078.4 headless, `hardwareConcurrency` 14,
`deviceMemory` 8, 1280×720 viewport; software rendering). Pan/zoom p50 and p95
in milliseconds, from the `[frame-timeline]` lines the runner prints with its
own environment metadata:

| Nodes | pan p50 | pan p95 | zoom p50 | zoom p95 |
| -----:| -------:| -------:| --------:| --------:|
| 1,000 | 16.7 | 166.7 | 16.7 | 200.9 |
| 5,000 | 33.3 | 638.4 | 33.3 | 694.1 |
| 10,000 | 66.7 | 1246.6 | 49.9 | 910.8 |

All three sizes stay inside the 120 ms p50 / 1500 ms p95 ceilings the spec
asserts, and the 5k type-filter pass (`filterGraph` over the 5k corpus, 1250
surviving entities) re-rendered in 95 ms. Heap (`JSHeapUsedSize`) stayed in the
~64–250 MB band across the sweep; the runner prints per-run heap samples next
to the timings. These are regression floors for this runner class, not product
targets: GPU-accelerated hardware and physical mobile devices remain unmeasured
(the sections above), and the ceilings are asserted, not tuned, by the spec.

## Storage baselines

Unrelated to the graph, for reference: `canonical-storage.bench.test.ts` guards
legacy JSON and IndexedDB writes at 1k/5k/10k records, `vector-store.bench.test.ts`
guards cold/warm/single-edit search updates at the same sizes, and
`retrieval.bench.test.ts` guards cached-query speed against a cold rebuild.
