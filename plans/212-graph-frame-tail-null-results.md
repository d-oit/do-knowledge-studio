# Plan 212 — Graph Frame Tail: Two Falsified Hypotheses

**Date**: 2026-11-13
**Status**: Complete — both candidate fixes reverted; the 5,000-node tail is **not** explained by node re-rendering or by the per-move layout read
**Related**: [210](210-graph-frame-stall-investigation.md), [211](211-graph-frame-trace-attribution.md), [perf-baselines](perf-baselines.md), [ADR 052](ADRs/052-graph-rendering-strategy.md)

## Question

Plan 211's CDP trace put ~77% of a pan frame in React work
(`performWorkUntilDeadline` 19.09 s over 138 flushes) and the rest in paint
(1.51 s) and layout (1.31 s) across 5,000 nodes. Two cheap, low-risk fixes
followed from that. Both were implemented, measured, and **reverted**.

## Hypothesis 1 — every node subtree re-renders on pan

The per-node `<g>` was inline in `graph-view.tsx`, so a `panOffset` state
change re-rendered all ~3,860 mounted node subtrees, even though panning only
changes the SVG `viewBox` and no node's `x`/`y` moves.

**Change tried**: extract `GraphNodeElement` into `graph-elements.tsx`,
wrapped in `react.memo`, taking stable props (`cullNodes` is a `filter`, so
node object identity survives a pan; `handleNodeFocus` / `handleNodeBlur`
added as `useCallback`).

**Bailout proven** (`graph-node-element.test.tsx`, since deleted): a spy on
`getEntityTypeMeta` — which runs inside the node body — was not called when
the parent re-rendered with identical props, and *was* called when `selected`
changed. Removing `memo` failed the test (`expected "vi.fn()" to not be
called at all, but actually been called 2 times`), so the guard could fail.

**Frame harness** (`e2e/graph-frame-timeline.spec.ts`, chromium, software
rendering), memoised vs. baseline:

| Run pair | Baseline pan p50 / p95 | Memo pan p50 / p95 |
|---|---|---|
| 1 | 33.4 / 566.5 | 50.0 / 850.0 |
| 2 | 50.0 / 1,033.3 | 33.3 / 562.4 |
| 3 | — | 49.9 / 1,033.2 |

**Verdict**: no effect outside run-to-run noise (baseline p95 spans
550–1,050 ms on its own). The bailout is real but does not move the frame
tail, so the change was reverted rather than shipped as an unmeasured
optimization.

## Hypothesis 2 — a forced layout on every pointermove

`use-graph-canvas-gestures.ts` called `svg.getBoundingClientRect()` inside
`handlePointerMove`, i.e. a forced synchronous layout of a 7,720-circle SVG
on each pointer event, interleaved with the state commits that invalidate it.

**Change tried**: cache the rect at `pointerdown`, reuse it in
`handlePointerMove`, refresh in `handleWheel`, clear on `pointerup`.

**Frame harness**, four alternating pairs:

| Pair | Baseline pan p50 / p95 | Cached pan p50 / p95 |
|---|---|---|
| 1 | 66.8 / 1,506.5 | 50.1 / 928.3 |
| 2 | 50.0 / 1,033.3 | 33.3 / 616.6 |
| 3 | 33.4 / 700.0 | 33.4 / 655.9 |
| 4 | 33.3 / 599.9 | 33.3 / 583.3 |

**Verdict**: pairs 1–2 favoured the cache and pairs 3–4 were parity (< 3%
apart); the early gap tracks machine load, not the change. Reverted.

## What this rules out

- Node-subtree render volume is **not** the driver of the ~600–1,000 ms p95 tail.
  Removing 3,860 subtree re-renders per pan changed nothing measurable.
- The per-move layout read is **not** the driver either.

Remaining candidates, in the order worth testing next:

1. **Paint/raster cost of the mounted DOM.** Culling keeps ~77–80% of nodes
   mounted at fit view on a 5,000-node graph (7,720 circles + 3,860 labels at
   the LOD threshold). With software rendering that is a fixed per-frame
   raster bill, which is exactly what node-side memoisation cannot touch.
2. **rAF cadence rather than work.** `panOffset` updates arrive per pointer
   event; if commits are not coalesced to one per frame, frames queue behind
   input handling. Measure commit count per pan before changing anything.
3. **The canvas/no-DOM path** ADR 052 deferred. Still the only change that
   removes the raster bill outright, and still a rewrite.

## Measurement caveat

Every number here is a **quiet local machine, software rendering**
measurement from `e2e/graph-frame-timeline.spec.ts`, whose floors are
deliberately loose (pan p50 ≤ 120 ms, p95 ≤ 1,500 ms) for that reason. CI runs
four Playwright projects on two cores and cannot reproduce local timings at
all (Plan 211). Treat a difference under ~30% between two local runs as noise
until an A/B pair reproduces it.
