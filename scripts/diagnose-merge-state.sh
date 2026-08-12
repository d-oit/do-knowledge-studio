#!/usr/bin/env bash
#
# Diagnose a BLOCKED pull request and post one idempotent comment naming the
# real blocker: in-flight check runs, failing runs, or an all-green stale
# merge state (see plans/098-audit-github-merge-state-staleness.md).
#
# Invoked by .github/workflows/pr-merge-state-diagnoser.yml (and the matching
# workflow template) so the diagnosis logic lives in exactly one place.
#
# Env inputs (set by the workflow env block):
#   GH_REPO    owner/repo, e.g. d-oit/do-knowledge-studio
#   PR_NUMBER  pull request number
#   BASE_REF   base branch name, e.g. main
#   HEAD_REPO  head repository full name (empty on fork-less runs)
#   GH_TOKEN   GitHub token with pull-requests: write
#
# Informational only — never a merge gate. The workflow marks this job
# continue-on-error, so API hiccups never turn the check red.

set -euo pipefail

# shellcheck disable=SC2154
# Env inputs are provided by the workflow env block above.
repo="${GH_REPO:?GH_REPO is required}"
pr_number="${PR_NUMBER:?PR_NUMBER is required}"
base_ref="${BASE_REF:?BASE_REF is required}"
head_repo="${HEAD_REPO:-}"
marker="<!-- blocked-pr-diagnoser -->"

# Fork PRs cannot be commented with the read-only token — skip silently.
if [[ -n "$head_repo" ]] && [[ "$head_repo" != "$repo" ]]; then
  exit 0
fi

mergeable_state="$(gh api "repos/$repo/pulls/$pr_number" --jq .mergeable_state)"

# Nothing to report when the PR is clean or merely unstable.
if [[ "$mergeable_state" != "blocked" ]] &&
   [[ "$mergeable_state" != "unknown" ]]; then
  existing_id="$(gh api "repos/$repo/issues/$pr_number/comments" \
    --jq "[.[] | select(.body | contains(\"$marker\"))][0].id")"
  if [[ -n "$existing_id" ]] && [[ "$existing_id" != "null" ]]; then
    gh api -X DELETE "repos/$repo/issues/comments/$existing_id" >/dev/null
  fi
  exit 0
fi

head_sha="$(gh api "repos/$repo/pulls/$pr_number" --jq .head.sha)"
in_progress="$(gh api "repos/$repo/commits/$head_sha/check-runs" \
  --jq '[.check_runs[] | select(.status != "completed")] | map(.name)')"
failed="$(gh api "repos/$repo/commits/$head_sha/check-runs" \
  --jq '[.check_runs[] | select(.conclusion |
    IN("failure", "timed_out", "action_required"))] | map(.name)')"
required="$(gh api "repos/$repo/rules/branches/$base_ref" \
  --jq '[.rules[].parameters.required_status_checks[]?.context] |
    map(select(. != null))' 2>/dev/null || echo '[]')"

header="**Blocked merge diagnosis** — $mergeable_state"
if [[ "$in_progress" != "[]" ]]; then
  body="$header
⏳ Check run(s) still in progress: $in_progress"
elif [[ "$failed" != "[]" ]]; then
  body="$header
❌ Failing check(s) blocking merge: $failed"
else
  body="$header
🟡 All checks are green (required: $required) but GitHub reports
BLOCKED — likely merge-state staleness (plans/098).
Suggested ladder: verify the ruleset endpoints, resolve review
threads, wait for in-flight runs, empty-commit nudge, close and
reopen, then admin merge only with explicit approval."
fi

body="${body}

$marker"
existing_id="$(gh api "repos/$repo/issues/$pr_number/comments" \
  --jq "[.[] | select(.body | contains(\"$marker\"))][0].id")"
if [[ -n "$existing_id" ]] && [[ "$existing_id" != "null" ]]; then
  gh api -X PATCH "repos/$repo/issues/comments/$existing_id" \
    -f body="$body" >/dev/null
else
  gh api "repos/$repo/issues/$pr_number/comments" -f body="$body" >/dev/null
fi
