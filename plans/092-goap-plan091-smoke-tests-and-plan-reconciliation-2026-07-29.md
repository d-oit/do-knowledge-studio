# Plan 092 — GOAP: Complete Plan 091 Deferred Smoke Tests & Reconcile Stale Plan Checkboxes

**Date**: 2026-07-29
**Status**: DONE
**Method**: GOAP with targeted execution
**Goal**: Close the single deferred item from Plan 091 (shadcn UI smoke tests that timed out) and reconcile stale checkboxes across plans 068, 089, and 091 that now reflect completed work.

## Task Analysis

**Primary Goal**: Add the 4 missing shadcn UI component smoke tests deferred from Plan 091 (the test agent timed out before creating dialog, input, badge, card tests), and update stale plan documentation to reflect work completed in Plans 090–091.
**Constraints**: All CI must pass, new PR required, no `any` types, follow existing test conventions.
**Complexity**: Low–Medium (test additions + documentation reconciliation).

## Context

Plan 091 (2026-07-28) closed most gaps from the plans/ analysis but one item was explicitly deferred because the swarm agent timed out:

> `- [x] New smoke tests for shadcn UI components added (deferred — agent timed out)` — **completed in this plan (PR #538)**

The previous run created tests for `button`, `toggle`, `tooltip`, `sonner`, and `toast` (5 files), but the 4 components named in Plan 091's key files table — `dialog`, `input`, `badge`, `card` — were never created. The `src/components/ui/__tests__/` directory remained untracked at session start.

Separately, Plan 068's follow-up checkboxes for #480 (offline indicator) and #481 (PWA manifest) were completed by Plan 090 but never checked off. Plan 089's deferred items (PWA, AI tests) were also completed by Plan 090 but the success criteria still show pending status.

## Task Decomposition

### Wave 1: Missing Smoke Tests (Plan 091 T2.1)

| ID | Task | Files |
|----|------|-------|
| T1.1 | Create Dialog smoke test | `src/components/ui/__tests__/dialog.test.tsx` (new) |
| T1.2 | Create Input smoke test | `src/components/ui/__tests__/input.test.tsx` (new) |
| T1.3 | Create Badge smoke test | `src/components/ui/__tests__/badge.test.tsx` (new) |
| T1.4 | Create Card smoke test | `src/components/ui/__tests__/card.test.tsx` (new) |

### Wave 2: Plan Reconciliation

| ID | Task | Files |
|----|------|-------|
| T2.1 | Check off Plan 091 deferred smoke-test item | `plans/091-goap-remaining-gaps-cleanup-2026-07-28.md` |
| T2.2 | Mark Plan 068 #480 and #481 as done | `plans/068-session-closeout-2026-07-17.md` |
| T2.3 | Update Plan 089 deferred PWA/AI items | `plans/089-goap-remaining-gaps-remediation-2026-07-28.md` |
| T2.4 | Add Plan 092 entry to INDEX.md | `plans/INDEX.md` |

### Wave 3: Quality Gate + PR

| ID | Task |
|----|------|
| T3.1 | Run lint, typecheck, test, build |
| T3.2 | Code review |
| T3.3 | Create branch, commit, push, create PR |

## Success Criteria

- [x] Smoke tests for dialog, input, badge, card components added
- [x] Plan 091 deferred smoke-test item checked off
- [x] Plan 068 #480 (offline indicator) and #481 (PWA manifest) marked done
- [x] Plan 089 PWA/AI test deferred items marked completed
- [x] All existing tests pass
- [x] Lint, typecheck, build pass
- [x] PR created with all CI checks passing
- [x] Code review completed, no P1/P2 findings

## Key Files

| File | Action |
|------|--------|
| `src/components/ui/__tests__/dialog.test.tsx` | Create: smoke test (10 tests) |
| `src/components/ui/__tests__/input.test.tsx` | Create: smoke test (10 tests) |
| `src/components/ui/__tests__/badge.test.tsx` | Create: smoke test (9 tests) |
| `src/components/ui/__tests__/card.test.tsx` | Create: smoke test (10 tests) |
| `plans/091-goap-remaining-gaps-cleanup-2026-07-28.md` | Edit: check deferred item |
| `plans/068-session-closeout-2026-07-17.md` | Edit: check #480, #481 |
| `plans/089-goap-remaining-gaps-remediation-2026-07-28.md` | Edit: mark PWA/AI items done |
| `plans/INDEX.md` | Edit: add Plan 092 entry |

## Notes

- Older plans (040–042, 14–20, 34, 36, 37) and ADR 004 reference the retired Vite/SQLite/Orama/CLI architecture. Their unchecked items are **historical** and not actionable in the current Next.js + Zustand + localStorage baseline. They are correctly superseded and were intentionally left unchecked.
- The deferred G5.5 full accessibility audit (Plan 071) is tracked in the untracked `plans/full-accessibility-audit-spec.md` as an 11-task E2E effort. That is a separate, larger follow-up beyond this PR's scope.

---

**This is a planning artifact. Source code is modified by this document.**
