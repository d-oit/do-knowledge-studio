# Plan 119 — PR Merge-State Diagnosis: Incident + Automated Diagnoser

Date: 2026-08-12
Status: RESOLVED

## Incident (PR #652)

PR #652 (ADR 032 + store cache reset wiring) showed
`mergeStateStatus: BLOCKED` while `gh pr checks` reported every check as
SUCCESS. Merge attempts failed with "the base branch policy prohibits the
merge" for over an hour.

### Diagnosis sequence

1. Verified the ruleset endpoints (Codacy is the only required check;
   approvals required = 0; stale-review dismissal off) — all satisfied.
2. Verified no unresolved review threads and no `CHANGES_REQUESTED`
   reviews — none.
3. `commits/{sha}/check-runs` on the head commit revealed the real
   blocker: a fresh "Unit Tests" run was still `in_progress` (the
   empty-commit nudge had re-triggered CI). This was NOT staleness.
4. After all 36 check runs completed green, the state remained BLOCKED —
   genuine staleness. It survived an empty-commit nudge and a
   close/reopen. Auto-merge re-arming hung (gh CLI) / 404'd (API).
5. Per AGENTS.md, `--admin` was requested and explicitly approved by the
   user; the squash merge completed.

### Root causes

- `gh pr checks` aggregates per-check state and can show stale SUCCESS
  while the head commit has in-flight runs.
- GitHub merge-state staleness (plans/098) can persist through nudge and
  close/reopen.
- `--admin` is the final rung and requires explicit user approval.

## Resolution

- **LESSON-028** recorded (LESSONS.md, lessons.jsonl, AGENTS.md):
  diagnose BLOCKED in order — ruleset required checks, threads, then
  in-flight check-runs on the head SHA — before declaring staleness.
- **`pr-merge-state-diagnoser.yml`**: new workflow that posts one
  idempotent comment (marker `<!-- blocked-pr-diagnoser -->`) on BLOCKED
  PRs naming the real blocker: in-flight runs, failing runs, or an
  all-green staleness note with the remediation ladder. The comment is
  updated in place and deleted when the PR is no longer blocked.
- Template + properties added under `.github/workflow-templates/`;
  README table and section updated; workflow tests added to
  `src/lib/__tests__/workflows.test.ts`.

## Verification

- Full quality gate on main: typecheck, ESLint, production build clean;
  480/480 Playwright matrix (all four projects); full unit suite passed.
- Workflow validated with yamllint and actionlint; workflow tests pass.
