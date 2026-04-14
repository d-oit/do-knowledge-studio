#!/usr/bin/env bash
# Atomic Commit Orchestrator - Main entry point
# Validates, commits, pushes, creates PR, and verifies CI
# Usage: ./run.sh [--message "type(scope): desc"] [--dry-run] [--skip-ci]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Default configuration
DRY_RUN=false
SKIP_CI=false
MESSAGE=""
TIMEOUT="${ATOMIC_COMMIT_TIMEOUT:-1800}"
BASE_BRANCH="${ATOMIC_COMMIT_BASE_BRANCH:-main}"
NO_ROLLBACK="${ATOMIC_COMMIT_NO_ROLLBACK:-0}"

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

# Error codes - documented in spec, some reserved for future use
readonly E_SUCCESS=0
# shellcheck disable=SC2034
readonly E_GENERIC=1
readonly E_QUALITY_GATE=2
readonly E_COMMIT=3
readonly E_PUSH=4
readonly E_PR_CREATE=5
readonly E_CHECKS=6
# shellcheck disable=SC2034
readonly E_TIMEOUT=7
# shellcheck disable=SC2034
readonly E_ROLLBACK=8

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --message|-m)
                MESSAGE="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-ci)
                SKIP_CI=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --base-branch)
                BASE_BRANCH="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << 'EOF'
Usage: run.sh [OPTIONS]

Atomic workflow: validate → commit → push → PR → verify

Options:
    -m, --message "MSG"     Commit message (auto-detect type if omitted)
    --dry-run               Validate only, no commits or pushes
    --skip-ci               Skip CI verification (emergency only)
    --timeout SECONDS       Timeout for CI checks (default: 1800)
    --base-branch BRANCH    Target branch for PR (default: main)
    -h, --help              Show this help

Environment:
    ATOMIC_COMMIT_TIMEOUT       CI wait timeout in seconds
    ATOMIC_COMMIT_BASE_BRANCH   Target branch for PR
    ATOMIC_COMMIT_NO_ROLLBACK   Set 1 to disable rollback on failure

Error Codes:
    0   Success
    1   Generic failure
    2   Quality gate failed
    3   Commit failed
    4   Push failed
    5   PR creation failed
    6   Checks failed/warnings found
    7   Timeout
    8   Rollback failed
EOF
}

log() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"
}

error() {
    echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2
}

success() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $*"
}

# Phase tracking
CURRENT_PHASE=""
COMMIT_SHA=""
PR_NUMBER=""
PR_URL=""
START_TIME=""

set_phase() {
    CURRENT_PHASE="$1"
    log "Phase: $CURRENT_PHASE"
}

# Rollback functions
rollback_commit() {
    if [[ "$NO_ROLLBACK" == "1" ]]; then
        warn "Rollback disabled, leaving commit in place"
        return 0
    fi

    log "Rolling back commit..."
    if git rev-parse --verify HEAD~1 &>/dev/null; then
        git reset --soft HEAD~1 || true
        git reset HEAD || true
    fi
}

rollback_push() {
    if [[ "$NO_ROLLBACK" == "1" ]]; then
        warn "Rollback disabled, leaving remote commit in place"
        return 0
    fi

    log "Attempting to rollback push..."
    local branch
    branch=$(git branch --show-current)
    # Best effort rollback
    git push origin "+HEAD~1:$branch" 2>/dev/null || warn "Push rollback failed (may already be merged)"
}

rollback_pr() {
    if [[ "$NO_ROLLBACK" == "1" ]] || [[ -z "$PR_NUMBER" ]]; then
        return 0
    fi

    log "Closing PR #$PR_NUMBER..."
    gh pr close "$PR_NUMBER" 2>/dev/null || warn "PR close failed"
}

# Execute phase with error handling
run_phase() {
    local phase_name="$1"
    local script="$2"
    shift 2

    set_phase "$phase_name"

    if [[ "$DRY_RUN" == true ]] && [[ "$phase_name" != "PRE_COMMIT" ]]; then
        log "Dry run: skipping $phase_name"
        return 0
    fi

    if ! "$script" "$@"; then
        error "$phase_name failed"
        return 1
    fi
}

# State machine
main() {
    parse_args "$@"

    cd "$REPO_ROOT"

    START_TIME=$(date +%s)

    log "Starting atomic commit workflow"
    log "Base branch: $BASE_BRANCH"
    log "Dry run: $DRY_RUN"
    log "Skip CI: $SKIP_CI"
    echo ""

    # State: PRE_COMMIT
    if ! run_phase "PRE_COMMIT" "$SCRIPT_DIR/validate.sh"; then
        exit $E_QUALITY_GATE
    fi

    if [[ "$DRY_RUN" == true ]]; then
        success "Dry run completed - all validations passed"
        exit $E_SUCCESS
    fi

    # State: COMMIT
    if ! run_phase "COMMIT" "$SCRIPT_DIR/commit.sh" "$MESSAGE"; then
        rollback_commit
        exit $E_COMMIT
    fi

    COMMIT_SHA=$(git rev-parse HEAD)
    log "Created commit: ${COMMIT_SHA:0:8}"

    # State: PRE_PUSH
    if ! run_phase "PRE_PUSH" "$SCRIPT_DIR/push.sh" "--check-only"; then
        rollback_commit
        exit $E_PUSH
    fi

    # State: PUSH
    if ! run_phase "PUSH" "$SCRIPT_DIR/push.sh"; then
        rollback_commit
        exit $E_PUSH
    fi

    # Verify push
    local local_sha remote_sha
    local_sha=$(git rev-parse HEAD)
    remote_sha=$(git rev-parse "origin/$(git branch --show-current)" 2>/dev/null || echo "")

    if [[ "$local_sha" != "$remote_sha" ]]; then
        error "Push verification failed: local SHA != remote SHA"
        rollback_push
        rollback_commit
        exit $E_PUSH
    fi

    # State: PR_CREATE
    if ! run_phase "PR_CREATE" "$SCRIPT_DIR/create-pr.sh" "$BASE_BRANCH"; then
        rollback_push
        rollback_commit
        exit $E_PR_CREATE
    fi

    # Get PR info
    PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "")
    PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")

    if [[ -z "$PR_URL" ]]; then
        error "Failed to get PR URL"
        rollback_push
        rollback_commit
        exit $E_PR_CREATE
    fi

    success "Created PR: $PR_URL"

    # State: VERIFY (unless skipped)
    if [[ "$SKIP_CI" == false ]]; then
        if ! run_phase "VERIFY" "$SCRIPT_DIR/verify.sh" "$PR_NUMBER" "$TIMEOUT"; then
            rollback_pr
            rollback_push
            rollback_commit
            exit $E_CHECKS
        fi
    else
        warn "CI verification skipped"
    fi

    # State: REPORT
    set_phase "REPORT"

    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - START_TIME))

    echo ""
    success "═════════════════════════════════════════════════════════════════"
    success "║  Atomic Commit Workflow COMPLETED SUCCESSFULLY                  ║"
    success "═════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Commit:     ${COMMIT_SHA:0:8}"
    echo "  PR:         $PR_URL"
    echo "  Duration:   ${duration}s"
    echo ""
    echo "  Next steps:"
    echo "    - Review the PR at the URL above"
    echo "    - Merge when ready (squash recommended)"
    echo ""

    exit $E_SUCCESS
}

main "$@"
