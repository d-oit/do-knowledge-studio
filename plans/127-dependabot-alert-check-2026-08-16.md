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
- Queries `GET /repos/{owner}/{repo}/dependabot/alerts?state=open` and
  fails with `::error::` when any open alert exists, printing number,
  severity, package, and advisory summary for each.
- `permissions: security-events: read` — the minimum required to read
  alerts with `GITHUB_TOKEN`.
- Runs only on schedule/dispatch — never on PRs — so it is not a merge
  gate and cannot block development.

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
