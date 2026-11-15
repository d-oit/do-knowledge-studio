## LESSON-032: Outdated review threads still block merges; keep skill scripts on a shared lib

**Date**: 2026-08-16
**Component**: GitHub Merge Workflow / BATS Regression Tests
**Severity**: High

**Issue**: PR #692 sat `BLOCKED` with all 26 checks green (including the
ruleset-required Codacy check), the branch up to date with `main`, zero
approvals required, and auto-merge armed. The staleness ladder from
LESSON-028/030 was followed — including an empty-commit nudge push — yet
`mergeStateStatus` stayed `BLOCKED`. The hidden gate was two OwlWatch
review threads that GitHub reports as `isOutdated: true` but which were
still `isResolved: false`. Resolving the three threads (including the two
outdated ones) flipped `BLOCKED` → merged within seconds.

**Symptoms**:
- `mergeStateStatus: BLOCKED` for 10+ minutes with every check green
- `gh pr checks` all SUCCESS; `reviewDecision` null; issue comments empty
- GraphQL `reviewThreads` shows threads with `isOutdated: true` and
  `isResolved: false`
- Empty-commit nudge does NOT clear the state (unlike LESSON-028/031
  staleness and transient Codacy absence)

**Root Cause**:

- The ruleset's `required_review_thread_resolution` counts every thread
  with `isResolved: false` — the `isOutdated` flag does NOT exempt a
  thread from the gate. Earlier sessions assumed outdated threads were
  excluded and stopped querying after the first resolution pass.
- The diagnoser workflow reports check-run state only; threads are
  invisible to `gh pr checks` and the PR review-request UI.

**Solution**:

- Query `pullRequest.reviewThreads(first: 20) { nodes { isResolved isOutdated } }`
  and resolve EVERY unresolved thread via GraphQL
  `resolveReviewThread`, including ones marked outdated.
- Hardened `AGENTS.md` and plans/098 with the "resolve every thread,
  outdated or not" rule.

**Prevention**:

- Before declaring staleness, require zero `isResolved: false` nodes —
  not zero *non-outdated* nodes.
- Added BATS sync guards (`tests/workflow-monitor.bats`) asserting both
  skill scripts (`github-workflow`, `git-github-workflow`) source the
  shared `scripts/lib/workflow-monitor.sh`, never redefine its six
  functions, and reference only defined functions — so monitor logic
  cannot drift into private copies.

**Tags**: #review-threads #merge-gate #staleness #owl-watch #outdated-threads #bats #sync-guards

---
