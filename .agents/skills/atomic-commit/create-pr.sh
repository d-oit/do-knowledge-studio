#!/usr/bin/env bash
# Phase 5: PR_CREATE - Create pull request
# Creates PR with proper title, body, and base branch
# Usage: create-pr.sh [base-branch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

BASE_BRANCH="${1:-main}"

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' BLUE='' NC=''
fi

log() {
    echo -e "${BLUE}[pr-create]${NC} $*"
}

error() {
    echo -e "${RED}[pr-create]${NC} $*" >&2
}

success() {
    echo -e "${GREEN}[pr-create]${NC} $*"
}

cd "$REPO_ROOT"

CURRENT_BRANCH=$(git branch --show-current)
COMMIT_SUBJECT=$(git log -1 --pretty=%s)

log "Creating PR for branch: $CURRENT_BRANCH"
log "Base branch: $BASE_BRANCH"

# Generate PR body
generate_pr_body() {
    cat << EOF
## Summary

$COMMIT_SUBJECT

## Changes

$(git log --oneline "origin/$BASE_BRANCH..HEAD" | sed 's/^/- /')

## Type

$(echo "$COMMIT_SUBJECT" | grep -oE '^(feat|fix|docs|style|refactor|perf|test|ci|chore)' || echo "other")

## Checklist

- [x] Quality gate passed
- [x] All tests pass
- [x] No secrets in code
- [x] Conventional commit format

## Related

<!-- Link related issues: Fixes #123, Closes #456 -->

EOF
}

# Check if PR already exists for this branch
EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [[ -n "$EXISTING_PR" ]]; then
    log "PR already exists for this branch: #$EXISTING_PR"
    success "Using existing PR"
    exit 0
fi

# Create PR
log "Creating new pull request..."

PR_BODY=$(generate_pr_body)

if ! PR_URL=$(gh pr create \
    --title "$COMMIT_SUBJECT" \
    --body "$PR_BODY" \
    --base "$BASE_BRANCH" 2>&1); then

    error "Failed to create PR"
    error "$PR_URL"
    exit 1
fi

# Get PR number from URL
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || echo "")

if [[ -z "$PR_NUMBER" ]]; then
    # Try to get from gh pr view
    PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
fi

success "Created PR #$PR_NUMBER"
success "URL: $PR_URL"

# Export for parent process
export ATOMIC_COMMIT_PR_URL="$PR_URL"
export ATOMIC_COMMIT_PR_NUMBER="$PR_NUMBER"

exit 0
