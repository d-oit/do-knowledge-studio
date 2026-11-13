# Plan 207 — Graph frame-timeline harness (2026-11-13)

**Status**: Complete — `e2e/graph-frame-timeline.spec.ts` records pan/zoom frame
intervals at 5,000 nodes and asserts regression floors; baseline recorded in
[perf-baselines](perf-baselines.md).

## Problem

Plan 198 closed #1053 with an explicit gap: "The 30 fps pan/zoom target is **not
asserted by any check**: the repository has no browser frame-timeline harness."
The guarantees that did ship were bounded mount counts (culling unit tests) and
a chunked placement budget (vitest bench) — both proxies. Nothing read a frame,
so any change that made a pan frame take 200 ms would have passed every check in
the repository.

## What was built

`e2e/graph-frame-timeline.spec.ts`, Chromium desktop only:

- Seeds 5,000 entities with 2 links each through `seedStore` (the shared,
  schema-validated fixture), navigates to the graph, and waits for progressive
  placement to stop reporting progress.
- Installs a `requestAnimationFrame` sampler in the page, drives a real
  pointer-drag of 48 steps and, in a second sample, 24 real wheel events, then
  reads back the interval between frames.
- Reports p50/p95/worst per phase to the test output and asserts per-phase p50
  and p95 ceilings.

Pan and zoom are sampled separately: pan exercises pointer capture and
`computeDragPanOffset`; zoom exercises the focal-zoom path over a re-computed
viewBox. They fail for different reasons and had different baselines.

## The measurement

Chromium 156 headless, software rendering (2026-11-13):

| Phase | p50 | p95 | 30 fps target |
| ----- | --- | --- | ------------- |
| Pan | 50–67 ms | ~1,030–1,050 ms | 33.3 ms |
| Wheel zoom | 50–67 ms | ~950–970 ms | 33.3 ms |

An idle control on the same browser measures a clean 16.7 ms cadence, so the
gap is the page's own work under software rasterization, not a throttled
animation clock.

## Decisions

1. **Assert a floor, not the target.** A 33.3 ms assertion would be red on every
   runner available to this project, because none has a GPU. Shipping it would
   mean a permanently failing check that everyone learns to ignore — the
   opposite of the intent. The spec asserts p50 ≤ 120 ms and p95 ≤ 1,500 ms per
   phase (~2× headroom over the baseline) and prints the target alongside, so
   the distance between measurement and target stays visible.
2. **Prove the floor can fail.** The guard was verified by injection: with
   `cullNodes`/`cullEdges` returning everything, pan p50 rises to 216.7 ms and
   zoom p50 to 166.7 ms, and the spec fails on the pan p50 ceiling. Reverted
   after the check was observed red (LESSON-041).
3. **Chromium desktop only.** A frame cadence is a property of one engine on one
   viewport; running it under emulated WebKit and two phone viewports yields
   four numbers for four emulators and quadruples the suite's slowest test.
4. **Measure the default view, not the worst case.** The spec deliberately skips
   zooming out to the whole library first. That path is heavier (~183 ms p50
   when recorded) and is left as a documented figure rather than a second
   assertion, because the default focus-mode view is what a 5k corpus opens
   into.

## Known gap (carried forward, now quantified)

The 30 fps target itself remains unasserted: it needs a GPU-backed runner to be
measured at all. `ADR 052`'s "keep SVG, no Canvas renderer" decision was taken
without a GPU measurement of the SVG path, and that is now stated explicitly in
`perf-baselines.md` instead of implied. If the target matters, the honest next
step is a deliberate measurement on GPU hardware, not a tighter threshold here.

## Verification

- `pnpm exec playwright test e2e/graph-frame-timeline.spec.ts --project=chromium`
  → 1 passed (1.4 min), pan p50 66.6 ms / p95 1,033.3 ms, zoom p50 66.6 ms /
  p95 951.7 ms.
- Injection run (culling disabled) → 1 failed on the pan p50 ceiling
  (216.7 ms > 120 ms); file restored, `git diff` empty.
- `pnpm exec eslint e2e/graph-frame-timeline.spec.ts playwright.config.ts` →
  clean.
- `--list` shows the spec in the `chromium` project only.
