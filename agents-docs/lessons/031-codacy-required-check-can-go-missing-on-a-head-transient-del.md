## LESSON-031: Codacy required check can go MISSING on a head (transient delay)

**Date**: 2026-08-14
**Component**: Codacy / GitHub Merge Workflow / Static Analysis
**Severity**: Medium

**Issue**: PR #678 sat `BLOCKED` with every check green and `Codacy Static
Code Analysis` (the ruleset's only required status check) entirely ABSENT
from the PR check list and both head check-runs — no `FAILED`, no
`ACTION_REQUIRED`, just missing. The empty-commit nudge made it appear, and
then it analyzed every subsequent push normally (4 more pushes, zero help).
Separately, PR #677/#678/#679 kept tripping Codacy findings that were false
positives but still blocked merges until fixed at code level.

**Root Cause**:

- Codacy's push webhook can lag minutes-to-hours on a PR head (queuing
delay on Codacy's side). The delay is indistinguishable from a broken
integration via `gh pr checks` alone — the head commit's check-runs API
(`commits/{sha}/check-runs`) is the source of truth.
- Three recurring false-positive patterns trip the gate on NEW code even
though `.codacy.yml` has suppressions for them (config does not cover new
PR code — plans/112):
  - `detect-object-injection` on constant `Record` lookups
    (`TYPE_ICONS[type]`) → exhaustive typed `switch` with `default`.
  - `no-unnecessary-condition` "value is always falsy" on TS non-nullable
    values (`!rowEntities`, `!document.documentElement`) → index-bounds
    checks (`i >= arr.length`) / presence checks (`typeof x === 'undefined'`).
  - `confusing-void-expression` on void-returning arrows
    (`onClick={() => setX(!x)}`) → braces.

**Solution**:

- Missing check: verify against `commits/{sha}/check-runs`, re-arm
  auto-merge, then empty-commit nudge; never reconfigure Codacy for it.
- Findings: read annotations via
  `check-runs/{id}/annotations`, apply the code-level fix, re-push.
  Full playbook: `plans/123-codacy-merge-gate-playbook-2026-08-14.md`.

**Prevention**:

- Treat a missing required check like LESSON-028/030: verify the real
  source (check-runs on the head) before escalating; nudge, don't fix.
- Never falsy-check TS non-nullables; use bounds/presence checks.
- Never introduce dynamic `Record` indexing for constant lookups.

**Tags**: #codacy #merge-gate #static-analysis #false-positive #merge-state #nudge
