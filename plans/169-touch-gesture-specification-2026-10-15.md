# Plan 169 — F3 Touch and Gesture Specification (Graph and Mind Map)

**Date:** 2026-10-15  
**Status:** Implemented — Phases 1–3 mandatory scope shipped in [#968](https://github.com/d-oit/do-knowledge-studio/pull/968)/[#969](https://github.com/d-oit/do-knowledge-studio/pull/969) and Phase 4 e2e in `e2e/graph-gestures.spec.ts` + `e2e/mobile-touch-gestures.spec.ts`; the optional Mind Map swipe actions and §4 double-tap/long-press remain unbuilt (see the 2026-10-16 addendum in [Plan 162](162-roadmap-progress-and-next-work-2026-10-05.md))  
**Related:** Plan 166 N3, Plan 162 F3, [ADR 037](ADRs/037-url-addressable-view-state.md), [ADR 018](ADRs/018-vector-search-engine.md).

**2026-10-17 — reconciled by [Plan 176](176-plans-backlog-drain-2026-10-17.md):**
Plan 176 audited the two unbuilt items and chose to leave them parked — this plan
marks the swipe actions "optional" and §4 is absent from the delivery table, so
they remain spec options rather than open tasks; the decision is recorded so the
boundary is auditable.

## Problem

While the Graph view provides full keyboard navigation (`Arrow` keys for pan, `+`/`-` for zoom, `Home` for view reset, `Enter` for selection) and top toolbar controls, and the Mind Map view implements a strict W3C WAI-ARIA Treeview (`role="tree"` with roving tabindex and keyboard expansion/actions), neither view natively supports direct pointer or touch gestures:
- In Graph view: mouse drag does not pan the canvas, mouse wheel does not zoom toward the cursor, and mobile touch devices lack 1-finger drag-pan or 2-finger pinch-to-zoom.
- In Mind Map view: horizontal tree extent requires native scrollbars, and touch interactions rely purely on click taps without gesture velocity or swipe affordances.
- Per Plan 162 and Plan 166 N3, implementation without an explicit gesture specification risks breaking keyboard roving-tabindex, trapping native scroll, exceeding zoom boundaries, or violating `prefers-reduced-motion`.

## Core Architectural Invariants

1. **Strict Bounds Clamping**:
   - `zoom` in Graph view MUST remain strictly clamped within $[0.3, 3.0]$ (`MIN_ZOOM` to `MAX_ZOOM` defined in `src/components/studio/views/graph-view.tsx`).
   - `panOffset` in Graph view MUST remain clamped within $[-4000, 4000]$ (`MAX_PAN`), preventing nodes from becoming unreachable in coordinate space.
2. **Touch Action & Native Scroll Isolation**:
   - The interactive SVG canvas container MUST declare `touch-action: none` to claim 1-finger pan and 2-finger pinch without triggering browser-level pull-to-refresh or outer page scroll.
   - Surrounding view containers, headers, toolbars, and mind-map trees outside the canvas MUST preserve native touch scrolling (`touch-action: pan-y`).
3. **Accessibility & Target Size**:
   - All interactive touch targets (nodes, buttons, expanders) MUST maintain at least 44×44px hit bounds (`min-h-touch` / 44px hit circles).
   - Touch gestures MUST complement, NEVER replace, keyboard navigation (`Arrow` keys, `+`/`-`, `Home`, `Enter`, `F2`, `Delete`).
4. **Reduced Motion Respect**:
   - Continuous 1:1 gesture tracking (finger position mapping to pan/zoom) operates without spring or tween latency.
   - Any momentum or inertia release curves MUST be bypassed when `useReducedMotion()` is active (immediate velocity truncation).

---

## Specification: Graph View Gestures

### 1. Pointer Drag-to-Pan (Mouse & Single-Touch)

* **Trigger**: Pointer down on canvas background (`<svg>` or background `<rect>`, not on an interactive node).
* **State Machine**:
  - `IDLE`: Listening for `pointerdown`.
  - `PANNING`: Pointer captured (`element.setPointerCapture(e.pointerId)`).
    - `pointermove`: Delta $(\Delta x, \Delta y)$ is scaled by current zoom factor:
      $$\text{panOffset}'_x = \text{clamp}(\text{panOffset}_x + \Delta x \times \text{zoom}, -\text{MAX\_PAN}, \text{MAX\_PAN})$$
      $$\text{panOffset}'_y = \text{clamp}(\text{panOffset}_y + \Delta y \times \text{zoom}, -\text{MAX\_PAN}, \text{MAX\_PAN})$$
    - `pointerup` / `pointercancel`: Release pointer capture; transition to `IDLE`.
* **Heuristics & Slop**:
  - A movement threshold of 4px before declaring `PANNING` state ensures single-tap node selection is not misidentified as a drag.

### 2. Wheel & Trackpad Zoom (Focal-Point Centered)

* **Trigger**: `wheel` event on canvas.
* **Delta Calculation**:
  - Normalize delta: $\Delta z = -e.\text{deltaY} \times 0.0015$.
  - Target zoom: $\text{zoom}' = \text{clamp}(\text{zoom} \times (1 + \Delta z), \text{MIN\_ZOOM}, \text{MAX\_ZOOM})$.
* **Focal Point Invariant**:
  - Zooming MUST center around the cursor's canvas position $(c_x, c_y)$ rather than the top-left canvas origin $(0, 0)$:
    $$\text{panOffset}'_x = c_x - (c_x - \text{panOffset}_x) \times \frac{\text{zoom}'}{\text{zoom}}$$
    $$\text{panOffset}'_y = c_y - (c_y - \text{panOffset}_y) \times \frac{\text{zoom}'}{\text{zoom}}$$

