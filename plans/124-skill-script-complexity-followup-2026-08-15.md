# Plan 124: Skill script complexity follow-up (OwlWatch MEDIUM threads on PR #688)

> Status: FOLLOW-UP (tracked, not yet scheduled)
> Date: 2026-08-15

## Context

PR #688 fixed the repo-wide shellcheck debt in two skill scripts
(`.agents/skills/github-workflow/run.sh`, `.agents/skills/git-github-workflow/run.sh`):
mechanical SC2155 `local x=$(...)` splits and removal of dead SC2034 variables.
The full quality gate's shellcheck step now passes for the first time on a clean
checkout (verified: `./scripts/quality_gate.sh` exit 0).

While reviewing PR #688, OwlWatch flagged two MEDIUM complexity threads:

| Thread                      | Function                 | Pre-PR length | Post-PR length |
|-----------------------------|--------------------------|---------------|----------------|
| github-workflow/run.sh      | `phase_monitor()`        | 158 lines     | 160 lines      |
| git-github-workflow/run.sh  | `agent_monitor_actions()`| 119 lines     | 124 lines      |

Both functions were already far over a reasonable 100-line budget **before** this
PR; the +2/+5 lines are an artifact of the SC2155 line splits (no logic change).
These are pre-existing complexity issues, not regressions introduced by PR #688.

## Follow-up work (when scheduled)

Refactor the two monitor functions into focused helpers, preserving behavior:

1. **`phase_monitor()`** (github-workflow/run.sh):
   - Extract the check-state polling loop into `poll_check_state()`.
   - Extract the pass/fail/warning aggregation into `summarize_check_results()`.
   - Extract the final verification reporting into `report_final_verification()`.
2. **`agent_monitor_actions()`** (git-github-workflow/run.sh):
   - Extract check output parsing into `parse_check_results()`.
   - Extract failure detection into `detect_failures()`.
   - Extract status reporting into `report_action_status()`.

After refactoring:

- Re-run `shellcheck --severity=warning` on both files (must stay clean).
- Re-run `bats tests/` (install-hooks + validate-skills suites must stay green).
- Confirm `./scripts/quality_gate.sh` still exits 0.
- The skill workflows themselves (`phase_monitor`, `agent_monitor_actions`) are
  operational loops — refactor without changing observable behavior, and verify
  via a manual dry-run of the skill if feasible.

## Why not done in PR #688

- The threads are on pre-existing code; PR #688's changes are mechanical and
  behavior-preserving (verified: no logic diff beyond the split/removal).
- Refactoring two operational monitor loops is a meaningful behavioral-risk
  change, out of scope for a shellcheck-debt PR (AGENTS.md: keep changes scoped;
  avoid unrelated refactors in the same commit).
