# Plan 124: Skill script complexity follow-up (OwlWatch MEDIUM threads on PR #688)

> Status: COMPLETE — replacement PR #692 is CI-green and PR #691 is superseded
> Date: 2026-08-15

## Context

PR #688 fixed the repo-wide shellcheck debt in two skill scripts
(`.agents/skills/github-workflow/run.sh`, `.agents/skills/git-github-workflow/run.sh`).
OwlWatch then flagged complexity in the two operational monitor loops. PR #691
extracted those loops, but its review found two correctness and maintainability
issues before merge. This follow-up completes the implementation and carries the
fixes in a replacement PR.

## Implementation

1. **Monitor-loop extraction** — `phase_monitor()` and
   `agent_monitor_actions()` now delegate to focused polling and workflow-state
   helpers. The dead `new_issues` array was removed while preserving the
   consumed `CHECKS_FAILED` state.
2. **Shared check parser** — both skill scripts source
   `scripts/lib/workflow-monitor.sh`, eliminating duplicate
   `monitor_parse_checks()` implementations while retaining each workflow's
   warning policy.
3. **Workflow failure propagation** — `github-workflow` now passes the parsed
   failure flag through `monitor_fold_workflow_runs()` and retains it through
   the final verdict. A failed workflow run can no longer be discarded when the
   PR check output itself is otherwise quiet.
4. **Regression coverage** — `tests/workflow-monitor.bats` covers pending,
   failure, warning, warning-disabled, and successful check output.

## Review findings resolved

| Finding | Resolution |
|---------|------------|
| Workflow failure status was ignored because the second return token from `monitor_fold_workflow_runs()` was discarded | Parse and retain the failure token; fail the final verdict when a workflow run reports failure |
| `monitor_parse_checks()` was duplicated across both skill scripts | Move the parser to the shared `scripts/lib/workflow-monitor.sh` library and source it from both callers |

## Verification

- `bash -n` passes for both skill scripts and the shared library.
- `shellcheck --severity=warning` remains required for the changed shell files.
- BATS coverage exercises the shared parser.
- Full repository quality gates remain required before the replacement PR is
  considered ready.

## Acceptance criteria

- [x] Both monitor functions are decomposed into focused helpers.
- [x] The duplicated check parser is shared.
- [x] Workflow-run failures reach the final monitor verdict.
- [x] Regression tests cover the parser's state flags.
- [x] Replacement PR #692 CI is green and all review threads are resolved.
