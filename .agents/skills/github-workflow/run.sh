#!/usr/bin/env bash
# GitHub Workflow Skill - Main orchestrator
# Complete workflow: push → branch → PR → monitor → merge

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
DRY_RUN=false
PUSH_ONLY=false
NO_MERGE=false
MONITOR_ONLY=false
AUTO_MERGE=true
MERGE_METHOD="${GITHUB_WORKFLOW_MERGE_METHOD:-squash}"  # merge, squash, rebase
BASE_BRANCH="${GITHUB_WORKFLOW_BASE_BRANCH:-main}"
BRANCH_NAME=""
MESSAGE=""
REBASE="${GITHUB_WORKFLOW_REBASE:-1}"
TIMEOUT="${GITHUB_WORKFLOW_TIMEOUT:-3600}"
CHECK_ALL_ACTIONS="${GITHUB_WORKFLOW_CHECK_ALL_ACTIONS:-1}"
FAIL_ON_WARNING="${GITHUB_WORKFLOW_FAIL_ON_WARNING:-1}"
CLEANUP_BRANCH="${GITHUB_WORKFLOW_CLEANUP_BRANCH:-0}"
POLL_INTERVAL=15

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Error codes
readonly E_SUCCESS=0
readonly E_GENERAL=1
readonly E_PUSH_FAILED=2
readonly E_PR_FAILED=3
readonly E_CHECKS_FAILED=4
readonly E_MERGE_FAILED=5
readonly E_REBASE_FAILED=6
readonly E_TIMEOUT=7
readonly E_PRE_EXISTING_ONLY=8

# Logging functions
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
info() { echo -e "${CYAN}[$(date +%H:%M:%S)] INFO:${NC} $*"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $*"; }

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --message|-m)
                MESSAGE="$2"
                shift 2
                ;;
            --push-only)
                PUSH_ONLY=true
                shift
                ;;
            --no-merge)
                NO_MERGE=true
                shift
                ;;
            --monitor-only)
                MONITOR_ONLY=true
                shift
                ;;
            --auto-merge)
                AUTO_MERGE=true
                shift
                ;;
            --no-auto-merge)
                AUTO_MERGE=false
                shift
                ;;
            --merge-method)
                MERGE_METHOD="$2"
                shift 2
                ;;
            --base-branch)
                BASE_BRANCH="$2"
                shift 2
                ;;
            --branch-name)
                BRANCH_NAME="$2"
                shift 2
                ;;
            --rebase)
                REBASE=1
                shift
                ;;
            --no-rebase)
                REBASE=0
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --check-all-actions)
                CHECK_ALL_ACTIONS=1
                shift
                ;;
            --no-check-all-actions)
                CHECK_ALL_ACTIONS=0
                shift
                ;;
            --fail-on-warning)
                FAIL_ON_WARNING=1
                shift
                ;;
            --no-fail-on-warning)
                FAIL_ON_WARNING=0
                shift
                ;;
            --cleanup-branch)
                CLEANUP_BRANCH=1
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << 'EOF'
Usage: run.sh [OPTIONS]

GitHub Workflow: push → branch → PR → monitor → merge

Options:
    -m, --message "MSG"       Commit/PR message (auto-generate if omitted)
    --push-only               Only push, don't create PR or merge
    --no-merge                Create PR but don't auto-merge
    --monitor-only            Only monitor existing PR
    --auto-merge              Enable auto-merge (default)
    --no-auto-merge           Disable auto-merge
    --merge-method METHOD     merge|squash|rebase (default: squash)
    --base-branch BRANCH      Target branch (default: main)
    --branch-name NAME        Custom branch name (auto-generate if omitted)
    --rebase                  Auto-rebase if behind (default)
    --no-rebase               Don't auto-rebase
    --timeout SECONDS         Actions monitoring timeout (default: 3600)
    --check-all-actions       Monitor all repo Actions (default)
    --no-check-all-actions    Only check PR checks
    --fail-on-warning         Treat warnings as errors (default)
    --no-fail-on-warning      Allow warnings
    --cleanup-branch          Delete branch after merge
    --dry-run                 Simulate only
    -h, --help                Show this help

Environment:
    GITHUB_WORKFLOW_TIMEOUT=3600
    GITHUB_WORKFLOW_BASE_BRANCH=main
    GITHUB_WORKFLOW_MERGE_METHOD=squash
    GITHUB_WORKFLOW_AUTO_MERGE=1
    GITHUB_WORKFLOW_REBASE=1
    GITHUB_WORKFLOW_FAIL_ON_WARNING=1
    GITHUB_WORKFLOW_CLEANUP_BRANCH=0

