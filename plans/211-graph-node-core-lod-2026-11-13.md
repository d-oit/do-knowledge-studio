# Plan 211 — Drop the decorative node core on large graphs

**Status**: Complete
**Date**: 2026-11-13
**Related**: Plan 207 (harness), Plan 210 (stall investigation), `perf-baselines.md`

## Where the time actually goes

Plan 210 established that the ~1 s frame stalls are main-thread work growing with
the mounted DOM, but could not say which main-thread work. A CDP trace of one
pan at 5,000 nodes (temporary probe, deleted; `Tracing` categories
`devtools.timeline`, `v8`, `blink.user_timing`, `disabled-by-default-v8.gc`)
answers it. 873,874 trace events; 76.2 s of main-thread event time in total:

| Category | Total | Notes |
| -------- | ----- | ----- |
| `RunTask` (task wrapper) | 24.66 s | 1,856 tasks, max 656 ms |
| `FunctionCall` / `v8.callFunction` | 20.48 s | 955 calls |
| — of which `performWorkUntilDeadline` | **19.09 s** | 138 React scheduler flushes, max 656 ms |
| `Paint` | 1.51 s | |
| `UpdateLayoutTree` | 1.31 s | |
| `Layerize` | 0.99 s | |
| `PrePaint` | 0.42 s | |
| `Layout` | 0.25 s | |
| GC (`MinorGC` + scavenger phases) | ~0.65 s | 123 scavenges, no major GC |

So: **77% of task time is React rendering the graph tree**, 18% is everything
the browser does to paint and lay it out, and under 3% is garbage collection.
The 891 ms outlier Plan 210 could not attribute is a single scheduler flush —
the longest measured here is `performWorkUntilDeadline` at 656 ms. GC and paint
are both ruled out, and the fix has to reduce the number of nodes React
reconciles per frame, not the paint.

## Change

Each node renders two `<circle>` elements: its visible dot and a decorative
inner core (`r * 0.4`, `opacity 0.3`). Above `LABEL_LOD_NODE_THRESHOLD` (400
visible nodes) the graph already drops node labels and relation labels — it is
in its reduced-detail mode — but the core dot was rendered at every size.

`shouldRenderNodeCore(nodeCount)` in `graph-culling.ts` gates it at the same
threshold the labels use, and `graph-view.tsx` honours it. Half the circles,
half the React work per frame, with no information lost: the core dot carries
nothing the node circle does not.

## Measured effect (same harness, same machine, software rendering)

| Phase | Before | After | Change |
| ----- | ------ | ----- | ------ |
| Pan p50 | 50.0–50.1 ms | **33.3 ms** | 1.5× — meets the 30 fps target at the median |
| Pan p95 | 1,016–1,050 ms | **550–600 ms** | ~45% lower |
| Pan worst | 1,083–1,250 ms | 617–667 ms | ~half |
| Zoom p50 | 50.0–66.7 ms | 33.3–50.0 ms | |
| Zoom p95 | 907–983 ms | 500–540 ms | ~46% lower |

The halving of mounted circles produced a ~45% cut in the tail, which is what
the trace predicts: React render work dominates, so element count is the term
that matters. This is the first configuration in this repository where the
median pan frame meets #1053's target, and it does so without a GPU.

**Not reproduced on CI, and not claimed to be.** The post-change CI run
measured pan p50 66.7 ms / p95 1,049.9 ms against 75.0 / 1,062.4 before —
inside noise. The E2E job runs all projects in parallel on a two-core runner,
so its frame timeline is dominated by CPU contention; the before/after above
is four sequential runs on a quiet machine. The change is therefore guarded by
the unit test and the DOM assertion (both load-independent), not by the frame
ceiling — which stays where it was for the same reason.

## Guards, both machine-independent

1. `shouldRenderNodeCore` unit test — flipping the helper to `true` fails it
   (`expected true to be false`).
2. A DOM assertion in `graph-frame-timeline.spec.ts`: at 5,000 nodes, the
   circle count equals the node count. With the helper reverted the spec fails
   `Expected: 5000 / Received: 10000` — verified, then restored.

The frame floors in the spec are unchanged. They are hardware-sensitive
regression bounds, not the product target; tightening them to 33 ms would make
CI red on a runner without a GPU, and the LOD decision is guarded exactly by
the two checks above instead.

## What this does not fix

- The p95 tail is still ~550 ms. React work scales with mounted nodes and
  3,860 of them remain at the fit view; a real fix there is batching node
  rendering (canvas or a single path per type), which ADR 052 deliberately
  deferred.
- 3,860 focusable nodes is still 3,860 tab stops. The DOM reduction helps
  keyboard navigation without fixing it; that is an accessibility track, not a
  performance one.
