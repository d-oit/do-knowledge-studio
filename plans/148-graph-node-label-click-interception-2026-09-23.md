# Plan 148 — Graph Node Labels Could Steal Clicks (2026-09-23)

**Type**: defect fix (graph layout) + regression coverage
**Scope**: `src/lib/studio/graph-layout.ts` (new), `src/lib/studio/graph-layout.test.ts` (new),
`src/components/studio/views/graph-view.tsx`
**Found by**: full-suite E2E sweep on `main` (all four Playwright projects)

## 1. Problem

`e2e/editor-mentions.spec.ts` failed once during a full-suite run and passed on
retry. Playwright's log named the interceptor:

```
waiting for getByRole('button', { name: /Mentions Note/ })
  locator resolved to <g … transform="translate(549.28, 192.64)">…
  <text y="25" …>40 Inventive Principles</text> from
  <g transform="translate(600, 180)" aria-label="40 Inventive Principles — Concept">
  subtree intercepts pointer events
```

The freshly created "Mentions Note" node sat 52px from the seed node
"40 Inventive Principles", and that seed's label covered the new node's click
point. In SVG the topmost element receives the click, so **clicking a node could
select a different one** — not just a test problem.

Why it was intermittent: entity ids are random UUIDs and the position was a pure
hash of the id (`seededRandom(\`${e.id}:x\`) * 600 + 100`), so each run drew a new
position. The suite passed 5/5 in isolation and failed roughly one run in ten
across the full sweep.

## 2. Geometry

The numbers matter, so they are derived rather than guessed:

- A click lands at the centre of the node's bounding box — the dot plus its
  label, i.e. ~10px below the node's centre.
- A label sits in the band 15–30px below its own node's centre and is
  `text-caption` (10px) wide, truncated at 24 characters → half-width ~66px.
- Interception therefore needs `4.5 <= Δy <= 19.5` and `|Δx| <= 66`, whose
  largest possible separation is `hypot(66, 19.5) ≈ 68.8`.

So a centre-to-centre distance of **80px** makes interception impossible, while
**140px** additionally stops two labels from overlapping at the same height
(132px label width). Seed nodes sit 150–400px apart, so 140 matches the authored
layout.

## 3. Fix

New module `src/lib/studio/graph-layout.ts` owns placement:

1. Entities with an authored seed position keep it and act as fixed obstacles.
2. Unseeded entities are placed in **id order** (so the result does not depend on
   the library's sort order) by a deterministic golden-angle probe:
   - accept the hash-derived base when it clears every placed node at
     `PREFERRED_NODE_DISTANCE_PX` (140);
   - otherwise probe 32 candidates for a preferred slot;
   - otherwise probe again at `CLICK_SAFE_NODE_DISTANCE_PX` (80);
   - otherwise keep the candidate with the most clearance.

Density therefore degrades *legibility* (labels may overlap in a crowded graph)
before it degrades *click accuracy* (a label can never steal a dot's click).

`graph-view.tsx` keeps only the edge-building and rendering; the inline hash and
placement logic moved out, taking the file from 469 to 447 lines (limit 500).

### Trade-offs, stated plainly

- The canvas (600×400 placement band) fits roughly **five** nodes at the
  preferred spacing around the eight seed nodes (measured). Beyond that, new
  nodes land on the click-safe tier — still clickable, closer together.
- Adding an entity can move new nodes whose id sorts after it, because the probe
  avoids already-placed nodes. Seeded nodes never move.
- A canvas too crowded for both tiers keeps the most-clear position found, so
  overlap is minimised rather than guaranteed absent.

## 4. Verification

| Check | Result |
|---|---|
| `pnpm exec vitest run src/lib/studio/graph-layout.test.ts` | 11/11 pass |
| Graph view suites (`graph-view.test.tsx`, `graph-view-coverage.test.tsx`) | 39 pass, unchanged |
| Clearance regression: 200 synthetic ids against the actual interceptor seed node | every placement keeps ≥ 140px |
| Twelve new entities alongside the eight seed nodes | every placement keeps ≥ 80px from every seed |
| Three new entities | every placement keeps ≥ 140px (preferred tier) |
| Saturated canvas | returned position is never worse than the hash-derived base |
| Order independence | reversed entity lists produce identical id→position maps |
| `e2e/editor-mentions.spec.ts --repeat-each=10` | 10/10 pass (was ~1 failure per full sweep) |
| Full E2E suite (596 tests, all four projects) | 592 passed, 4 skipped, 0 failed |
| `pnpm run lint`, `pnpm run typecheck` | clean |
| `./scripts/quality_gate.sh` | ✓ all gates passed |

## 5. Full-suite results

The sweep that found this ran `pnpm run test:e2e` (all four projects, 596 tests)
on `main` before the fix: **591 passed, 4 skipped, 1 flaky** — the flaky test was
this defect. CI never sees it because the E2E job runs `--project=chromium` only,
and even there it only fails when the random id draws a colliding position.

A second full sweep after the fix flagged `e2e/semantic-search.spec.ts` ("lexical
fallback hint") failing on both attempt and retry, but that spec passes 9/9 in
isolation and passed in the next full sweep — it waits up to 20 s for
transformers.js to finish failing its blocked CDN fetches, which parallel load
can stretch. Recorded as a follow-up (§6.1), not a regression from this change.

## 6. Follow-ups

1. **`semantic-search.spec.ts` is load-sensitive** — it waits 20 s for the
   blocked-CDN failure to surface the fallback hint; under a full parallel sweep
   that budget can be exceeded (observed once, passed on the next sweep and 9/9
   in isolation). Either raise the budget or assert on a signal that does not
   depend on a failing network request.
2. **CI still runs E2E on one project only** — mobile (390px) and tablet (834px)
   are never exercised on PRs. This sweep is worth repeating periodically, or
   worth a scheduled job (the nightly CI run already exists; extend it).
3. **Graph density** — the placement band is small relative to the seed layout,
   so a large library crowds. A viewport-aware band or zoom-to-fit would help.
4. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
5. **ESLint 10 workaround** (plans/140 §2) — blocked upstream
   (`eslint-plugin-react` still caps its peer range at `^9.7`).
