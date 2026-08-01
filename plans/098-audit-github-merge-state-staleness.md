# Plan 098 — Audit: GitHub Merge-State Staleness on PRs (2026-08-01)

**Status**: DONE (investigation + remediation recorded)
**Method**: Live GitHub API inspection (rulesets, branch protection, check runs, GraphQL merge state)

## Problem

PRs #583 and #584 reported `mergeStateStatus: BLOCKED` and rejected `gh pr merge` with "the base branch policy prohibits the merge" even though every ruleable gate was satisfied.

## Investigation Findings

### Effective protection stack for `main` (d-oit/do-knowledge-studio)

| Layer | State | Details |
|-------|-------|---------|
| Legacy branch protection | **Deleted 2026-08-01** | Previously had `required_approving_review_count: 1`, which caused the original false `REVIEW_REQUIRED`. Removed via GitHub UI; `GET /branches/main/protection` now returns 404. |
| Active repository ruleset `main` (id 15161694) | **active** | `deletion`, `required_linear_history`, `required_status_checks` (only `Codacy Static Code Analysis`, strict), `pull_request` (approvals: **0**, review-thread resolution: required, methods: merge/squash/rebase), `code_quality` (errors), `code_scanning` (Codacy + CodeQL, high_or_higher) |
| Org-level rulesets | **None** | `GET /orgs/d-oit/rulesets` → 404 (no org rulesets) |

### Why PR #584 appeared BLOCKED despite all gates passing

Verified on the PR head commit `c7a1a93`:

- `Codacy Static Code Analysis` → **success** (the only ruleset-required status check)
- `CodeQL` → success; all 20+ CI checks (build, unit tests, coverage, security scans, commitlint, labeler, DeepSource, Vercel) → success or appropriately skipped
- Required approving reviews: **0**; review threads: **0** (resolution rule trivially satisfied)
- `mergeable: MERGEABLE`, ahead 1 / behind 0, no org rulesets, no legacy protection
- Linear history satisfiable via squash merge

Conclusion: the `BLOCKED` state was a **stale GitHub mergeability cache**. Evidence it is cache, not config: the empty-commit push (`c7a1a93`) and close/reopen both forced re-evaluation, all checks re-ran green on the new head, yet the merge-state API still reported `BLOCKED`. PR #583 exhibited the identical symptom and auto-merged successfully (squash, `fa205fc`) once GitHub's cache refreshed.

## Actions Taken

- Deleted legacy branch protection rule (1 → 0 approvals conflict with ruleset) — GitHub UI, user-confirmed.
- For PR #583: protected squash auto-merge (`gh pr merge 583 --auto --squash`) → merged `fa205fc`.
- For PR #584: empty-commit push + close/reopen + protected auto-squash re-armed. All non-admin remediation paths exhausted; auto-merge is armed and will complete on GitHub's cache refresh. No `--admin` bypass was used.

## Learnings (for future sessions)

1. **GitHub merge-state is stale-able after protection changes.** After editing rulesets/branch protection, expect `BLOCKED` to persist for minutes-to-hours even when all gates pass. The reliable signals are the *rule* endpoints (`rules/branches/<ref>`, `rulesets/<id>`), not `mergeStateStatus`.
2. **Never trust a single `mergeStateStatus` read after config changes.** Verify: ruleset required checks → actual check runs, review threads count, approvals requirement, and `mergeable`.
3. **Preferred unblock order (non-admin):** (a) verify all ruleset gates green; (b) re-arm `--auto --squash --delete-branch`; (c) wait for GitHub refresh; (d) empty-commit push, then close/reopen, as last-resort nudges. `--admin` bypasses protections and should only be used with explicit user approval.
4. **Ruleset `pull_request` rule allows `merge` too**, but `required_linear_history` makes merge commits invalid in practice — always squash (or rebase) on this repo.

## Follow-up

- PR #584 auto-merge completion to be confirmed in a later session; then mark Plan 097 and Plan 15 `DONE` on `main`.
