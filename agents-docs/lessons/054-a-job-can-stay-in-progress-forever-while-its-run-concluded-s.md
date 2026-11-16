### LESSON-054: A job can stay `in_progress` forever while its run concluded `success`

Both `gh pr checks` and `commits/{sha}/check-runs` can report a job as
`in_progress` long after that job finished. Observed 2026-10-22 on PR #1015:
the `CI` run concluded `success` at 17:01 while its `Detect Changes` job still
read `in_progress` forty minutes later in `gh pr checks` *and* in the check-runs
API — the API LESSON-028 calls the source of truth for the opposite case.

The tiebreaker is the job's own evidence, not its status field:

- `gh api repos/{owner}/{repo}/actions/runs/{run_id}` → `status: completed`,
  `conclusion: success`
- `gh api repos/{owner}/{repo}/actions/runs/{run_id}/jobs` → the one job stuck
  at `in_progress` while every sibling job in that run completed
- `gh api repos/{owner}/{repo}/actions/jobs/{job_id}/logs --allow-escape-sequences`
  → the log ends with the job's final steps (`Evaluate and set job outputs`,
  `Set output 'frontend'`, `Cleaning up orphan processes`), proving it ran and
  finished

Whether that stale check *matters* is a separate question, answered by the
ruleset rather than by the status: `gh api repos/{owner}/{repo}/rulesets/{id}`
listed exactly one required check (`Codacy Static Code Analysis`, which had
passed), so the stale non-required check blocked nothing and merging was
honest — no `--admin`, no gate skipped, and `main`'s push run for the squash
commit started normally.

Prevention: do not read a lone `in_progress` as "still running" or as "broken".
Establish (1) the run's conclusion, (2) the job log's final steps, and (3)
whether that check appears in the ruleset's `required_status_checks`, before
deciding — and record which of the three the decision rested on.

The variant runs the other way too, so (1) is not authority by itself. The same
day, `main`'s CodeQL run for the merged refactor commit stayed `in_progress`
with `updatedAt` frozen five seconds after creation, while all three of its
analyze jobs reported `completed`/`success`:

- `gh api repos/{owner}/{repo}/actions/runs/{run_id}/jobs` → every job
  `completed`, `conclusion: success`
- `gh api repos/{owner}/{repo}/deployments`, then
  `.../deployments/{id}/statuses` → the production deployment for that commit
  reported `success`

Read the level below whatever looks stale: a stale job means check its run and
its own log, and a stale run means check its jobs and the deployment statuses.
The completed results are the evidence; the top-level status field is a cache
that can miss its own invalidation.

**Tags**: #github-actions #merge-state #staleness #check-runs

---