Examples:
    run.sh -m "feat: new feature"     # Full workflow
    run.sh --push-only                # Push only
    run.sh --monitor-only             # Monitor existing PR
    run.sh --no-merge                 # PR without auto-merge
EOF
}

# Generate branch name from message
generate_branch_name() {
    local msg="${1:-}"
    local timestamp=$(date +%s)
    
    if [[ -z "$msg" ]]; then
        echo "workflow-${timestamp}"
        return
    fi
    
    # Extract type and description
    local type=$(echo "$msg" | grep -oE '^(feat|fix|docs|refactor|test|ci|chore)' || echo "workflow")
    local desc=$(echo "$msg" | sed 's/^[^(]*: //' | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | cut -c1-50 | sed 's/-*$//')
    
    echo "${type}-${desc}-${timestamp}"
}

# Check if gh CLI is available and authenticated
check_gh_cli() {
    if ! command -v gh &>/dev/null; then
        error "GitHub CLI (gh) not found. Install from https://cli.github.com/"
        return 1
    fi
    
    if ! gh auth status &>/dev/null; then
        error "GitHub CLI not authenticated. Run: gh auth login"
        return 1
    fi
    
    return 0
}

# Get current repository info
get_repo_info() {
    local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ -z "$remote_url" ]]; then
        error "No remote 'origin' configured"
        return 1
    fi
    
    # Parse owner/repo from URL
    if [[ "$remote_url" =~ github.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
        echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    else
        error "Cannot parse repository from remote URL: $remote_url"
        return 1
    fi
}

# Phase 1: PREPARE
phase_prepare() {
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 1: PREPARE"
    log "═══════════════════════════════════════════════════════════════════"
    
    cd "$REPO_ROOT"
    
    # Check git status
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Not a git repository"
        return 1
    fi
    
    # Get current branch
    local current_branch=$(git branch --show-current)
    log "Current branch: $current_branch"
    
    # Generate or use provided branch name
    if [[ -z "$BRANCH_NAME" ]]; then
        BRANCH_NAME=$(generate_branch_name "$MESSAGE")
    fi
    log "Workflow branch: $BRANCH_NAME"
    
    # If on main/master and have changes, create new branch
    if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
        if [[ -n $(git status --porcelain) ]]; then
            log "Creating feature branch from $current_branch..."
            if [[ "$DRY_RUN" == false ]]; then
                git checkout -b "$BRANCH_NAME"
            else
                log "[DRY-RUN] Would create branch: $BRANCH_NAME"
            fi
        else
            warn "No changes to push on $current_branch"
            return 1
        fi
    else
        BRANCH_NAME="$current_branch"
    fi
    
    # Generate commit message if not provided
    if [[ -z "$MESSAGE" ]]; then
        local changed_files=$(git diff --cached --name-only 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')
        if [[ -z "$changed_files" ]]; then
            changed_files=$(git status --porcelain | grep '^[AM]' | awk '{print $2}' | head -3 | tr '\n' ', ' | sed 's/,$//')
        fi
        MESSAGE="workflow: update ${changed_files:-files}"
    fi
    
    log "Commit message: $MESSAGE"
    
    return 0
}

# Phase 2: SYNC
phase_sync() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 2: SYNC"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would fetch from origin"
        return 0
    fi
    
    # Fetch from origin
    log "Fetching from origin..."
    if ! git fetch origin "$BASE_BRANCH" 2>/dev/null; then
        warn "Could not fetch from origin, continuing..."
    fi
    
    # Check if behind
    if git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
        local merge_base=$(git merge-base "origin/$BASE_BRANCH" HEAD 2>/dev/null || echo "")
        local origin_sha=$(git rev-parse "origin/$BASE_BRANCH" 2>/dev/null || echo "")
        
        if [[ -n "$merge_base" && "$merge_base" != "$origin_sha" ]]; then
            warn "Branch is behind origin/$BASE_BRANCH"
            
            if [[ "$REBASE" == 1 ]]; then
                log "Attempting to rebase..."
                
                # Check for conflicts first
                local temp_branch="temp-rebase-check-$$"
                git branch "$temp_branch" HEAD
                
                if git rebase "origin/$BASE_BRANCH" "$temp_branch" &>/dev/null; then
                    git checkout "$BRANCH_NAME"
                    git branch -D "$temp_branch"
                    
                    log "Rebasing onto origin/$BASE_BRANCH..."
                    if git rebase "origin/$BASE_BRANCH"; then
                        success "Rebase successful"
                    else
                        error "Rebase failed. Resolve conflicts manually."
                        git rebase --abort 2>/dev/null || true
                        git branch -D "$temp_branch" 2>/dev/null || true
                        return $E_REBASE_FAILED
                    fi
                else
                    git rebase --abort 2>/dev/null || true
                    git checkout "$BRANCH_NAME" 2>/dev/null || true
                    git branch -D "$temp_branch" 2>/dev/null || true
                    error "Would have rebase conflicts"
                    return $E_REBASE_FAILED
                fi
            else
                warn "Skipping rebase (--no-rebase specified)"
            fi
        else
            success "Branch is up to date with origin/$BASE_BRANCH"
        fi
    fi
    
    return 0
}

# Phase 3: PUSH
phase_push() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 3: PUSH"
    log "═══════════════════════════════════════════════════════════════════"
    
    # Check if there are changes to commit
    local has_changes=false
    
    if [[ -n $(git status --porcelain) ]]; then
        has_changes=true
    fi
    
    if [[ "$has_changes" == false ]]; then
        # Check if already pushed
        if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH_NAME" 2>/dev/null; then
            local local_sha=$(git rev-parse HEAD)
            local remote_sha=$(git rev-parse "origin/$BRANCH_NAME" 2>/dev/null || echo "")
            
            if [[ "$local_sha" == "$remote_sha" ]]; then
                success "Already up to date on origin/$BRANCH_NAME"
                return 0
            fi
        fi
    fi
    
    if [[ "$has_changes" == true ]]; then
        # Stage and commit
        if [[ "$DRY_RUN" == false ]]; then
            log "Staging changes..."
            git add -A
            
            log "Creating commit..."
            if ! git commit -m "$MESSAGE"; then
                error "Failed to create commit"
                return $E_PUSH_FAILED
            fi
            
            local commit_sha=$(git rev-parse HEAD)
            success "Created commit: ${commit_sha:0:8}"
        else
            log "[DRY-RUN] Would stage and commit: $MESSAGE"
        fi
    fi
    
    # Push to origin
    if [[ "$DRY_RUN" == false ]]; then
        log "Pushing to origin/$BRANCH_NAME..."
        if ! git push -u origin "$BRANCH_NAME" 2>&1; then
            error "Push failed"
            return $E_PUSH_FAILED
        fi
        
        # Verify push
        local local_sha=$(git rev-parse HEAD)
        local remote_sha=$(git rev-parse "origin/$BRANCH_NAME" 2>/dev/null || echo "")
        
        if [[ "$local_sha" != "$remote_sha" ]]; then
            error "Push verification failed"
            return $E_PUSH_FAILED
        fi
        
        success "Pushed successfully: ${local_sha:0:8}"
    else
        log "[DRY-RUN] Would push to origin/$BRANCH_NAME"
    fi
    
    return 0
}

