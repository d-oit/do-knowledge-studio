# Plan 080-R — Review Remediation for PR #515

**Date**: 2026-07-26
**Status**: DONE
**Method**: GOAP with swarm parallel execution
**Branch**: `feat/080-gap-remediation`

## Findings from Code Review

| ID | Severity | Finding | Files |
|----|----------|---------|-------|
| R1 | P1 | Grid column span regression — motion.div wrapper lost `lg:col-span-2` | `ai-harness-view.tsx`, `ai-harness-settings-panel.tsx` |
| R2 | P2 | Inconsistent provider lookup — non-null assertion vs safe fallback | `ai-harness-view.tsx` |
| R3 | P2 | `as AIProvider` type assertion bypasses type safety | `ai-harness-settings-panel.tsx` |
| R4 | P3 | Redundant "Save settings" button (auto-save already exists) | `ai-harness-settings-panel.tsx` |
| R5 | P3 | Unused `abortRef` prop in ChatPanelProps | `ai-harness-chat.tsx` |
| R6 | P3 | `motion.aside` mock no longer needed | `ai-harness-view.test.tsx` |

## Execution Strategy: Parallel Swarm

### Wave 1 — Independent file fixes (parallel)
- R1+R2: fix `ai-harness-view.tsx` (grid span + provider lookup)
- R3+R4: fix `ai-harness-settings-panel.tsx` (type assertion + redundant button)
- R5: fix `ai-harness-chat.tsx` (unused prop)
- R6: fix `ai-harness-view.test.tsx` (stale mock)

### Wave 2 — Quality Gate
- typecheck, lint, test, build

## Success Criteria
- [x] All 6 findings resolved
- [x] typecheck passes
- [x] lint passes
- [x] tests pass (732/732)
- [x] build passes
