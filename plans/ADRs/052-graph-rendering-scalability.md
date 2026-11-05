# ADR 052 — Graph rendering scalability path

- Status: Accepted
- Date: 2026-11-05
- Issue: #1053
- Related: Plan 198, ADR 051 (graph queries), `plans/perf-baselines.md`

## Context

The graph renders as SVG. Real libraries (vault imports, synced merges) can hold
thousands of entities, and the layout was quadratic: every probe scanned all
placed nodes. There was no documented ceiling, no culling, and no level of
detail. The issue offered a Canvas 2D renderer as a fallback if budgets were
missed.

## Decision

1. **Fix placement first.** A uniform spatial hash reduces placement from O(n²)
   to O(n · probes · neighbours). Measured: 5k nodes in ~470 ms, down from the
   multi-second range.
2. **Chunk placement across frames.** `PLACEMENT_CHUNK_SIZE = 250` per
   `requestAnimationFrame` keeps each main-thread slice inside the 50 ms
   ceiling. No worker: the corpus would have to be serialized across the
   boundary for a single one-shot computation.
3. **Cull to the viewBox and gate labels by zoom.** Mounted nodes and edges are
   bounded by what the viewBox shows; labels disappear where they are unreadable
   anyway.
4. **Keep the SVG renderer as the only renderer.** A Canvas 2D path is deferred,
   not adopted: it would need a parallel keyboard/ARIA surface, and the measured
   budgets are met without it.

## Consequences

- Accessibility parity is structural, not a second implementation to maintain:
  every rendered node is still a focusable `role="button"` with an accessible
  name.
- The graph view now owns three concerns (filter/query state, placement
  scheduling, rendering culling). Each lives in its own module, and the view
  only composes them.
- Frame rate is not yet asserted by a check; `plans/perf-baselines.md` records
  the measured proxies and the method to measure real frame timing.
- If a future corpus misses the frame target with SVG, ADR 052 is the decision
  to revisit — the fallback would be a Canvas renderer selected above a node
  threshold, with the SVG path retained for small graphs.

## Alternatives considered

- **Canvas-only renderer**: rejected — keyboard navigation, focus rings, and
  ARIA labels would have to be rebuilt, and nothing measured yet requires it.
- **Web Worker layout**: deferred — serialization cost and one-shot usage make
  chunking the better trade at these sizes.
- **Hard node cap with a "show more" affordance**: rejected — hiding data from
  an import silently is worse than drawing it more cheaply.
