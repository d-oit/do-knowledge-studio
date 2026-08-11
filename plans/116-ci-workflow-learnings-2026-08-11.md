# Plan 116 — CI/CD Workflow Learnings (2026-08-11 session)

Date: 2026-08-11

## Purpose

Capture non-obvious CI/CD pitfalls discovered during the PR sweep
(#624–#645) so future sessions avoid repeating them. Companion to the
dual-write entries in `agents-docs/LESSONS.md` (LESSON-024..026) and the
distilled notes in root `AGENTS.md`.

## Learnings

### 1. yamllint lints block scalars and templates too

- `yamllint` applies `line-length` (120 max) and
  `new-line-at-end-of-file` **inside `run: |` block scalars** and
  workflow template files, not just top-level YAML structure.
- A 158-char `gh pr view ... --jq '...'` line inside a `run:` block
  failed CI (PR #640). Broke the line with backslash continuation and
  verified with `bash -n`.
- Missing trailing newlines in `.github/workflow-templates/ci.yml` and
  `ci.properties.json` failed `YAML Syntax Validation` (PR #641).
- **Checklist**: before pushing workflow/template changes, run
  `awk 'length > 120'` on all `.yml`/`.yaml` files and verify trailing
  newline (`tail -c 1`).

### 2. GitHub branch rules require resolved review threads

- Branch rule `required_review_thread_resolution: true` blocks merges
  (BLOCKED) even when **all checks are green**.
- OwlWatch bot posts LOW-severity threads on every PR; unresolved
  threads block the merge regardless of severity.
- **Checklist**: before merging, query unresolved threads via GraphQL
  (`reviewThreads(isResolved == false)`) and resolve or address each.

### 3. Pin versions of security tooling deliberately

- `gitleaks-action` v3+ requires a paid `GITLEAKS_LICENSE` secret;
  v2.x runs license-free. See Plan 115.
- A license-gate failure masks real scan results — after unblocking
  tooling, re-run the scan to surface genuine findings (8 false
  positives appeared only after the v2 pin enabled real scanning).
- `workflow_dispatch` scans full git history (`fetch-depth: 0`), so
  deleted test files still surface — allowlist by path pattern, not
  just current-tree paths.

### 4. GitHub merge-state staleness

- `BLOCKED` can persist minutes after all gates pass (Plan 098).
  Verify against the rules endpoints (`/rules/branches/main`), not
  `mergeStateStatus` alone.
- Required check is only `Codacy Static Code Analysis`; other failures
  (e.g., gitleaks) are non-blocking but show as `UNSTABLE`.

### 5. Workflow template structure

- `.github/workflow-templates/*.yml` + `*.properties.json`
  (iconName, categories) is the GitHub convention; templates must be
  self-contained (inline checkout per job) so they are copy-paste
  ready.

## Files changed

- `plans/115` — marked RESOLVED (gitleaks v2 pin + allowlist).
- `agents-docs/LESSONS.md` — LESSON-024..026.
- `agents-docs/lessons.jsonl` — matching entries.
- `AGENTS.md` — distilled "Learnings" notes.
