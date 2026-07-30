# Plan 093 — GOAP: Full Accessibility Audit E2E & Remaining UI Primitive Smoke Tests

**Date**: 2026-07-29
**Status**: DONE
**Method**: GOAP with parallel execution
**Goal**: Implement the deferred G5.5 full accessibility audit (Plan 071) as an E2E suite, and add smoke tests for all remaining untested shadcn UI primitives.

## Task Analysis

**Primary Goal**: Close two followups from Plan 092:
1. **Full accessibility audit E2E** — the 11-task spec in `plans/full-accessibility-audit-spec.md` addressing Plan 071's deferred G5.5 requirement
2. **Remaining UI primitive smoke tests** — add coverage for checkbox, switch, label, textarea, separator, radio-group, tabs, accordion, scroll-area

**Constraints**: All CI must pass, new PR required, no `any` types, E2E tests must be deterministic.
**Complexity**: Medium-High (E2E + unit tests across multiple domains).

## Task Decomposition

### Wave 1: E2E Accessibility Suite (Plan 071 G5.5)

| ID | Task | Files |
|----|------|-------|
| T1 | Upgrade axe-core helper to fail on serious+ violations + wcag22aa tags | `e2e/helpers/a11y.ts` (new), `e2e/accessibility.spec.ts` (edit) |
| T2 | Skip-nav keyboard test | `e2e/keyboard-a11y.spec.ts` (new) |
| T3 | Command palette focus-trap test | `e2e/keyboard-a11y.spec.ts` |
| T4 | Editor radiogroup arrow-key test | `e2e/keyboard-a11y.spec.ts` |
| T5 | Overlay Escape + focus-restoration tests | `e2e/keyboard-a11y.spec.ts` |
| T6 | 200% text zoom test | `e2e/zoom-reflow.spec.ts` (new) |
| T7 | 400% reflow test | `e2e/zoom-reflow.spec.ts` |
| T8 | Zoom + mobile test | `e2e/zoom-reflow.spec.ts` |
| T9 | Automated touch-target verification | `e2e/touch-targets.spec.ts` (new) |
| T10 | Saffron accent contrast ratio test | `e2e/contrast.spec.ts` (new) |

### Wave 2: UI Primitive Smoke Tests

| ID | Task | Files |
|----|------|-------|
| T2.1 | Checkbox smoke test | `src/components/ui/__tests__/checkbox.test.tsx` (new) |
| T2.2 | Switch smoke test | `src/components/ui/__tests__/switch.test.tsx` (new) |
| T2.3 | Label smoke test | `src/components/ui/__tests__/label.test.tsx` (new) |
| T2.4 | Textarea smoke test | `src/components/ui/__tests__/textarea.test.tsx` (new) |
| T2.5 | Separator smoke test | `src/components/ui/__tests__/separator.test.tsx` (new) |
| T2.6 | RadioGroup smoke test | `src/components/ui/__tests__/radio-group.test.tsx` (new) |
| T2.7 | Tabs smoke test | `src/components/ui/__tests__/tabs.test.tsx` (new) |
| T2.8 | Accordion smoke test | `src/components/ui/__tests__/accordion.test.tsx` (new) |
| T2.9 | ScrollArea smoke test | `src/components/ui/__tests__/scroll-area.test.tsx` (new) |

### Wave 3: Quality Gate + PR

| ID | Task |
|----|------|
| T3.1 | Run lint, typecheck, unit tests, code review |
| T3.2 | Create branch, commit, push, create PR |

## Success Criteria

- [x] Axe-core helper upgraded to fail on serious+ violations with wcag22aa tags
- [x] Skip-nav keyboard test added
- [x] Command palette focus-trap test added
- [x] Editor radiogroup arrow-key test added
- [x] Overlay Escape + focus-restoration tests added
- [x] 200% text zoom test added
- [x] 400% reflow test added
- [x] Zoom + mobile test added
- [x] Automated touch-target verification added
- [x] Saffron accent contrast ratio test added
- [x] 9 new UI primitive smoke tests added (checkbox, switch, label, textarea, separator, radio-group, tabs, accordion, scroll-area)
- [x] All existing unit tests pass
- [x] Lint, typecheck pass
- [x] Code review completed

## Key Files

| File | Action |
|------|--------|
| `e2e/helpers/a11y.ts` | Create: shared axe-core helper (strict + legacy) |
| `e2e/accessibility.spec.ts` | Edit: upgrade to strict assertion, wcag22aa tags |
| `e2e/keyboard-a11y.spec.ts` | Create: skip-nav, focus trap, radiogroup, overlay Escape |
| `e2e/zoom-reflow.spec.ts` | Create: 200% zoom, 400% reflow, zoom+mobile |
| `e2e/touch-targets.spec.ts` | Create: 44x44px verification on mobile viewport |
| `e2e/contrast.spec.ts` | Create: Saffron accent contrast ratio checks |
| `src/components/ui/__tests__/checkbox.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/switch.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/label.test.tsx` | Create: smoke test (7 tests) |
| `src/components/ui/__tests__/textarea.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/separator.test.tsx` | Create: smoke test (7 tests) |
| `src/components/ui/__tests__/radio-group.test.tsx` | Create: smoke test (7 tests) |
| `src/components/ui/__tests__/tabs.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/accordion.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/scroll-area.test.tsx` | Create: smoke test (8 tests) |
| `plans/093-goap-a11y-e2e-and-ui-primitive-tests-2026-07-29.md` | Create: this plan |

---

**This is a planning artifact. Source code is modified by this document.**
