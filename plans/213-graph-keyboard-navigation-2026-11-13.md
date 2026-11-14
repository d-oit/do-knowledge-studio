# Plan 213 — Graph Keyboard Navigation Without Thousands of Tab Stops

**Date**: 2026-11-13
**Status**: Complete — roving tabindex plus arrow-key navigation shipped and guarded
**Related**: [210](210-graph-frame-stall-investigation.md), [211](211-graph-node-core-lod-2026-11-13.md), [212](212-graph-frame-tail-null-results.md), [175](175-mindmap-treeview-tab-stop-2026-10-16.md), [DELIVERY-LIFECYCLE](../agents-docs/DELIVERY-LIFECYCLE.md)

## Problem

Every graph node rendered as `<g role="button" tabIndex={0}>`. At 5,000 entities
~3,860 nodes mount at the fit view, so the graph was 3,860 consecutive tab
stops: a keyboard user pressing Tab anywhere before the canvas could not reach
the controls after it, and the canvas itself had no keyboard path *into* the
nodes. Plan 175 fixed the same class of defect in the Mind Map; the graph was
still open.

## Change

**Roving tabindex.** Exactly one rendered node is tabbable — the selected node
when it is mounted, otherwise the first rendered node, otherwise (once the user
has moved) the last node they were on, if it is still rendered.

**Directional arrow navigation.** Arrow keys on a focused node move to the
nearest node in that direction, scored as forward travel plus twice the
perpendicular offset, so the cursor travels through the layout instead of
jumping to whatever node is closest in a straight line. Ties break by id.
`Enter`/`Space` still select.

**Key isolation.** Node keys call `stopPropagation()`. The canvas
(`role="application"`) pans on arrows; without isolation, pressing Right on a
node both moved focus and panned the view. This was a real defect in the first
cut, caught by the test below.

Files:

| File | Change |
|---|---|
| `src/lib/studio/graph-keyboard-nav.ts` | New: `findDirectionalNodeId`, `NAV_KEY_DIRECTIONS`, direction vectors, `PERPENDICULAR_WEIGHT` |
| `src/components/studio/views/graph-elements.tsx` | New `GraphNodeElement` (extracted from `graph-view.tsx`, which had reached 516 LOC against the 500 limit); takes `data-node-id` and `tabIndex` |
| `src/components/studio/views/graph-view.tsx` | `activeNodeId` state, `tabbableNodeId`, `focusNode`, extended `handleNodeKeyDown`; 482 LOC |

## Verification

**Unit** — `graph-keyboard-nav.test.ts` (7 tests): each direction, null at the
edge, no zig-zag through perpendicular neighbours, ahead-beats-diagonal,
deterministic tie-break, unknown node.

**Component** — `graph-view.test.tsx` gained two tests:

- exactly one `tabindex="0"` among the rendered nodes, every other node `-1`;
- pressing an arrow that has a node in that direction moves the roving stop to
  the node `findDirectionalNodeId` names, moves DOM focus with it, and leaves
  the `viewBox` untouched (i.e. does not also pan).

**Both guards were seen to fail** (LESSON-041):

| Re-injected defect | Result |
|---|---|
| `tabIndex={0}` on every node | 2 failed — the single-tab-stop test and the focus-move test |
| removed `stopPropagation()` | 1 failed — `expected '0 30 800 560' to be '0 0 800 560'` |

**Browser** — `e2e/graph-frame-timeline.spec.ts` now asserts
`tabStops === 1` alongside its node/circle DOM guard on the 5,000-node graph,
so the at-scale claim is checked in a real browser rather than inferred. Run
green locally (`pan p50 66.6 ms p95 700.0 ms`); one earlier run failed the zoom
p50 floor at 158 ms while the machine's load average was 10.5 — harness noise,
not this change, and it passed as soon as load dropped.

## Known limits

- Nothing announces the roving node beyond its `aria-label`; no `aria-activedescendant`
  pattern (the nodes are real focusable elements, which is the simpler choice).
- `Home`/`End` are not bound; only the four arrows.
- If the active node is culled by panning, the roving stop silently falls back
  to the first rendered node.
- Graph canvas keyboard pan/zoom is unchanged; the two are separated by which
  element holds focus.
