# Plan 123 — Codacy Merge Gate: Missing-Check Diagnosis + False Positives

Date: 2026-08-14

Status: ACTIVE REFERENCE — distilled from PRs #677/#678/#679 (2026-08-14)

## Purpose

Document how the `Codacy Static Code Analysis` merge gate actually behaves on
this repo, so agents stop burning cycles on two recurring confusions:

1. **A BLOCKED PR with all-green checks where Codacy never posted at all** —
   that is a transient delay, NOT a broken integration.
2. **Codacy findings that are false positives but still block merges** — they
   get code-level fixes, because `.codacy.yml` suppressions do not cover new
   PR code.

Cross-references: AGENTS.md "Codacy merge gate" + zero-tolerance rule,
`plans/112-codacy-repo-issues-remediation-2026-08-10.md` (config mismatch +
original 28-issue sweep), `plans/098-audit-github-merge-state-staleness.md`
(stale-cache BLOCKED), `agents-docs/LESSONS.md` LESSON-026/028/030/031.

## The gate

- The `main` ruleset (`id 15161694`) requires **only** `Codacy Static Code
  Analysis` as a status check, `strict_required_status_checks_policy: true`
  (plans/098). Plus `required_review_thread_resolution` (LESSON-026/030) and
  `required_linear_history` (squash/rebase only).
- AGENTS.md zero-tolerance: no merge while Codacy is `ACTION_REQUIRED`,
  `FAILED`, or reports new issues — resolved or suppressed with a documented
  reason only.

## Scenario A — Codacy check is MISSING from the head (delay, not defect)

Observed 2026-08-14 (PR #678): `gh pr checks` all SUCCESS, merge state
`BLOCKED`, and the required Codacy check appears **nowhere** — not on the PR
check list, not in the head commit's check-runs. No threads, no failures.

### Diagnosis (in order)

```bash
# 1. Source of truth — check runs ON THE HEAD COMMIT (not gh pr checks)
gh api repos/<owner>/<repo>/commits/<sha>/check-runs \
  --jq '.check_runs[] | "\(.conclusion // .status): \(.name)"'

# 2. If Codacy is absent from that list, confirm the ruleset still requires it
gh api repos/<owner>/<repo>/rulesets --jq '.[] | select(.name=="main") | .id'

# 3. Confirm threads are not the blocker (LESSON-026/030)
gh api graphql -f query='query { repository(owner: "<owner>", name: "<repo>") {
  pullRequest(number: N) {
    reviewThreads(first: 10) { nodes { id isResolved } }
  }
} }'
```

### Resolution ladder

1. Re-arm auto-merge (`gh pr merge N --auto --squash --delete-branch`).
2. If still `BLOCKED` with Codacy absent, **empty-commit push**:

   ```bash
   git commit --allow-empty -m 'chore(ci): nudge Codacy re-analysis'
   git push
   ```

   This re-triggers Codacy's push webhook; it appears and completes within
   minutes, then analyzes **every subsequent push normally** (proven on
   PR #678: 4 more pushes, all analyzed without help).
3. Close/reopen only as a last resort (plans/098).
4. `--admin` only with explicit human approval (AGENTS.md).

Do NOT treat this as a Codacy integration defect; do NOT change Codacy
settings or `.codacy.yml` for it. It is a queuing delay on Codacy's side.

## Scenario B — ACTION_REQUIRED with real findings

```bash
# Find the Codacy run id for the head
gh api repos/<owner>/<repo>/commits/<sha>/check-runs \
  --jq '.check_runs[] | select(.name | contains("Codacy")) | .id'

# Read the annotations
gh api repos/<owner>/<repo>/check-runs/<id>/annotations \
  --jq '.[] | [.path, .start_line, .annotation_level, (.message[0:300])] | @tsv'
```

Triage each annotation: real defect → fix; false positive → fix at **code
level** (never suppress config without explicit approval — AGENTS.md).

## False-positive patterns catalog (code-level fixes)

### 1. "Variable Assigned to Object Injection Sink" (`detect-object-injection`)

Constant lookup `Record` indexed by a variable is flagged as a sink (e.g.
`TYPE_ICONS[type]` — PR #677, and the original 28-issue sweep in plans/112).

Fix: exhaustive typed `switch` returning direct JSX per key — no dynamic
indexing. Add a `default` fallback (OwlWatch tracks missing defaults).
Note: `react-hooks/static-components` forbids assigning the switch result to
a component variable, so return JSX directly per case.

### 2. "Unnecessary conditional, value is always falsy" (`no-unnecessary-condition`)

Falsy checks on values TypeScript types as non-nullable are dead code to the
analyzer: `if (!rowEntities)` on `arr[i]` without `noUncheckedIndexedAccess`
(PR #678), `if (!document.documentElement)` (PR #679).

Fix:

- Array access → **index-bounds check**:
  `if (vi.index >= arr.length) return null`
- DOM/global presence → **presence check**:
  `typeof document === 'undefined'`
- Never falsy-check a TS non-nullable just to silence a linter.

### 3. Void-expression arrow shorthand (`confusing-void-expression`)

`onClick={() => setShowAll(!showAll)}` (PR #677) and cleanup arrows without
braces. Fix: braces around the statement body
(`onClick={() => { setShowAll(!showAll) }}`).

## Verification workflow

- Local: `pnpm lint && pnpm typecheck && pnpm test` must stay clean before
  pushing — Codacy still surfaces CI-only findings, so plan for one fix
  cycle per PR (same as DeepSource, LESSON-027).
- After each push, wait for Codacy on the head; if the only blocker is a
  known false-positive pattern above, apply the code-level fix and re-push
  rather than suppressing.

## Files Modified

- `AGENTS.md` — "Codacy merge gate" subsection + Learnings bullet (LESSON-031)
- `agents-docs/LESSONS.md` — LESSON-031
- `agents-docs/lessons.jsonl` — LESSON-031 index entry
- This plan (reference only)
