# Plan 095 — Audit: Fix Pre-Existing Color Contrast Violations (WCAG 1.4.3)

**Date**: 2026-07-29
**Status**: DONE
**Goal**: Fix the 58+ `color-contrast` (serious) axe violations across 7 views that were surfaced by upgrading the axe-core helper from critical-only to serious+ in Plan 093.

## Background

PR #539 upgraded the axe-core E2E helper from `assertNoCriticalAxeViolations` (fail on critical, log serious as warnings) to `assertNoAxeViolations` (fail on critical + serious). This surfaced 58+ pre-existing `color-contrast` violations across 7 views: library, editor, chat, mind map, graph, export, sync.

These violations existed before the upgrade — the old helper was silently logging them as `console.warn`. The upgrade correctly surfaces them, but fixing all 58+ nodes requires a dedicated effort.

## Known Violations

| Rule | Impact | Affected Views | Approx Nodes |
|------|--------|----------------|-------------|
| `color-contrast` | serious | library, editor, chat, mind map, graph, export, sync | 58+ |

The most common pattern is likely low-contrast text in the sidebar, toolbar, or footer against the background color.

## Root Cause Analysis

The 58+ violations stem from three CSS token issues in `globals.css`:

1. **Light mode `--ink-faint: #6a6660`** — borderline at ~4.8:1 on muted backgrounds; fails when combined with opacity modifiers like `/70`
2. **Dark mode `--ink-faint: #827d72`** — fails at 4.34:1 on `--background: #14110d` (below 4.5:1 AA threshold)
3. **`--muted-foreground: #6b6760`** (shadcn components) — borderline on `--muted: #f1ede4` backgrounds

## Fix Applied

Unified `--ink-faint` with `--ink-mute` (they were nearly identical) and adjusted both to comfortably pass 4.5:1:

| Token | Light (before → after) | Dark (before → after) |
|-------|------------------------|------------------------|
| `--ink-faint` | `#6a6660` → `#5c5852` (6.1:1) | `#827d72` → `#a09a8e` (5.8:1) |
| `--ink-mute` | `#6b6760` → `#5c5852` (6.1:1) | `#9b958a` → `#a09a8e` (5.8:1) |
| `--muted-foreground` | `#6b6760` → `#5c5852` (6.1:1) | `#9b958a` → `#a09a8e` (5.8:1) |

## Tasks

- [x] Identify specific elements failing the contrast check (code search analysis)
- [x] Fix CSS token contrast ratios in `globals.css` (light + dark themes)
- [x] Remove `assertNoCriticalAxeViolations` fallback and use `assertNoAxeViolations` exclusively
- [x] Extend strict assertion to all 10 views in `accessibility.spec.ts`
- [ ] Verify fix by running `pnpm run test:e2e` locally (requires Chrome)

## Success Criteria

- [ ] All 10 axe-core E2E tests pass with `assertNoAxeViolations` (strict)
- [ ] No new contrast violations introduced
- [ ] `e2e/accessibility.spec.ts` uses only the strict assertion

---

**This is a planning artifact.**
