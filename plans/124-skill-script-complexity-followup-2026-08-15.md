# Plan 124: Skill script complexity follow-up (OwlWatch MEDIUM threads on PR #688)

> Status: IMPLEMENTED — refactor merged via PR #691
> Date: 2026-08-15

## Context

PR #688 fixed the repo-wide shellcheck debt in two skill scripts
(`.agents/skills/github-workflow/run.sh`, `.agents/skills/git-github-workflow/run.sh`):
mechanical SC2155 `local x=$(...)` splits and removal of dead SC2034 variables.
The full quality gate's shellcheck step now passes for the first time on a clean
checkout (verified: `./scripts/quality_gate.sh` exit 0).

While reviewing PR #688, OwlWatch flagged two MEDIUM complexity threads:

| Script              | Function                  | Pre | Post |
|---------------------|---------------------------|-----|------|
| github-workflow     | `phase_monitor()`         | 158 | 160  |
| git-github-workflow | `agent_monitor_actions()` | 119 | 124  |

Both functions were already far over a reasonable 100-line budget **before** this
PR; the +2/+5 lines are an artifact of the SC2155 line splits (no logic change).
These are pre-existing complexity issues, not regressions introduced by PR #688.

## Refactor delivered (PR #691)

Both monitor functions were extracted into focused helpers, behavior-preserving:

1. **`phase_monitor()`** (github-workflow/run.sh): 160 -> 37 lines. Extracted:
   - `monitor_parse_checks()` — `gh pr checks` output -> pending/failure/warning
   - `monitor_fold_workflow_runs()` — optional workflow-run state folding
   - `monitor_poll_until_terminal()` — polling loop + final verdict (69 lines)
2. **`agent_monitor_actions()`** (git-github-workflow/run.sh): 124 -> 15 lines.
   Extracted the same helper trio (strict/non-strict aware) into
   `monitor_poll_until_terminal()`.

Also removed the dead `new_issues` array (appended, never read) in
github-workflow; `CHECKS_FAILED` in git-github-workflow is consumed by
`agent_fix_issues` and was preserved.

Verified: `bash -n` on both files, `shellcheck --severity=warning` clean on
both, diff review shows only moves/whitespace plus the dead-var removal, and
`./scripts/quality_gate.sh` exits 0.

## Why not done in PR #688

- The threads are on pre-existing code; PR #688's changes are mechanical and
  behavior-preserving (verified: no logic diff beyond the split/removal).
- Refactoring two operational monitor loops is a meaningful behavioral-risk
  change, out of scope for a shellcheck-debt PR (AGENTS.md: keep changes scoped;
  avoid unrelated refactors in the same commit).
