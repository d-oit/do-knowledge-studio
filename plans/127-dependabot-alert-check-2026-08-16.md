# Plan 127 — Nightly Dependabot Alert Check (2026-08-16)

Status: IMPLEMENTED — delivered in the Plan 124 follow-up batch

## Goal

Surface open Dependabot alerts automatically so dependency regressions
are caught the next morning instead of during a manual PR sweep.

## Problem

The PR sweep on 2026-08-15 found a high-severity transitive `nanoid`
alert (#61) with no open issue tracking it (Plan 126). Nothing in CI
failed when the alert appeared — Dependabot PRs are not auto-created for
transitive overrides, and the weekly security scan reports to the
Security tab rather than failing the pipeline.

## Solution

- New `.github/workflows/dependabot-alert-check.yml`: nightly at 04:17
  UTC (after the 03:00 CI nightly to avoid runner contention) plus
  `workflow_dispatch`.
- Queries `GET /repos/{owner}/{repo}/dependabot/alerts?state=open` via
  the gh CLI and fails with `::error::` when any open alert exists,
  printing number, severity, package, and advisory summary for each.
- Runs only on schedule/dispatch — never on PRs — so it is not a merge
  gate and cannot block development.

## GITHUB_TOKEN limitation (verified by dispatch smoke test)

The first smoke-test dispatch (run 31937317929) FAILED, exposing a hard
credential limit:

- **REST**: `GET /repos/{owner}/{repo}/dependabot/alerts` returns 403
  "Resource not accessible by integration" with `GITHUB_TOKEN`, even
  with `permissions: security-events: read`. The Actions GitHub App
  does not carry the "Dependabot alerts" repository permission
  (confirmed by GitHub community discussion #60612).
- **GraphQL**: `repository.vulnerabilityAlerts` does NOT error but
  silently returns an empty connection for `GITHUB_TOKEN` (totalCount 0
  vs 57 with a scoped token) — a false negative that would pass every
  night. Worse than failing, so it was rejected.
- The first workflow draft also chained `2>/dev/null || echo '[]'` on
  the failing REST call; gh api prints the 3-key error object to stdout
  before exiting non-zero, so the fallback concatenated the error JSON
  with `[]` and jq reported a bogus count (`3\n0` → step failure
  "Invalid format '0'").

## Required secret (resolved 2026-08-16)

`DEPENDABOT_TOKEN` — set via `gh secret set DEPENDABOT_TOKEN -b "$(gh auth token)"`
(the gh CLI token carries the `repo` scope, which can read the
Dependabot alerts endpoint; no manual PAT creation needed). The
classic-token scope is broader than the ideal fine-grained
PAT (`Dependabot alerts: Read` only) — rotate to a fine-grained PAT
if the token is ever exposed or scoped down. When the secret is absent
the job fails loudly with instructions instead of reporting zero alerts.

## Related hardening in this batch

- Diagnoser (`scripts/diagnose-merge-state.sh`) now fetches
  `isOutdated` and calls out outdated-but-unresolved review threads
  explicitly (LESSON-032): they still count toward
  `required_review_thread_resolution` (PR #692).
- `tests/diagnose-merge-state.bats` + `tests/helpers/mock-gh.bash`
  extended for the new `total outdated` thread-count pair.
- LESSON-032 added to `agents-docs/LESSONS.md` + `lessons.jsonl`.

## Verification

- `bats tests/diagnose-merge-state.bats` — 18/18 pass.
- yamllint, shellcheck, bats suite, link validation via
  `./scripts/quality_gate.sh`.
- Workflow uses only `actions/checkout` pinned to a full SHA (v7.0.1),
  satisfying `validate-gha-shas`.
- Dispatch smoke tests: first run failed (GITHUB_TOKEN 403); second run
  (GraphQL) passed but was a silent false negative (empty connection),
  which is why GraphQL was rejected. Final version requires
  `DEPENDABOT_TOKEN` and fails loudly when it is absent.
- **Final verification (2026-08-16):** secret created from the gh CLI
  token; dispatch run 31951676900 on `main` completed **success**
  (job `Open Alert Check: success`, no `::error::` annotations, 0 open
  alerts). Nightly schedule `17 4 * * *` confirmed active for the first
  scheduled run at 04:17 UTC.
