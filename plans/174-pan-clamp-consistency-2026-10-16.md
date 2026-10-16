# Plan 174 — Pan-clamp consistency across keyboard and restore paths

**Date:** 2026-10-16  
**Status:** In progress  
**Related:** Plan 169 (F3 gesture spec), Plan 162 addendum, `src/lib/studio/graph-gestures.ts`

## Discovery

Adversarial verification of the shipped F3 gesture feature (Plan 169) against its own invariant: *panOffset remains clamped so nodes cannot become unreachable*. Mapping every pan entry point showed three of four paths clamp through `computeMaxPan` (the dynamic bound `max(4000, canvasMaxDim × zoom × 3)`), while two paths did not:

| Path | Clamp before this plan |
|---|---|
| Pointer drag (`computeDragPanOffset`) | dynamic bound ✓ |
| Wheel zoom (`computeFocalZoom`) | dynamic bound ✓ |
| Pinch (`computePinchGesture`) | dynamic bound ✓ |
| **Keyboard arrows** (`use-graph-keyboard`) | **none — unbounded drift** ✗ |
| **Snapshot restore** (`useGraphSnapshotComparison`) | **static `MAX_PAN` floor only** ✗ |

Note on the spec text: Plan 169 phrases the bound as the literal `[-4000, 4000] (MAX_PAN)`, but the implementation deliberately generalizes to the dynamic bound so nodes placed on a grown canvas (up to `canvasMaxDim × zoom × 3`) stay reachable — this is unit-tested (`scales with large canvas and high zoom to keep outer nodes reachable`). This plan aligns the two deviating paths to that dynamic bound rather than regressing the others to a static floor.

## Defects

1. **Keyboard pan unbounded.** Holding an arrow key drifts the canvas by 30 units per repeat with no limit; ~5 seconds of key-repeat passes 4000 units and parks the graph off-view with only `Home` as recovery.
2. **Restore silently alters legal deep pans.** At zoom 3 on the authored 800×560 canvas the dynamic bound is 7200, so the drag path can legally pan to e.g. −4500; restoring that snapshot clamped to the static 4000 floor, breaking the save/restore round-trip fidelity promised by Plan 157.

## Fixes

- `use-graph-keyboard.ts` takes the live `canvas` and `zoom`; every arrow press clamps the moved axis to `computeMaxPan(canvas, zoom)` — identical semantics to the drag path (absolute clamp, snaps toward the bound).
- `use-graph-snapshot-comparison.ts` takes the live `canvas`; restore clamps with `computeMaxPan(canvas, snapshot.zoom)` (the bound the value was legal under), keeping the hand-edited-value protection intact.
- `graph-view.tsx`: the two hooks are called after the `canvas` memo so they receive the live value.

## Verification

Red-first (both tests failed before the fix and pass after):

- `clamps arrow-key panning at the pan bound instead of drifting without limit` — 200 presses (6000 units) then 50 more; the viewBox must stop moving.
- `restores a deep legal pan that lies beyond the static floor exactly` — snapshot `panX: -4500, zoom: 3` restores to `minX 1500` (was 1333.33 under the static clamp).

Suite runs: graph-view (23), graph-view-coverage (29), graph-snapshot (21) — 73/73; lint and typecheck green; full gate via the pre-commit hook; CI on the PR.
