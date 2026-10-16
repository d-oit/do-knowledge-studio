# Plan 175 — Mind Map treeview tab stop (F3 Phase 3 acceptance)

**Date:** 2026-10-16  
**Status:** In progress  
**Related:** Plan 169 (F3, Phase 3 acceptance "keyboard roving tabindex and treeview ARIA remain 100% intact"), `src/components/studio/views/mindmap-view.tsx`

## Discovery

The mind-map keyboard handlers were covered by unit tests (`mindmap-view-coverage.test.tsx`) but the suites themselves note they "can only verify no throw" for focus movement — the composed browser behavior of the W3C APG treeview pattern had **no e2e coverage**. A new spec (`e2e/mindmap-keyboard.spec.ts`) was written to verify the claim in a real browser: roving tabindex, arrow/Home/End navigation, expand/collapse, and the single-tab-stop contract.

## Defect (reproduced red-first)

The spec's first assertion failed: on a fresh load, **zero** treeitems carry `tabindex="0"` (expected exactly one). Cause: `focusedNodeId` starts `null` and is only ever set by `onFocus` (pointer or programmatic focus) or by adding a child. With every row at `tabIndex={-1}`, the tree has **no tab stop at all** — a keyboard-only user cannot Tab into the Mind Map tree until a mouse click focuses a row. That violates the APG treeview pattern ("the tree is a single tab stop; the active item receives focus") and the component's own roving-tabindex comment.

## Fix

An effect designates the **first rendered treeitem** as the roving tab stop whenever the designated node is absent from the rendered rows — first load, root switch, node deletion, or a collapsed ancestor hiding it. DOM focus is untouched; only the tabbable designation moves. This also repairs the tab stop after deleting the focused node, where `focusedNodeId` previously returned to `null`.

## Spec adjustments found while authoring

- The default seed root's subtree is root + leaves, so no `aria-expanded="false"` node exists; the expand test re-roots at "Knowledge Graph Project" (whose child `e1` has children).
- Collapsing runs an exit animation, so the row-count assertion must retry (`toHaveCount`) rather than read once.

## Verification

- `e2e/mindmap-keyboard.spec.ts`: 4/4 chromium, 8/8 on the mobile + tablet (WebKit) projects.
- Mind-map unit suites: 46/46; lint and typecheck green; pre-commit gate; CI on the PR.
- Red-first evidence: the tab-stop assertion failed before the fix (0 tabbable items) and passes after.
