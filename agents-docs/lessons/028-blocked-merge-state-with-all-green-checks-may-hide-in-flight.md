## LESSON-028: BLOCKED merge state with all-green checks may hide in-flight runs

**Issue**: PR #652 showed `mergeStateStatus: BLOCKED` while `gh pr checks`
reported every check as SUCCESS. Treating it as staleness too early led to
repeated failed merge attempts. The real blocker was a fresh "Unit Tests"
check run still `in_progress` on the head commit — the nudge commit had
re-triggered CI. After all 36 check runs completed green, the state stayed
BLOCKED — genuine staleness that survived an empty-commit nudge and a
close/reopen, requiring an approved admin merge.

**Root Cause**:

- `gh pr checks` aggregates per-check state and can report stale SUCCESS
  while the head commit has runs still in progress. The check-runs API on
  the head SHA (`commits/{sha}/check-runs`) is the source of truth.
- GitHub merge-state staleness (plans/098) can persist through nudge and
  close/reopen; the ladder ends at `--admin`, which AGENTS.md forbids
  without explicit user approval.

**Prevention**:

- Diagnose BLOCKED in order: ruleset required checks on the head commit,
  review threads, then in-flight check-runs on the head SHA — only then
  declare staleness.
- New `pr-merge-state-diagnoser.yml` workflow posts one idempotent
  comment naming the real blocker (in-flight runs, failures, or
  all-green staleness with the ladder).

**Tags**: #github-actions #merge-state #branch-protection #staleness
