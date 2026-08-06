# Plan 094 — Smoke Tests for Remaining 9 shadcn UI Primitives

**Date**: 2026-07-29
**Status**: DONE
**Method**: GOAP with parallel execution
**Goal**: Extract shared a11y helpers from Plan 093 and add smoke tests for the remaining 9 untested shadcn UI primitives.

## Task Analysis

**Primary Goal**: Complete smoke test coverage for all shadcn UI primitives used in the project.
1. **Shared a11y helpers** — extract `assertNoCriticalAxeViolations` and `assertNoAxeViolations` with WCAG 2.2 AA tags into a reusable E2E helper module
2. **9 shadcn UI primitive smoke tests** — add unit test coverage for ToggleGroup, Slider, Popover, HoverCard, Progress, Breadcrumb, Avatar, AspectRatio, and Collapsible

**Constraints**: All CI must pass, new PR required, no `any` types, tests must be deterministic.
**Complexity**: Medium (9 new test files + shared helper extraction).

## Waves

### W1: Extract shared a11y helpers + Add 9 shadcn UI primitive test files

| ID | Task | Files |
|----|------|-------|
| T1 | Extract shared a11y E2E helpers | `e2e/helpers/a11y.ts` (new) |
| T2 | ToggleGroup smoke test | `src/components/ui/__tests__/toggle-group.test.tsx` (new) |
| T3 | Slider smoke test | `src/components/ui/__tests__/slider.test.tsx` (new) |
| T4 | Popover smoke test | `src/components/ui/__tests__/popover.test.tsx` (new) |
| T5 | HoverCard smoke test | `src/components/ui/__tests__/hover-card.test.tsx` (new) |
| T6 | Progress smoke test | `src/components/ui/__tests__/progress.test.tsx` (new) |
| T7 | Breadcrumb smoke test | `src/components/ui/__tests__/breadcrumb.test.tsx` (new) |
| T8 | Avatar smoke test | `src/components/ui/__tests__/avatar.test.tsx` (new) |
| T9 | AspectRatio smoke test | `src/components/ui/__tests__/aspect-ratio.test.tsx` (new) |
| T10 | Collapsible smoke test | `src/components/ui/__tests__/collapsible.test.tsx` (new) |

### W2: Quality gate + PR

| ID | Task |
|----|------|
| T11 | Run lint, typecheck, unit tests, code review |
| T12 | Create branch, commit, push, create PR (PR #540) |

## Success Criteria

- [x] Shared a11y helpers extracted to `e2e/helpers/a11y.ts` with `assertNoCriticalAxeViolations` and `assertNoAxeViolations` (WCAG 2.2 AA tags)
- [x] 9 new shadcn UI primitive smoke tests added (ToggleGroup, Slider, Popover, HoverCard, Progress, Breadcrumb, Avatar, AspectRatio, Collapsible)
- [x] 782 additions across 14 files
- [x] All existing unit tests pass
- [x] Lint, typecheck, build pass
- [x] PR #540 merged — all CI checks pass, Codacy clean

## Key Files

| File | Action |
|------|--------|
| `e2e/helpers/a11y.ts` | Create: shared axe-core helpers (`assertNoCriticalAxeViolations`, `assertNoAxeViolations`) |
| `src/components/ui/__tests__/toggle-group.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/slider.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/popover.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/hover-card.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/progress.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/breadcrumb.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/avatar.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/aspect-ratio.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/collapsible.test.tsx` | Create: smoke test |

---

**This is a planning artifact. Source code is modified by this document.**
