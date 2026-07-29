# Plan 095 — Audit: Fix Pre-Existing Color Contrast Violations (WCAG 1.4.3)

**Date**: 2026-07-29
**Status**: PLANNING
**Goal**: Fix the 58+ `color-contrast` (serious) axe violations across 7 views that were surfaced by upgrading the axe-core helper from critical-only to serious+ in Plan 093.

## Background

PR #539 upgraded the axe-core E2E helper from `assertNoCriticalAxeViolations` (fail on critical, log serious as warnings) to `assertNoAxeViolations` (fail on critical + serious). This surfaced 58+ pre-existing `color-contrast` violations across 7 views: library, editor, chat, mind map, graph, export, sync.

These violations existed before the upgrade — the old helper was silently logging them as `console.warn`. The upgrade correctly surfaces them, but fixing all 58+ nodes requires a dedicated effort.

## Known Violations

| Rule | Impact | Affected Views | Approx Nodes |
|------|--------|----------------|-------------|
| `color-contrast` | serious | library, editor, chat, mind map, graph, export, sync | 58+ |

The most common pattern is likely low-contrast text in the sidebar, toolbar, or footer against the background color.

## Tasks

- [ ] Identify specific elements failing the contrast check (use axe devtools or local E2E run with `getViolations`)
- [ ] Fix sidebar low-contrast elements (likely background/text color combination issues)
- [ ] Fix toolbar and footer contrast issues
- [ ] Fix content area contrast issues
- [ ] Verify fix by running `pnpm run test:e2e` locally
- [ ] Remove `assertNoCriticalAxeViolations` fallback and use `assertNoAxeViolations` exclusively

## Success Criteria

- [ ] All 10 axe-core E2E tests pass with `assertNoAxeViolations` (strict)
- [ ] No new contrast violations introduced
- [ ] `e2e/accessibility.spec.ts` uses only the strict assertion

---

**This is a planning artifact.**
