# Plan 175 — Mind Map treeview tab stop (F3 Phase 3 acceptance)

**Date:** 2026-10-16  
**Status:** Done — merged in PR #984 at `98d9ab0`; push run on `main` green (coverage badge step) and production deployment succeeded  
**Related:** Plan 169 (F3, Phase 3 acceptance "keyboard roving tabindex and treeview ARIA remain 100% intact"), `src/components/studio/views/mindmap-view.tsx`

## Discovery

The mind-map keyboard handlers were covered by unit tests (`mindmap-view-coverage.test.tsx`) but the suites themselves note they "can only verify no throw" for focus movement — the composed browser behavior of the W3C APG treeview pattern had **no e2e coverage**. A new spec (`e2e/mindmap-keyboard.spec.ts`) was written to verify the claim in a real browser: roving tabindex, arrow/Home/End navigation, expand/collapse, and the single-tab-stop contract.

## Defect (reproduced red-first)

The spec's first assertion failed: on a fresh load, **zero** treeitems carry `tabindex="0"` (expected exactly one). Cause: `focusedNodeId` starts `null` and is only ever set by `onFocus` (pointer or programmatic focus) or by adding a child. With every row at `tabIndex={-1}`, the tree has **no tab stop at all** — a keyboard-only user cannot Tab into the Mind Map tree until a mouse click focuses a row. That violates the APG treeview pattern ("the tree is a single tab stop; the active item receives focus") and the component's own roving-tabindex comment.

## Fix

The treeitem `tabIndex` now derives from a `tabStopId`: the focused node while it is actually rendered, else the root. A `visibleIds` memo mirrors the renderer's expansion rules so a node hidden behind a collapsed ancestor (or deleted) correctly falls back. `focusedNodeId` keeps its meaning as the *interaction* target only.

Rejected draft: seeding `focusedNodeId` with the first row on mount also fixed the tab stop, but the pre-commit gate caught the semantic regression — "stays silent when Delete is pressed with no node focused" failed, because the container-level Delete then acted on a row the user never focused. The derived approach satisfies both the APG tab-stop contract and that safety pin.

## Spec adjustments found while authoring

- The default seed root's subtree is root + leaves, so no `aria-expanded="false"` node exists; the expand test re-roots at "Knowledge Graph Project" (whose child `e1` has children).
- Collapsing runs an exit animation, so the row-count assertion must retry (`toHaveCount`) rather than read once.
- The root is always expanded at level 0, so the only ancestor whose collapse can hide the focused node sits at level ≥ 1; the fallback pin focuses a grandchild and collapses its parent.

## Verification

- `e2e/mindmap-keyboard.spec.ts`: 4/4 chromium, 8/8 on the mobile + tablet (WebKit) projects.
- Mind-map unit suites: 46/46; lint and typecheck green; pre-commit gate; CI on the PR.
- Red-first evidence: the tab-stop assertion failed before the fix (0 tabbable items) and passes after.
- Follow-up pin (post-merge): `mindmap-view-coverage.test.tsx` now covers the collapsed-ancestor fallback — focus a grandchild, collapse its parent, and the tab stop returns to the root (not the still-visible parent, which stays at `tabindex="-1"`). Re-injection evidence: fails against both the pre-fix expression and a visibility-check-free `tabStopId` (1 failed / 35 passed — only the new test).