# Phase 4: PR
phase_pr() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 4: PULL REQUEST"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$PUSH_ONLY" == true ]]; then
        log "--push-only specified, skipping PR creation"
        return 0
    fi
    
    # Check for existing PR
    local existing_pr=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")
    
    if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
        log "Found existing PR #$existing_pr"
        PR_NUMBER="$existing_pr"
        
        # Update PR if needed
        local current_title=$(gh pr view "$PR_NUMBER" --json title --jq '.title' 2>/dev/null || echo "")
        if [[ "$current_title" != "$MESSAGE" && "$DRY_RUN" == false ]]; then
            log "Updating PR title..."
            gh pr edit "$PR_NUMBER" --title "$MESSAGE" 2>/dev/null || true
        fi
    else
        # Create new PR
        if [[ "$DRY_RUN" == false ]]; then
            log "Creating pull request..."
            
            local pr_body="## Summary

$MESSAGE

## Changes

$(git log --oneline "origin/$BASE_BRANCH..HEAD" 2>/dev/null | sed 's/^/- /' | head -20)

## Workflow

- Branch: \`$BRANCH_NAME\`
- Base: \`$BASE_BRANCH\`
- Auto-merge: ${AUTO_MERGE}
- Merge method: ${MERGE_METHOD}

## Checklist

- [x] Changes pushed
- [x] PR created
- [ ] Checks passing
- [ ] Ready for review"
            
            local pr_url
            if ! pr_url=$(gh pr create \
                --title "$MESSAGE" \
                --body "$pr_body" \
                --base "$BASE_BRANCH" \
                --head "$BRANCH_NAME" 2>&1); then
                error "Failed to create PR: $pr_url"
                return $E_PR_FAILED
            fi
            
            PR_NUMBER=$(echo "$pr_url" | grep -oE '[0-9]+$' || echo "")
            if [[ -z "$PR_NUMBER" ]]; then
                PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
            fi
            
            success "Created PR #$PR_NUMBER"
            log "URL: $pr_url"
        else
            log "[DRY-RUN] Would create PR: $MESSAGE"
        fi
    fi
    
    return 0
}

# Phase 5: MONITOR
phase_monitor() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 5: MONITOR GITHUB ACTIONS"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$PUSH_ONLY" == true ]]; then
        log "--push-only specified, skipping monitoring"
        return 0
    fi
    
    if [[ "$MONITOR_ONLY" == true && -z "$PR_NUMBER" ]]; then
        # Try to find PR for current branch
        PR_NUMBER=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")
        if [[ -z "$PR_NUMBER" || "$PR_NUMBER" == "null" ]]; then
            error "No PR found for branch $BRANCH_NAME"
            return $E_PR_FAILED
        fi
        log "Monitoring PR #$PR_NUMBER"
    fi
    
    if [[ -z "$PR_NUMBER" ]]; then
        warn "No PR to monitor"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would monitor PR #$PR_NUMBER"
        return 0
    fi
    
    log "Monitoring PR #$PR_NUMBER for ${TIMEOUT}s..."
    log "Poll interval: ${POLL_INTERVAL}s"
    log ""
    
    local start_time=$(date +%s)
    local pre_existing_issues=()
    local new_issues=()
    local checks_complete=false
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $TIMEOUT ]]; then
            error "Timeout after ${TIMEOUT}s"
            return $E_TIMEOUT
        fi
        
        # Get PR checks
        local checks_output=$(gh pr checks "$PR_NUMBER" 2>&1 || true)
        local pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "OPEN")
        
        # Check if PR was merged externally
        if [[ "$pr_state" == "MERGED" ]]; then
            success "PR was already merged!"
            return 0
        fi
        
        if [[ "$pr_state" == "CLOSED" ]]; then
            error "PR was closed"
            return $E_CHECKS_FAILED
        fi
        
        # Parse check status
        local has_pending=false
        local has_failure=false
        local has_warning=false
        
        # Check for pending/running
        if echo "$checks_output" | grep -qiE "(pending|queued|in progress|running)"; then
            has_pending=true
        fi
        
        # Check for failures
        if echo "$checks_output" | grep -qiE "(fail|error|✗|×)"; then
            has_failure=true
        fi
        
        # Check for warnings
        if [[ "$FAIL_ON_WARNING" == 1 ]]; then
            if echo "$checks_output" | grep -qiE "(warning|warn:|deprecated)"; then
                has_warning=true
            fi
        fi
        
        # Check repository Actions if enabled
        if [[ "$CHECK_ALL_ACTIONS" == 1 ]]; then
            local repo_info=$(get_repo_info)
            if [[ -n "$repo_info" ]]; then
                # Get workflow runs for this branch
                local workflow_runs=$(gh run list --branch "$BRANCH_NAME" --limit 10 --json status,conclusion,name 2>/dev/null || echo "[]")
                
                # Check if any workflows are running
                if echo "$workflow_runs" | grep -q '"status":"in_progress"'; then
                    has_pending=true
                fi
                
                # Check for failures
                if echo "$workflow_runs" | grep -q '"conclusion":"failure"'; then
                    has_failure=true
                fi
            fi
        fi
        
        # Display status
        if [[ "$has_pending" == true ]]; then
            log "Checks still running... (${elapsed}s elapsed)"
        elif [[ "$has_failure" == true || "$has_warning" == true ]]; then
            checks_complete=true
            break
        else
            checks_complete=true
            break
        fi
        
        sleep $POLL_INTERVAL
    done
    
    # Final check analysis
    log ""
    log "Analyzing check results..."
    
    local final_checks=$(gh pr checks "$PR_NUMBER" 2>&1 || true)
    
    # Check for pre-existing issues in base branch
    log "Checking base branch $BASE_BRANCH for pre-existing issues..."
    local base_checks=$(gh pr checks "$PR_NUMBER" --json baseRefName --jq '.baseRefName' 2>/dev/null || echo "$BASE_BRANCH")
    
    # Determine if failures are new or pre-existing
    # This is a simplified check - in production you'd compare with base branch
    local all_pass=true
    
    if echo "$final_checks" | grep -qiE "(fail|error|✗|×)"; then
        all_pass=false
        new_issues+=("Check failures detected")
    fi
    
    if [[ "$FAIL_ON_WARNING" == 1 ]]; then
        if echo "$final_checks" | grep -qiE "(warning|warn:|deprecated)"; then
            all_pass=false
            new_issues+=("Warnings detected")
        fi
    fi
    
    if [[ "$all_pass" == true ]]; then
        success "All checks passed!"
        return 0
    else
        # Try to determine if issues are pre-existing
        warn "Issues detected in checks"
        warn "Review PR #$PR_NUMBER manually"
        
        # If only pre-existing issues, return special code
        # For now, treat as failure
        return $E_CHECKS_FAILED
    fi
}

# Phase 6: MERGE
phase_merge() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  PHASE 6: MERGE"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$PUSH_ONLY" == true || "$NO_MERGE" == true ]]; then
        log "Skipping merge (--push-only or --no-merge specified)"
        return 0
    fi
    
    if [[ "$AUTO_MERGE" == false ]]; then
        log "Auto-merge disabled (--no-auto-merge)"
        info "PR #$PR_NUMBER is ready for manual review and merge"
        return 0
    fi
    
    if [[ -z "$PR_NUMBER" ]]; then
        warn "No PR to merge"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would merge PR #$PR_NUMBER with method: $MERGE_METHOD"
        return 0
    fi
    
    # Final check before merge
    log "Verifying PR #$PR_NUMBER is ready..."
    
    local pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "")
    local merge_state=$(gh pr view "$PR_NUMBER" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo "")
    
    if [[ "$pr_state" == "MERGED" ]]; then
        success "PR was already merged!"
        return 0
    fi
    
    if [[ "$pr_state" != "OPEN" ]]; then
        error "PR is not open (state: $pr_state)"
        return $E_MERGE_FAILED
    fi
    
    # Check if mergeable
    if [[ "$merge_state" == "BLOCKED" ]]; then
        error "PR is blocked from merging (check branch protection rules)"
        return $E_MERGE_FAILED
    fi
    
    if [[ "$merge_state" == "DIRTY" ]]; then
        warn "PR has conflicts with base branch"
        
        if [[ "$REBASE" == 1 ]]; then
            log "Attempting to rebase..."
            if ! phase_sync; then
                return $E_REBASE_FAILED
            fi
            # Re-check merge state
            merge_state=$(gh pr view "$PR_NUMBER" --json mergeStateStatus --jq '.mergeStateStatus' 2>/dev/null || echo "")
        fi
    fi
    
    # Perform merge
    log "Merging PR #$PR_NUMBER with method: $MERGE_METHOD..."
    
    local merge_output
    if ! merge_output=$(gh pr merge "$PR_NUMBER" \
        --"${MERGE_METHOD}" \
        --delete-branch=false \
        2>&1); then
        error "Merge failed: $merge_output"
        return $E_MERGE_FAILED
    fi
    
    success "Successfully merged PR #$PR_NUMBER!"
    
    # Cleanup branch if requested
    if [[ "$CLEANUP_BRANCH" == 1 ]]; then
        log "Cleaning up branch $BRANCH_NAME..."
        git push origin --delete "$BRANCH_NAME" 2>/dev/null || warn "Could not delete remote branch"
        git branch -D "$BRANCH_NAME" 2>/dev/null || true
    fi
    
    return 0
}

# Main execution
main() {
    parse_args "$@"
    
    log "═══════════════════════════════════════════════════════════════════"
    log "  GITHUB WORKFLOW"
    log "═══════════════════════════════════════════════════════════════════"
    log "Branch: ${BRANCH_NAME:-auto}"
    log "Base: $BASE_BRANCH"
    log "Merge: $MERGE_METHOD (auto: $AUTO_MERGE)"
    log "Dry run: $DRY_RUN"
    log ""
    
    # Check prerequisites
    if ! check_gh_cli; then
        exit $E_GENERAL
    fi
    
    # Execute phases
    local exit_code=$E_SUCCESS
    
    if ! phase_prepare; then
        exit_code=$E_GENERAL
    elif ! phase_sync; then
        exit_code=$E_REBASE_FAILED
    elif ! phase_push; then
        exit_code=$E_PUSH_FAILED
    elif ! phase_pr; then
        exit_code=$E_PR_FAILED
    elif ! phase_monitor; then
        exit_code=$E_CHECKS_FAILED
    elif ! phase_merge; then
        exit_code=$E_MERGE_FAILED
    fi
    
    # Final report
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        success "WORKFLOW COMPLETED SUCCESSFULLY"
    elif [[ $exit_code -eq $E_PRE_EXISTING_ONLY ]]; then
        warn "WORKFLOW COMPLETED WITH PRE-EXISTING ISSUES"
    else
        error "WORKFLOW FAILED (exit code: $exit_code)"
    fi
    
    log "═══════════════════════════════════════════════════════════════════"
    
    exit $exit_code
}

main "$@"
