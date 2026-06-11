#!/usr/bin/env bash
# ci-watch.sh — Monitor GitHub Actions CI status for a PR or branch
# Usage: ci-watch.sh <PR#|branch> [--timeout N] [--interval N] [--once]
set -euo pipefail

PR_OR_BRANCH="${1:?Usage: ci-watch.sh <PR#|branch> [--timeout N] [--interval N] [--once]}"
shift

TIMEOUT=1800
INTERVAL=30
ONCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --once) ONCE=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Determine if argument is a PR number or branch name
if [[ "$PR_OR_BRANCH" =~ ^[0-9]+$ ]]; then
  IS_PR=true
  PR_NUM="$PR_OR_BRANCH"
  echo "→ Monitoring PR #$PR_NUM CI status..."
else
  IS_PR=false
  BRANCH="$PR_OR_BRANCH"
  echo "→ Monitoring branch '$BRANCH' CI status..."
fi

get_pr_checks() {
  if $IS_PR; then
    gh pr checks "$PR_NUM" 2>&1
  else
    local run_id
    run_id=$(gh run list --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
    if [[ -z "$run_id" || "$run_id" == "null" ]]; then
      echo "No runs found for branch '$BRANCH'" >&2
      return 1
    fi
    gh run view "$run_id" --json status,conclusion,jobs \
      --jq '{status: .status, conclusion: .conclusion, jobs: [.jobs[] | {name: .name, status: .status, conclusion: .conclusion}]}' 2>&1
  fi
}

check_all_passed() {
  local output="$1"
  if $IS_PR; then
    # gh pr checks returns non-zero if any check failed, but we parse the output
    echo "$output" | grep -qE "(success|neutral|skipped)" && ! echo "$output" | grep -qE "(failure|cancelled|timed_out|action_required)"
  else
    echo "$output" | grep -q '"conclusion":"success"'
  fi
}

check_any_failed() {
  local output="$1"
  if $IS_PR; then
    echo "$output" | grep -qE "(failure|cancelled|timed_out|action_required)"
  else
    echo "$output" | grep -q '"conclusion":"failure"'
  fi
}

extract_failures() {
  local output="$1"
  if $IS_PR; then
    echo "$output" | grep -E "(failure|cancelled|timed_out|action_required)" | head -10
  else
    echo "$output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for job in data.get('jobs', []):
        if job.get('conclusion') not in ('success', 'neutral', 'skipped', None):
            print(f\"  ✗ {job['name']}: {job['conclusion']}\")
except: pass
" 2>/dev/null
  fi
}

# Initial check
OUTPUT=$(get_pr_checks) || { echo "→ Failed to check status"; exit 1; }
echo "$OUTPUT"
echo ""

if check_all_passed "$OUTPUT"; then
  echo "✓ All checks passed!"
  exit 0
fi

if check_any_failed "$OUTPUT"; then
  echo "✗ Checks failed:"
  extract_failures "$OUTPUT"
  exit 1
fi

if $ONCE; then
  echo "⏳ Checks still in progress (use without --once to poll)"
  exit 0
fi

# Poll loop
ELAPSED=0
while [[ $ELAPSED -lt $TIMEOUT ]]; do
  echo "⏳ Waiting ${INTERVAL}s... (${ELAPSED}/${TIMEOUT}s elapsed)"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))

  OUTPUT=$(get_pr_checks 2>/dev/null) || continue
  echo "$OUTPUT"
  echo ""

  if check_all_passed "$OUTPUT"; then
    echo "✓ All checks passed! (${ELAPSED}s elapsed)"
    exit 0
  fi

  if check_any_failed "$OUTPUT"; then
    echo "✗ Checks failed after ${ELAPSED}s:"
    extract_failures "$OUTPUT"
    exit 1
  fi
done

echo "⏰ Timeout reached (${TIMEOUT}s). Checks still in progress."
echo "Current status:"
echo "$OUTPUT"
exit 2
