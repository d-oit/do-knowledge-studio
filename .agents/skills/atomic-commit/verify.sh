#!/usr/bin/env bash
# Phase 6: VERIFY - Wait for CI checks
# Polls GitHub checks with timeout, zero warnings policy
# Usage: verify.sh [pr-number] [timeout-seconds]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PR_NUMBER="${1:-}"
TIMEOUT="${2:-1800}"
POLL_INTERVAL=10

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log() {
    echo -e "${BLUE}[verify]${NC} $*"
}

error() {
    echo -e "${RED}[verify]${NC} $*" >&2
}

success() {
    echo -e "${GREEN}[verify]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[verify]${NC} $*"
}

cd "$REPO_ROOT"

# Get PR number if not provided
if [[ -z "$PR_NUMBER" ]]; then
    PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
fi

if [[ -z "$PR_NUMBER" ]]; then
    error "No PR number provided and cannot detect from current branch"
    exit 1
fi

log "Monitoring PR #$PR_NUMBER"
log "Timeout: ${TIMEOUT}s"
log "Poll interval: ${POLL_INTERVAL}s"
echo ""

START_TIME=$(date +%s)
ALL_PASS=false

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [[ $ELAPSED -gt $TIMEOUT ]]; then
        error "Timeout waiting for checks (${TIMEOUT}s)"
        error "PR may still be processing - check manually at:"
        gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || true
        exit 1
    fi

    # Get checks status
    CHECKS_OUTPUT=$(gh pr checks "$PR_NUMBER" 2>&1 || true)

    # Check if checks are still pending
    if echo "$CHECKS_OUTPUT" | grep -qiE "(pending|queued|in progress|running)"; then
        log "Checks still running... (${ELAPSED}s elapsed)"
        sleep $POLL_INTERVAL
        continue
    fi

    # Check for failures
    if echo "$CHECKS_OUTPUT" | grep -qiE "(fail|error|x |✗)"; then
        error "Checks failed!"
        echo "$CHECKS_OUTPUT"
        exit 1
    fi

    # Check for warnings (zero warnings policy)
    if echo "$CHECKS_OUTPUT" | grep -qiE "(warning|warn:|deprecated|lint.*warn)"; then
        error "Warnings detected in checks - zero warnings policy enforced"
        error "Fix all warnings before completing:"
        echo "$CHECKS_OUTPUT"
        exit 1
    fi

    # Check for success
    if echo "$CHECKS_OUTPUT" | grep -qiE "(pass|success|✓|✔)"; then
        # Verify no pending checks remain
        if ! echo "$CHECKS_OUTPUT" | grep -qiE "(pending|queued|in progress|running)"; then
            ALL_PASS=true
            break
        fi
    fi

    # Check if any checks exist
    if echo "$CHECKS_OUTPUT" | grep -qiE "(no checks|no status)"; then
        # No CI configured or checks not started yet
        if [[ $ELAPSED -gt 60 ]]; then
            warn "No checks detected after 60s"
            warn "If repository has no CI, use --skip-ci flag"
            log "Continuing..."
            ALL_PASS=true
            break
        fi
    fi

    sleep $POLL_INTERVAL
done

if [[ "$ALL_PASS" == true ]]; then
    echo ""
    success "═════════════════════════════════════════════════════════════════"
    success "  All CI Checks PASSED"
    success "  Zero warnings detected"
    success "═════════════════════════════════════════════════════════════════"
    echo ""

    # Show final PR status
    PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || echo "")
    success "PR ready: $PR_URL"

    exit 0
else
    error "Checks did not complete successfully"
    exit 1
fi
