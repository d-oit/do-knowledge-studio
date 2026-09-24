# Plan 152 — Graph Density: the Canvas Grows With the Library (2026-09-24)

**Type**: product defect + layout fix
**Scope**: `src/lib/studio/graph-layout.ts`, `src/lib/studio/graph-viewport.ts` (new),
`src/components/studio/views/graph-view.tsx`, `e2e/graph-density.spec.ts` (new)
**Follows**: plans/148 §6.3 ("Graph density — the placement band is small relative to
the seed layout, so a large library crowds. A viewport-aware band or zoom-to-fit
would help.")

## 1. Problem

plans/148 placed unseeded nodes with a probe that keeps its distance from every
already-placed node, and measured the click-safe distance from the label geometry
(80px). But the band it probes inside is fixed — 600×400, inside the 800×560
canvas — and once that band is full the probe falls back to "the candidate with
the most clearance", which can be **closer than click-safe**. The wrong-entity
selection that plans/148 fixed therefore returns as soon as the library is large
enough to saturate the band.

Measured, before any change (8 seed nodes + 40 new entities):

```
"Genrich Altshuller ↔ Entity new-8: 68.7px"
"Local-First Software ↔ Entity new-37: 60.0px"
"Entity new-17 ↔ Entity new-38: 45.6px"
… 42 pairs closer than the 80px click-safe distance
```

This is not cosmetic. A pair closer than click-safe means one node's label covers
the other's dot, SVG gives the click to the topmost element, and the user selects
the wrong entity.

## 2. Fix

Two halves, and both are required — the second is what makes the first safe.

### 2.1 The placement band grows with the library (`graph-layout.ts`)

`placementBand(unseededCount)` starts at the authored band and doubles its area per
tier (`√2` per axis) until it holds the library at the preferred spacing:

| unseeded entities | band | capacity at preferred spacing |
|---|---|---|
| ≤ 6 | 600×400 (authored) | 6 |
| 7–12 | 848×565 | 12 |
| 13–24 | 1200×800 | 24 |
| 25–48 | 1697×1131 | 48 |

`BASE_BAND_CAPACITY = 6` is derived from the authored layout: (600×400 − 8 seed
obstacles × ~17k px²) ÷ ~17k px², where 17k px² is one node's share of the plane
at `PREFERRED_NODE_DISTANCE_PX` under hexagonal packing. Growth is tiered rather
than continuous, so the canvas grows in steps instead of rescaling on every
insert; individual positions can still shift when an entity is added, because
placement is sequential over a deterministic id order.

### 2.2 The canvas grows with the band (`graph-viewport.ts`, new)

The view hard-coded `viewBox="0 0 800 560"`. Left that way, the grown band is not
just crowded but **invisible**: the mutation check below measured 56 of 60 nodes
drawn outside the canvas, where they cannot be clicked or panned to (the viewBox
never grows, so panning cannot reach them either).

`canvasSize(nodes)` returns the authored canvas or the smallest canvas that
contains every node *and its label* (labels span ±66px and hang below the dot —
the same measurement `PREFERRED_NODE_DISTANCE_PX` is built on). `canvasViewBox`
composes that size with the existing zoom/pan state. Resetting the view (Home)
therefore always shows the whole graph, and no new control or string is needed.

The canvas is derived from `positioned` rather than `visibleNodes`: focus mode
filters what is drawn, and the canvas must not shrink under the nodes when it
toggles.

This also covers the `circular` and `hierarchical` layouts, which place nodes on
their own grid and already exceeded 800×560 at ~25 entities.

## 3. Verification

| Check | Result |
|---|---|
| New invariant test (8 seeds + 40 entities, every pair ≥ click-safe) | **fails before** (42 pairs, listed above) → **passes after** |
| `pnpm exec vitest run graph-layout graph-viewport graph-view…` | 62 passed |
| Mutation: revert the view to `0 0 800 560` | component test fails (`expected 800 to be greater than 800`); E2E reports 56 nodes outside the canvas |
| `pnpm exec playwright test --project=chromium` | **151 passed** (2.3 m), including the two new density tests |
| `./scripts/quality_gate.sh` | see §4 |

`e2e/graph-density.spec.ts` seeds 60 entities through the Zustand persist envelope
(the `library-virtualization.spec.ts` pattern) and asserts that every node's box
is inside the canvas, and that clicking a node selects *that* node.

## 4. Gate and CI results

| Check | Result |
|---|---|
| `./scripts/quality_gate.sh` (full, all scopes) | **✓ All Quality Gates PASSED** — lint, typecheck, test (2635), shellcheck, `bats tests/`, link validation |
| `pnpm exec playwright test --project=chromium` | 151 passed (2.3 m) |

## 5. Trade-offs

- **A large graph renders smaller.** The canvas grows and `preserveAspectRatio`
  fits it, so a 60-entity library draws at roughly half scale. That is the
  intended reading of "fit to content": detail comes from zooming in, and the
  alternative is the wrong-entity click. Labels stay legible until roughly the
  40-entity tier.
- **Growth is tiered, not continuous.** Crossing a tier grows the canvas once.
  Continuous growth would rescale the graph on every insert, which is worse. It
  does not make positions immutable within a tier: placement is sequential over a
  deterministic id order, so inserting an entity that sorts before others can move
  theirs (corrected after review — the first version of this note overclaimed).
- **The seed layout never moves.** Growth extends the band right and down from
  (100, 80), so the authored 8-node layout keeps its positions.

## 6. Follow-ups

1. **A viewport-aware tier size** — the band grows with the entity count, not with
   the rendered viewport. On a large display the same library could hold the
   preferred spacing in a shorter band.
2. **`semantic-search.spec.ts` load sensitivity** (plans/148 §6.1) — unchanged.
3. **ESLint 10 workaround** (plans/140 §2) — still blocked upstream.
