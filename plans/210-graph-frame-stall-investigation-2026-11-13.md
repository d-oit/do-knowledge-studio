# Plan 210 — Where the ~1 s graph frame stalls come from

**Status**: Investigation complete, fix not started
**Date**: 2026-11-13
**Related**: Plan 207 (frame-timeline harness), `plans/perf-baselines.md`

## Question

Plan 207 recorded pan p50 50–75 ms and p95 ~1,000 ms at 5,000 nodes. A p95
twenty times the median is not a slow feature, it is a stall — and a stall with
no attribution invites the wrong fix. Two possibilities had to be separated
before any work: an artifact of the headless harness (Playwright's rAF
scheduling, a screenshot, a GC bumped by the driver process) or real
main-thread work in the app.

## Method

Temporary instrumentation, reverted before commit (`git status` clean):

1. `NODE_COUNT` read `process.env.FRAME_NODES` so one spec could measure three
   corpus sizes with everything else — gestures, thresholds, zoom-out-to-fit —
   identical.
2. A `PerformanceObserver` on `longtask` installed via `addInitScript`, plus a
   post-run `querySelectorAll` count of mounted `svg circle` elements. Long
   tasks are main-thread occupancy of 50 ms or more; if the stalls were
   raster/compositor work, frame gaps would exceed the long-task total.
3. Each size run once in headless Chromium with software rendering.

## Results

| Nodes | Pan p50 | Pan p95 | Worst | Mounted circles | Long tasks | Longest task | Long-task total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50 | 16.7 ms | 16.8 ms | 33.4 ms | not probed | not probed | not probed | not probed |
| 500 | 16.7 ms | 200 ms | 300 ms | 804 | 50 | 306 ms | 8,258 ms |
| 5,000 | 50.1 ms | 1,050 ms | 1,250 ms | 7,720 | 192 | 891 ms | 74,591 ms |

(500 and 5,000 rows come from the instrumented runs; the 50-node row from the
unmodified spec, which does not probe long tasks.)

Each node renders exactly two `<circle>` elements unless it is selected, which
renders a third (the selection ring). Reading the 804 and 7,720 counts through
that: about 402 of 500 nodes and 3,860 of 5,000 nodes are mounted after the
zoom-out-to-fit — 77–80% of the corpus, i.e. culling is proportional rather
than a bounded cap. Mounted `path` elements stay at 105 in both runs, so edges
are already batched into one path each and are not the scaling term.

## What this establishes

- **Not a harness artifact.** At 50 nodes the same harness, same gestures and
  same software rendering produce p50 16.7 ms with a 33.4 ms worst frame. The
  measurement apparatus is capable of resolving 60 fps; it is the app that
  cannot hold it at scale.
- **Main-thread bound.** Long-task time tracks the frame gaps: 74.6 s of
  >50 ms tasks at 5,000 nodes versus 8.3 s at 500. If the stalls were
  compositor or raster work, the long-task totals would not scale with node
  count while frame gaps did — both scale together.
- **The 30 fps target is not absurd.** It is met at 50 nodes and the median is
  met at 500. The target is a scaling problem, not an SVG-impossible target,
  which is the premise ADR 052's keep-SVG decision rests on.

## What this does not establish

The identity of the 891 ms outlier. A long task is a duration, not a cause: it
could be a garbage collection pause proportional to the live object graph, one
React commit that busts a memo and re-renders every mounted node, or one paint
of the whole layer. Separating those needs a Chrome trace (CDP
`Tracing.start`) or React's profiler — both are new harness machinery and were
out of scope for an investigation.

## Candidates, ranked by what the data supports

1. **Per-node DOM**: each node mounts a focusable `<g role="button" tabindex>`
   with `aria-label` and handlers, containing two `<circle>` elements (a third
   when selected). That is ~7,700 elements to reconcile and paint per frame at
   the fit view. Labels are already LOD-gated above 400 nodes
   (`LABEL_LOD_NODE_THRESHOLD`); the decorative inner circle (`r * 0.4`,
   `opacity 0.3`) and the per-node ARIA scaffolding are not gated at all — the
   same threshold could drop roughly half the mounted circles.
2. **Per-frame allocation**: `visibleRect`, `renderedNodeIds` and
   `renderedEdges` rebuild on every `panOffset` change — a `Set` over mounted
   ids and a `cullEdges` pass over all edges per pointer move. Measured edge
   count in the DOM says the edges themselves are cheap to paint; this is about
   the JS above them, and it is a smaller term than the DOM.
3. **Accessibility side effect worth recording**: at 3,800 mounted nodes the
   graph offers 3,800 tab stops. Whatever fixed the frame cost would likely
   also be the right fix for keyboard navigation.

## Next step

Instrument one pan with a CDP trace and attribute the 891 ms task. Only then
choose between LOD-gating the per-node DOM and batching node rendering — a
change to either is a persistence-adjacent visual change that needs the
delivery lifecycle's evaluate and adversarial stages, not a drive-by patch.
