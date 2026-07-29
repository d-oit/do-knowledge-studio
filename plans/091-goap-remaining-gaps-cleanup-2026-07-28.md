# Plan 091 — GOAP: Address Remaining plans/ Gaps, Coverage, and ADR Cleanup

## Status: DONE

**Branch**: feat/plans-address-remaining-gaps
**PR**: [#535](https://github.com/d-oit/do-knowledge-studio/pull/535) (merged 2026-07-28)

**Generated**: 2026-07-28
**Method**: GOAP with Swarm Agents (Parallel Execution)
**Goal**: Close all identified gaps from plans/ analysis: stale checkboxes, test coverage, ADR inconsistencies.

## Task Analysis

**Primary Goal**: Clean up stale plan documentation, improve test coverage for untested UI components, and fix ADR status inconsistencies.
**Constraints**: All CI must pass, new PR required.
**Complexity**: Medium (documentation cleanup + targeted test additions).

## Task Decomposition

### Wave 1: Parallel Documentation Cleanup (Swarm)

| ID | Task | Priority | Agent | Files |
|----|------|----------|-------|-------|
| T1.1 | Update Plan 071 exit criteria checkboxes | P1 | general | `plans/071-goap-codebase-gap-audit-2026-07-19.md` |
| T1.2 | Update Plan 068 follow-up status | P1 | general | `plans/068-session-closeout-2026-07-17.md` |
| T1.3 | Update Plan 065 success criteria | P1 | general | `plans/065-ai-provider-openrouter-ollama-cpu-2026-07-16.md` |
| T1.4 | Supersede ADR 004 (DB Migration) | P1 | general | `plans/ADRs/004-db-migration-system.md` |
| T1.5 | Check ADR 003 E2E test criterion | P1 | general | `plans/ADRs/003-vite-env-security.md` |
| T1.6 | Update Plan 089 deferred items status | P1 | general | `plans/089-goap-remaining-gaps-remediation-2026-07-28.md` |

### Wave 2: Test Coverage Improvements (Swarm)

| ID | Task | Priority | Agent | Files |
|----|------|----------|-------|-------|
| T2.1 | Add smoke tests for top 5 used shadcn UI components | P2 | general | `src/components/ui/__tests__/` (new) |
| T2.2 | Add smoke tests for hooks (use-toast, use-mobile) | P2 | general | `src/hooks/__tests__/` (new) |
| T2.3 | Add tests for service-worker-registration | P2 | general | `src/components/studio/__tests__/service-worker-registration.test.tsx` |

### Wave 3: Quality Gate

| ID | Task | Agent |
|----|------|-------|
| T3.1 | Run lint, typecheck, test, build | bash |
| T3.2 | Create branch, commit, push | bash |
| T3.3 | Create PR | bash |

## Success Criteria

- [x] All stale plan checkboxes updated to reflect completed work
- [x] ADR 004 formally superseded (already done in prior commit)
- [x] ADR 003 E2E test criterion checked
- [x] Plan 089 deferred items marked as completed
- [x] New smoke tests for shadcn UI components added — **completed in Plan 092** (dialog, input, badge, card)
- [x] New smoke tests for hooks added (use-toast: 15, use-mobile: 5)
- [x] Service worker registration test added (5 tests)
- [x] All existing tests pass (1212)
- [x] Lint, typecheck, build pass
- [x] PR #535 created, all 20 CI checks passing
- [x] Code review completed, no P1/P2 findings

## Key Files

| File | Action |
|------|--------|
| `plans/071-goap-codebase-gap-audit-2026-07-19.md` | Edit: check off G1/G2 exit criteria |
| `plans/068-session-closeout-2026-07-17.md` | Edit: update follow-up status |
| `plans/065-ai-provider-openrouter-ollama-cpu-2026-07-16.md` | Edit: check success criteria |
| `plans/ADRs/004-db-migration-system.md` | Edit: mark as Superseded |
| `plans/ADRs/003-vite-env-security.md` | Edit: check E2E test criterion |
| `plans/089-goap-remaining-gaps-remediation-2026-07-28.md` | Edit: mark deferred items done |
| `src/components/ui/__tests__/button.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/dialog.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/input.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/badge.test.tsx` | Create: smoke test |
| `src/components/ui/__tests__/card.test.tsx` | Create: smoke test |
| `src/hooks/__tests__/use-toast.test.ts` | Create: hook test |
| `src/hooks/__tests__/use-mobile.test.ts` | Create: hook test |
| `src/components/studio/__tests__/service-worker-registration.test.tsx` | Create: SW test |

---

**This is a planning artifact. Source code is modified by this document.**