### 3. Dual-Pointer Pinch-to-Zoom & Pan (Mobile Touch)

* **Trigger**: Two active pointers on the canvas.
* **Tracking**:
  - Store pointer locations $P_1 = (x_1, y_1)$ and $P_2 = (x_2, y_2)$.
  - Distance: $d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.
  - Midpoint (center of pinch): $M = \left(\frac{x_1 + x_2}{2}, \frac{y_1 + y_2}{2}\right)$.
* **Update per Frame**:
  - Scaling: $\text{scaleRatio} = \frac{d_{\text{current}}}{d_{\text{initial}}}$.
  - Update zoom and translate pan offset according to midpoint movement $\Delta M$ and focal zoom around $M$.

### 4. Tap & Long-Press (Node Interaction)

* **Single Tap**: Selects the entity (syncs with studio store `selectEntity(id)`).
* **Double Tap / Quick Primary Action**: Opens the entity in the editor view (`setView('editor')`).
* **Long Press (500ms hold without movement)**:
  - Triggers contextual node menu (focus mode toggle, inspect connections, delete entity).
  - Provides haptic feedback (`navigator.vibrate?.(10)` where supported).

---

## Specification: Mind Map View Gestures

### 1. Touch Tap & Disclosure

* **Expander Tap**:
  - Hitting the Chevron expand/collapse icon toggles node subtree expansion.
  - Interactive bounding box expanded via pseudo-element or padding to $\ge 44\times 44\text{px}$.
* **Node Row Tap**:
  - Sets roving tabindex focus (`setFocusedNodeId(id)`) and updates store selection (`selectEntity(id)`).

### 2. Swipe Gestures (Node Actions)

* **Swipe Right on Tree Item**:
  - Triggers "Add Child" intent (equivalent to `Ctrl+Enter` / `addChildToNode`).
  - Visual cue: reveals green action slot with `Plus` icon beneath row during swipe.
  - Threshold: 64px horizontal travel before commit.
* **Swipe Left on Tree Item**:
  - Triggers "Delete Node" confirmation / removal (equivalent to `Delete` key / `deleteFocusedNode`).
  - Visual cue: reveals saffron/destructive slot with `Trash2` icon.
  - Threshold: 64px horizontal travel before commit.

### 3. Canvas Scroll & Drag Isolation

* **Vertical Scroll**:
  - Retains native browser momentum scrolling for long trees (`overflow-y: auto`).
  - Swipes starting at $>30^\circ$ vertical angle lock to vertical scroll, disabling node swipe action.

---

## Implementation & Delivery Plan

| Phase | Milestone | Acceptance Criteria |
|---|---|---|
| **Phase 1: Graph Pointer Engine** | Implement pointer-event hooks (`useCanvasGesture`) in `src/components/studio/views/` | Drag-pan and wheel-zoom operational; zoom clamped $[0.3, 3.0]$; focal zoom math passes unit tests. |
| **Phase 2: Touch Pinch & Mobile Support** | Add multi-touch tracking and `touch-action: none` container styles | 2-finger pinch zooms and pans smoothly on mobile viewport emulation; 1-finger pans canvas. |
| **Phase 3: Mind Map Touch Enhancements** | Implement touch expanders $\ge 44\text{px}$ and optional swipe actions | Touch target audit passes WCAG 2.5.5; keyboard roving tabindex and treeview ARIA remain 100% intact. |
| **Phase 4: E2E Playwright Verification** | Add `e2e/graph-gestures.spec.ts` using CDP touch simulation | Synthesized drag, wheel, and multi-touch gestures tested across Chromium, WebKit, Mobile Safari. |
