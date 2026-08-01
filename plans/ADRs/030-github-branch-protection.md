# ADR 030 — GitHub Branch Protection Configuration for `main`

**Date**: 2026-08-01  
**Status**: Implemented  
**Related**: Plan 098

## Context

After the repository ruleset migration, `main` had an inconsistent protection
stack: a legacy branch-protection rule still required one approving review
(`required_approving_review_count: 1`) while the active repository ruleset
configured zero approvals. This mismatch caused PRs #583 and #584 to report
`REVIEW_REQUIRED` / `BLOCKED` and reject `gh pr merge` with "the base branch
policy prohibits the merge" even when every ruleable gate passed.

This ADR records the intended, single-source protection configuration for
`main` so future changes are deliberate and verifiable.

## Decision

### 1. Legacy branch protection is not used on `main`

The legacy `branches/main/protection` rule (which required one approving
review) is deleted. `GET /repos/{owner}/{repo}/branches/main/protection`
returns 404. All enforcement comes from repository rulesets.

### 2. The `main` repository ruleset is the single source of truth

Repository ruleset `main` (target: default branch, enforcement: active) defines:

- `deletion` — prevent deletion of the branch.
- `required_linear_history` — merge commits that would create non-linear
  history are rejected; use **squash** (or rebase) merges.
- `required_status_checks` — strict policy; the only required check context is
  `Codacy Static Code Analysis` (integration id 56611).
- `pull_request` — **zero** required approving reviews; required review-thread
  resolution; allowed merge methods: merge, squash, rebase.
- `code_quality` — enforce severity `errors`.
- `code_scanning` — `Codacy Static Code Analysis` and `CodeQL`, security
  threshold `high_or_higher`, alerts `errors`.

No org-level rulesets apply to this repository (verified via the effective
`rules/branches/main` endpoint, which returns only the repository ruleset).

### 3. Review requirement is zero — human review is a process gate, not a rule

Automated agent workflows may merge PRs once the ruleset gates pass. The
maintainer's review remains a process gate (see AGENTS.md "Git Workflow"),
enforced by convention and the code-review skill, not by GitHub rules.

### 4. `BLOCKED` merge-state after protection changes is expected to be stale

GitHub's mergeability cache can report `BLOCKED` for minutes-to-hours after
ruleset/branch-protection edits even when all gates pass. The authoritative
signals are the rule endpoints
(`GET /repos/{owner}/{repo}/rules/branches/{branch}` and
`GET /repos/{owner}/{repo}/rulesets/{id}`), not `mergeStateStatus` alone.
The verified unblock order and guardrails are documented once in
`AGENTS.md` ("GitHub merge-state staleness") and in
`plans/098-audit-github-merge-state-staleness.md`; this ADR does not
replicate them. Never use `--admin` to bypass protections without explicit
maintainer approval.

## Consequences

### Positive

- One protection layer instead of two; no conflicting approval counts.
- PRs #583/#584/#585 and future agent PRs merge through a single verifiable gate.
- The required-check list is minimal (Codacy) and strict.

### Negative

- A stale GitHub merge-state cache delays merges after configuration changes.
- Zero required approvals means an accidental push to `main` is not blocked by
  review; `required_linear_history` + required checks remain the hard guardrails.

## Verification

- `gh api repos/d-oit/do-knowledge-studio/branches/main/protection` → 404.
- `gh api repos/d-oit/do-knowledge-studio/rules/branches/main` lists only the
  repository ruleset with the rules above.
- PR merges use squash and succeed once all ruleset gates pass.
