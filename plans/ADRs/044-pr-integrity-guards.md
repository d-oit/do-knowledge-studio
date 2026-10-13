# ADR 044 — Pull-Request Integrity Guards

**Date**: 2026-10-13
**Status**: Implemented in Plan 165, Step 6
**Related**: Plan 163, Plan 165, ADR 030

## Context

Plan 163 recorded two merge hazards: a PR silently lowered package dependency
ranges after rebuilding from a stale base, and an automated branch run deleted
files that the target branch had added since the merge base. Neither failure
class had an automated check in the repository.

## Decision

1. On PRs that change dependency manifests, compare the minimum supported
   semantic version for each changed `dependencies` or `devDependencies` range
   in `package.json` with the target branch. Fail on a lower minimum or a
   changed range that cannot be parsed. The check validates declared ranges; it
   does not compare lockfile-resolved versions.
2. On every PR, compare the actual PR head with the target branch's merge base.
   Fail if any file added to the target branch since that merge base is absent
   from the PR head. This detects that stale-base deletion pattern; it does not
   automatically rebase the branch or prove that every possible stale-tree
   change is harmless.
3. Fetch full Git history for these jobs and pass the current target branch as
   the comparison base. The stale-base check reads the PR head ref, not GitHub's
   synthetic merge commit.
4. Keep the repository ruleset unchanged. ADR 030's required status check
   remains `Codacy Static Code Analysis`; this ADR does not add required
   contexts or modify branch protection. Repository delivery procedure still
   requires every PR check to pass before merge.

## Consequences

- Dependency-range downgrades and target-branch additions omitted from a stale
  PR tree fail visibly in CI before merge review.
- The checks are bounded to declared dependency ranges and the described
  add-then-delete pattern. They do not update branches, validate resolved
  dependency versions, or replace review of the full diff.
- These checks are not ruleset-required statuses. Making them required would be
  a branch-protection change and needs separate maintainer authorization.

## Verification

Plan 165 Step 6 records the two BATS suites, defect-injection checks, actual
comparison against `origin/main`, frozen-lockfile install, and the tooling
quality gate. The guard scripts are `scripts/check-dependency-downgrades.mjs`
and `scripts/check-stale-base-deletions.mjs`.
