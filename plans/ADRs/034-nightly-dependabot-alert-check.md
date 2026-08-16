# ADR 034 — Nightly Dependabot Alert Check + Resolve-Every-Thread Merge Gate (2026-08-16)

**Status**: ACCEPTED (delivered via PRs #694 and #695)

## Context

- The PR sweep on 2026-08-15 found a high-severity transitive `nanoid`
  alert (#61) with no open issue and no CI signal — Dependabot does not
  auto-PR transitive overrides and the weekly security scan only reports
  to the Security tab (plans/126).
- We need dependency regressions to surface automatically before the
  next manual PR sweep.
- Separately, PR #692 sat `BLOCKED` with all 26 checks green because two
  OwlWatch review threads marked `isOutdated: true` were still
  `isResolved: false` — `required_review_thread_resolution` counts every
  unresolved thread regardless of the outdated flag (LESSON-032).

## Decision

1. **Nightly Dependabot alert check** (`.github/workflows/dependabot-alert-check.yml`):
   - Runs nightly at 04:17 UTC (after the 03:00 CI nightly) plus
     `workflow_dispatch`; never on PRs (not a merge gate).
   - Uses the gh CLI against
     `GET /repos/{owner}/{repo}/dependabot/alerts?state=open` with a
     fine-grained PAT secret `DEPENDABOT_TOKEN`
     (permission: **Dependabot alerts: Read**).
   - Fails loudly with `::error::` when any open alert exists or when
     the secret is missing — a permission gap must never masquerade as
     zero alerts.
   - `GITHUB_TOKEN` is explicitly rejected: the REST endpoint 403s
     ("Resource not accessible by integration") and GraphQL
     `vulnerabilityAlerts` silently returns an empty connection
     (verified by dispatch smoke tests, plans/127).
2. **Resolve-every-thread merge gate policy**:
   - `isOutdated` does NOT exempt a review thread from the ruleset's
     `required_review_thread_resolution`. Before declaring merge-state
     staleness, `pullRequest.reviewThreads` must show zero
     `isResolved: false` nodes — including outdated ones.
   - The `pr-merge-state-diagnoser` now fetches `isOutdated` and calls
     out outdated-but-unresolved threads explicitly in its BLOCKED
     diagnosis (LESSON-032).

## Alternatives considered

- **GraphQL `vulnerabilityAlerts` with `GITHUB_TOKEN`**: rejected — it
  does not error but silently returns an empty connection (totalCount 0
  vs 57 with a scoped token), which would pass every night even with
  open alerts. A false negative is worse than a loud failure.
- **`security-events: read` on `GITHUB_TOKEN`**: rejected — the Actions
  GitHub App does not carry the "Dependabot alerts" repository
  permission; the REST endpoint still 403s (GitHub community discussion
  #60612).
- **yamllint `disable-line` directives in workflow `run: |` blocks**:
  rejected after empirical testing — the directives do not work inside
  block scalars, and multi-line quoted strings break because YAML
  indentation becomes word separators after bash joins the
  continuation. Long script lines must be kept under the CI yamllint
  limit (120) or restructured.

## Consequences

- The nightly check fails loudly until `DEPENDABOT_TOKEN` exists
  (user action: fine-grained PAT with Dependabot alerts: Read stored as
  a repo secret), then fails loudly on any open alert.
- Dependency regressions surface within ~24h instead of at the next
  manual sweep; the PR body lists number, severity, and package.
- Future sessions must resolve every review thread (outdated or not)
  before escalating to the staleness ladder or `--admin`; the diagnoser
  comment now names outdated threads so they cannot be dismissed.
- The check adds one small scheduled job; runner contention is avoided
  by scheduling after the CI nightly.

## Related

- plans/126 (nanoid remediation), plans/127 (alert-check plan),
  plans/098 (merge-state staleness playbook), LESSON-032.
