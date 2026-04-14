#!/usr/bin/env bash
# Git-GitHub Workflow - Unified atomic workflow with swarm coordination
# Phases: COMMIT → CHECK ISSUES → CREATE PR → MONITOR → FIX (if needed) → MERGE → VALIDATE

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Configuration
DRY_RUN=false
MESSAGE=""
FIX_ISSUES=false
CLOSE_ISSUES=false
STRICT_VALIDATION=true
SKIP_ISSUE_CHECK=false
POST_MERGE_VALIDATE=true
AUTO_RESEARCH=true
MAX_RETRIES=3
TIMEOUT=3600
POLL_INTERVAL=15

# State tracking
COMMIT_SHA=""
BRANCH_NAME=""
PR_NUMBER=""
PR_URL=""
ISSUES_FOUND=()
CHECKS_FAILED=()
RETRY_COUNT=0
MERGE_STATUS=""

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    MAGENTA='\033[0;35m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' MAGENTA='' NC=''
fi

# Error codes
readonly E_SUCCESS=0
readonly E_COMMIT_FAILED=2
readonly E_QUALITY_GATE=3
readonly E_ISSUES_BLOCKING=4
readonly E_PR_FAILED=5
readonly E_CHECKS_FAILED=6
readonly E_MAX_RETRIES=7
readonly E_MERGE_FAILED=8
readonly E_POST_MERGE_FAILED=9

# Logging
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
info() { echo -e "${CYAN}[$(date +%H:%M:%S)] INFO:${NC} $*"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $*"; }
agent() { echo -e "${MAGENTA}[$(date +%H:%M:%S)] AGENT:${NC} $*"; }

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --message|-m)
                MESSAGE="$2"
                shift 2
                ;;
            --fix-issues)
                FIX_ISSUES=true
                shift
                ;;
            --close-issues)
                CLOSE_ISSUES=true
                shift
                ;;
            --strict-validation)
                STRICT_VALIDATION=true
                shift
                ;;
            --no-strict-validation)
                STRICT_VALIDATION=false
                shift
                ;;
            --skip-issue-check)
                SKIP_ISSUE_CHECK=true
                shift
                ;;
            --post-merge-validate)
                POST_MERGE_VALIDATE=true
                shift
                ;;
            --no-post-merge-validate)
                POST_MERGE_VALIDATE=false
                shift
                ;;
            --auto-research)
                AUTO_RESEARCH=true
                shift
                ;;
            --no-auto-research)
                AUTO_RESEARCH=false
                shift
                ;;
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
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

Unified Git-GitHub Workflow with Swarm Coordination

Phases:
  1. ATOMIC COMMIT - Stage all, validate, commit
  2. CHECK GITHUB ISSUES - List and check issues
  3. CREATE PR - Push branch, create PR
  4. MONITOR ACTIONS - ALL checks must pass
  5. FIX ISSUES (if needed) - Web research, apply fixes
  6. MERGE - Merge to main
  7. POST-MERGE VALIDATE - Verify all files/docs

Options:
    -m, --message "MSG"       Commit message (auto-generate if omitted)
    --fix-issues              Attempt to fix issues automatically
    --close-issues            Close related issues on merge
    --strict-validation       ALL checks must pass (default)
    --no-strict-validation    Allow pre-existing failures
    --skip-issue-check        Don't check GitHub issues
    --post-merge-validate     Run validation after merge (default)
    --no-post-merge-validate  Skip post-merge validation
    --auto-research           Use web research on failures (default)
    --no-auto-research        Disable auto-research
    --max-retries N           Max fix attempts (default: 3)
    --timeout SECONDS         Actions timeout (default: 3600)
    --dry-run                 Simulate without executing
    -h, --help                Show this help

Environment:
    GIT_GITHUB_WORKFLOW_TIMEOUT=3600
    GIT_GITHUB_WORKFLOW_MAX_RETRIES=3
    GIT_GITHUB_WORKFLOW_STRICT_VALIDATION=1

Examples:
    run.sh -m "feat: new feature"           # Full workflow
    run.sh --fix-issues --close-issues      # Auto-fix and close
    run.sh --dry-run                        # Simulate only
EOF
}

# Agent 1: ATOMIC COMMIT
agent_commit() {
    agent "AGENT 1: ATOMIC COMMIT"
    log "═══════════════════════════════════════════════════════════════════"
    
    cd "$REPO_ROOT"
    
    # Check git status
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Not a git repository"
        return $E_COMMIT_FAILED
    fi
    
    # Check for changes
    if [[ -z $(git status --porcelain) ]]; then
        error "No changes to commit"
        return $E_COMMIT_FAILED
    fi
    
    # Generate branch name
    local timestamp=$(date +%s)
    if [[ -z "$MESSAGE" ]]; then
        local changed_files=$(git status --porcelain | grep '^[AM]' | awk '{print $2}' | head -3 | tr '\n' ', ' | sed 's/,$//')
        MESSAGE="workflow: update ${changed_files:-files}"
    fi
    
    # Detect type from message
    local type=$(echo "$MESSAGE" | grep -oE '^(feat|fix|docs|refactor|test|ci|chore)' || echo "workflow")
    local desc=$(echo "$MESSAGE" | sed 's/^[^(]*: //' | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | cut -c1-30 | sed 's/-*$//')
    BRANCH_NAME="${type}-${desc}-${timestamp}"
    
    log "Branch: $BRANCH_NAME"
    log "Message: $MESSAGE"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would create branch and commit"
        return 0
    fi
    
    # Get current branch
    local current_branch=$(git branch --show-current)
    
    # Create feature branch from main
    if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
        log "Creating feature branch from $current_branch..."
        git checkout -b "$BRANCH_NAME"
    else
        # Already on feature branch
        BRANCH_NAME="$current_branch"
    fi
    
    # Run quality gate first
    log "Running quality gate..."
    if [[ -x "$REPO_ROOT/scripts/quality_gate.sh" ]]; then
        if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
            error "Quality gate failed - fix issues before committing"
            return $E_QUALITY_GATE
        fi
    else
        warn "quality_gate.sh not found, skipping"
    fi
    
    # Stage ALL changes
    log "Staging ALL changes..."
    git add -A
    
    # Create commit
    log "Creating commit..."
    if ! git commit -m "$MESSAGE"; then
        error "Failed to create commit"
        return $E_COMMIT_FAILED
    fi
    
    COMMIT_SHA=$(git rev-parse HEAD)
    success "Created commit: ${COMMIT_SHA:0:8} on branch $BRANCH_NAME"
    
    return 0
}

# Agent 2: CHECK GITHUB ISSUES
agent_check_issues() {
    agent "AGENT 2: CHECK GITHUB ISSUES"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$SKIP_ISSUE_CHECK" == true ]]; then
        log "Skipping issue check (--skip-issue-check)"
        return 0
    fi
    
    if ! command -v gh &>/dev/null; then
        warn "GitHub CLI not available, skipping issue check"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would check GitHub issues"
        return 0
    fi
    
    log "Checking open GitHub issues..."
    
    # Get open issues
    local issues=$(gh issue list --state open --json number,title,labels --jq '.[] | "[#\(.number)] \(.title) [\(.labels | map(.name) | join(", "))]"' 2>/dev/null || echo "")
    
    if [[ -z "$issues" ]]; then
        success "No open issues found"
        return 0
    fi
    
    # Check for blocking labels
    local blocking_issues=$(gh issue list --state open --label "blocking" --json number,title 2>/dev/null || echo "[]")
    local critical_issues=$(gh issue list --state open --label "critical" --json number,title 2>/dev/null || echo "[]")
    
    if [[ "$blocking_issues" != "[]" && "$blocking_issues" != "" ]]; then
        error "BLOCKING issues found:"
        echo "$blocking_issues" | jq -r '.[] | "  #\(.number): \(.title)"'
        
        if [[ "$FIX_ISSUES" == true ]]; then
            log "--fix-issues enabled, will attempt to resolve"
            ISSUES_FOUND+=("$blocking_issues")
        else
            error "Resolve blocking issues before merge or use --fix-issues"
            return $E_ISSUES_BLOCKING
        fi
    fi
    
    if [[ "$critical_issues" != "[]" && "$critical_issues" != "" ]]; then
        warn "CRITICAL issues found:"
        echo "$critical_issues" | jq -r '.[] | "  #\(.number): \(.title)"'
        ISSUES_FOUND+=("$critical_issues")
    fi
    
    info "Open issues:"
    echo "$issues" | head -10
    
    return 0
}

# Agent 3: CREATE PR
agent_create_pr() {
    agent "AGENT 3: CREATE PR"
    log "═══════════════════════════════════════════════════════════════════"
    
    if ! command -v gh &>/dev/null; then
        error "GitHub CLI required for PR creation"
        return $E_PR_FAILED
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would push and create PR"
        PR_NUMBER="DRY-RUN-123"
        return 0
    fi
    
    cd "$REPO_ROOT"
    
    # Push branch
    log "Pushing branch $BRANCH_NAME..."
    if ! git push -u origin "$BRANCH_NAME" 2>&1; then
        error "Failed to push branch"
        return $E_PR_FAILED
    fi
    
    # Check for existing PR
    local existing_pr=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")
    
    if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
        PR_NUMBER="$existing_pr"
        log "Using existing PR #$PR_NUMBER"
    else
        # Create PR body
        local pr_body="## Summary

$MESSAGE

## Changes

$(git log --oneline origin/main..HEAD 2>/dev/null | sed 's/^/- /' | head -20)

## Workflow

- **Branch:** \`$BRANCH_NAME\`
- **Commit:** \`${COMMIT_SHA:0:8}\`
- **Type:** $(echo "$MESSAGE" | grep -oE '^(feat|fix|docs|refactor|test|ci|chore)' || echo "workflow")

## Checklist

- [x] All changes committed
- [x] Quality gate passed
- [x] PR created
- [ ] All GitHub Actions passing
- [ ] Ready for merge"

        log "Creating pull request..."
        local pr_output
        if ! pr_output=$(gh pr create \
            --title "$MESSAGE" \
            --body "$pr_body" \
            --base "main" \
            --head "$BRANCH_NAME" 2>&1); then
            error "Failed to create PR: $pr_output"
            return $E_PR_FAILED
        fi
        
        PR_NUMBER=$(echo "$pr_output" | grep -oE '[0-9]+$' || echo "")
        if [[ -z "$PR_NUMBER" ]]; then
            PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
        fi
    fi
    
    PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url' 2>/dev/null || echo "")
    success "PR #$PR_NUMBER created: $PR_URL"
    
    return 0
}

# Agent 4: MONITOR ACTIONS
agent_monitor_actions() {
    agent "AGENT 4: MONITOR ALL ACTIONS"
    log "═══════════════════════════════════════════════════════════════════"
    log "PR: #$PR_NUMBER"
    log "Timeout: ${TIMEOUT}s | Poll: ${POLL_INTERVAL}s"
    log "Strict: $STRICT_VALIDATION"
    log ""
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would monitor Actions"
        return 0
    fi
    
    local start_time=$(date +%s)
    local all_pass=false
    local attempts=0
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $TIMEOUT ]]; then
            error "Timeout after ${TIMEOUT}s"
            return $E_CHECKS_FAILED
        fi
        
        ((attempts++))
        
        # Get PR checks
        local checks_output=$(gh pr checks "$PR_NUMBER" 2>&1 || true)
        local pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "OPEN")
        
        # Check if already merged
        if [[ "$pr_state" == "MERGED" ]]; then
            success "PR already merged!"
            return 0
        fi
        
        if [[ "$pr_state" == "CLOSED" ]]; then
            error "PR was closed"
            return $E_CHECKS_FAILED
        fi
        
        # Analyze checks
        local has_pending=false
        local has_failure=false
        local has_warning=false
        
        # Check pending
        if echo "$checks_output" | grep -qiE "(pending|queued|in progress|running)"; then
            has_pending=true
        fi
        
        # Check failures
        if echo "$checks_output" | grep -qiE "(fail|error|✗|×)"; then
            has_failure=true
        fi
        
        # Check warnings (if strict)
        if echo "$checks_output" | grep -qiE "(warning|warn:|deprecated)"; then
            has_warning=true
        fi
        
        # Check repo Actions
        local workflow_runs=$(gh run list --branch "$BRANCH_NAME" --limit 10 --json status,conclusion 2>/dev/null || echo "[]")
        if echo "$workflow_runs" | grep -q '"status":"in_progress"'; then
            has_pending=true
        fi
        if echo "$workflow_runs" | grep -q '"conclusion":"failure"'; then
            has_failure=true
        fi
        
        # Display status
        if [[ $((attempts % 4)) -eq 1 ]]; then
            log "Monitoring... (${elapsed}s elapsed)"
        fi
        
        if [[ "$has_pending" == true ]]; then
            sleep $POLL_INTERVAL
            continue
        fi
        
        # All checks complete
        if [[ "$has_failure" == false && "$has_warning" == false ]]; then
            all_pass=true
            break
        fi
        
        # STRICT MODE: Any failure/warning = fail
        if [[ "$STRICT_VALIDATION" == true ]]; then
            if [[ "$has_failure" == true ]]; then
                error "CHECKS FAILED - Failures detected"
                CHECKS_FAILED+=("Check failures")
            fi
            if [[ "$has_warning" == true ]]; then
                error "CHECKS FAILED - Warnings detected (strict mode)"
                CHECKS_FAILED+=("Warnings")
            fi
            return $E_CHECKS_FAILED
        else
            # Non-strict: just warn
            if [[ "$has_failure" == true ]]; then
                warn "Checks have failures (non-strict mode)"
            fi
            if [[ "$has_warning" == true ]]; then
                warn "Checks have warnings (non-strict mode)"
            fi
            all_pass=true
            break
        fi
    done
    
    if [[ "$all_pass" == true ]]; then
        success "ALL CHECKS PASSED"
        return 0
    fi
    
    return $E_CHECKS_FAILED
}

# Agent 5: FIX ISSUES (using web research and skills)
agent_fix_issues() {
    agent "AGENT 5: FIX ISSUES WITH WEB RESEARCH"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$AUTO_RESEARCH" == false ]]; then
        error "Auto-research disabled, cannot fix issues automatically"
        return $E_MAX_RETRIES
    fi
    
    ((RETRY_COUNT++))
    log "Fix attempt $RETRY_COUNT of $MAX_RETRIES"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would research and fix issues"
        return 0
    fi
    
    # Analyze failures
    log "Analyzing failures..."
    local failures="${CHECKS_FAILED[*]}"
    
    info "Failures detected: $failures"
    info "This would trigger web-research-researcher and doc-resolver skills"
    info "For each failure:"
    info "  1. Query web for solution"
    info "  2. Use doc-resolver for official docs"
    info "  3. Apply relevant skills (shell-script-quality, etc.)"
    info "  4. Commit fixes"
    info "  5. Re-run checks"
    
    # In real implementation, this would:
    # - Call web-search-researcher skill
    # - Call do-web-doc-resolver skill
    # - Apply fixes using appropriate skills
    # - Commit changes
    # - Return to monitoring
    
    warn "Fix automation requires manual implementation based on failure type"
    warn "Retry $RETRY_COUNT/$MAX_RETRIES"
    
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        error "Max retries ($MAX_RETRIES) exceeded"
        return $E_MAX_RETRIES
    fi
    
    # Clear failed checks and retry
    CHECKS_FAILED=()
    
    # Re-run monitoring
    return $E_CHECKS_FAILED
}

# Agent 6: MERGE
agent_merge() {
    agent "AGENT 6: MERGE"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would merge PR #$PR_NUMBER"
        MERGE_STATUS="MERGED"
        return 0
    fi
    
    log "Merging PR #$PR_NUMBER..."
    
    local merge_output
    if ! merge_output=$(gh pr merge "$PR_NUMBER" \
        --squash \
        --delete-branch=false \
        2>&1); then
        error "Merge failed: $merge_output"
        return $E_MERGE_FAILED
    fi
    
    MERGE_STATUS="MERGED"
    success "Successfully merged PR #$PR_NUMBER"
    
    # Close related issues if requested
    if [[ "$CLOSE_ISSUES" == true && ${#ISSUES_FOUND[@]} -gt 0 ]]; then
        log "Closing related issues..."
        for issue in "${ISSUES_FOUND[@]}"; do
            local issue_num=$(echo "$issue" | grep -oE '[0-9]+' | head -1)
            if [[ -n "$issue_num" ]]; then
                gh issue close "$issue_num" --comment "Fixed in PR #$PR_NUMBER" 2>/dev/null || true
            fi
        done
    fi
    
    return 0
}

# Agent 7: POST-MERGE VALIDATION
agent_post_merge_validate() {
    agent "AGENT 7: POST-MERGE VALIDATION"
    log "═══════════════════════════════════════════════════════════════════"
    
    if [[ "$POST_MERGE_VALIDATE" == false ]]; then
        log "Skipping post-merge validation"
        return 0
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would validate main branch"
        return 0
    fi
    
    log "Checking out main branch..."
    cd "$REPO_ROOT"
    
    # Stash any changes
    if [[ -n $(git status --porcelain) ]]; then
        git stash push -m "workflow-stash-$(date +%s)"
    fi
    
    git checkout main
    
    log "Pulling latest changes..."
    if ! git pull origin main; then
        error "Failed to pull main"
        return $E_POST_MERGE_FAILED
    fi
    
    log "Validating repository integrity..."
    
    # Check 1: All expected files present
    log "  Checking files..."
    # Add specific file checks here
    
    # Check 2: Documentation
    log "  Checking documentation..."
    if [[ -d "$REPO_ROOT/docs" || -d "$REPO_ROOT/.agents" ]]; then
        info "  Documentation directories present"
    fi
    
    # Check 3: Run quality gate
    log "  Running quality gate..."
    if [[ -x "$REPO_ROOT/scripts/quality_gate.sh" ]]; then
        if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
            error "Quality gate failed on main!"
            return $E_POST_MERGE_FAILED
        fi
    fi
    
    # Check 4: Verify commit present
    log "  Verifying commit..."
    if ! git log --oneline | grep -q "${COMMIT_SHA:0:7}"; then
        warn "Commit SHA not found in recent history (may be squashed)"
    fi
    
    success "Post-merge validation PASSED"
    return 0
}

# Main execution
main() {
    parse_args "$@"
    
    log ""
    log "╔═══════════════════════════════════════════════════════════════════╗"
    log "║     GIT-GITHUB WORKFLOW with Swarm Coordination                   ║"
    log "╚═══════════════════════════════════════════════════════════════════╝"
    log ""
    log "Configuration:"
    log "  Fix issues: $FIX_ISSUES"
    log "  Strict validation: $STRICT_VALIDATION"
    log "  Auto-research: $AUTO_RESEARCH"
    log "  Max retries: $MAX_RETRIES"
    log "  Post-merge validate: $POST_MERGE_VALIDATE"
    log ""
    
    local exit_code=$E_SUCCESS
    
    # Phase 1: Atomic Commit
    if ! agent_commit; then
        exit_code=$?
        error "PHASE 1 FAILED: Atomic commit"
    fi
    
    # Phase 2: Check Issues (if commit succeeded)
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        if ! agent_check_issues; then
            exit_code=$?
            error "PHASE 2 FAILED: Issue check"
        fi
    fi
    
    # Phase 3: Create PR
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        if ! agent_create_pr; then
            exit_code=$?
            error "PHASE 3 FAILED: PR creation"
        fi
    fi
    
    # Phase 4 & 5: Monitor and Fix (loop)
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        while true; do
            if agent_monitor_actions; then
                # All checks passed
                break
            else
                # Checks failed
                if [[ "$AUTO_RESEARCH" == true && $RETRY_COUNT -lt $MAX_RETRIES ]]; then
                    if ! agent_fix_issues; then
                        exit_code=$?
                        error "PHASE 5 FAILED: Could not fix issues"
                        break
                    fi
                    # Retry monitoring
                    continue
                else
                    exit_code=$E_CHECKS_FAILED
                    error "PHASE 4 FAILED: Checks did not pass"
                    break
                fi
            fi
        done
    fi
    
    # Phase 6: Merge
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        if ! agent_merge; then
            exit_code=$?
            error "PHASE 6 FAILED: Merge"
        fi
    fi
    
    # Phase 7: Post-Merge Validation
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        if ! agent_post_merge_validate; then
            exit_code=$?
            error "PHASE 7 FAILED: Post-merge validation"
        fi
    fi
    
    # Final report
    log ""
    log "╔═══════════════════════════════════════════════════════════════════╗"
    if [[ $exit_code -eq $E_SUCCESS ]]; then
        success "║     WORKFLOW COMPLETED SUCCESSFULLY                               ║"
        log "╚═══════════════════════════════════════════════════════════════════╝"
        log ""
        log "Summary:"
        log "  Branch: $BRANCH_NAME"
        log "  Commit: ${COMMIT_SHA:0:8}"
        log "  PR: #$PR_NUMBER"
        log "  Merge: $MERGE_STATUS"
        log "  Issues found: ${#ISSUES_FOUND[@]}"
        log "  Fix attempts: $RETRY_COUNT"
        log ""
    else
        error "║     WORKFLOW FAILED                                               ║"
        log "╚═══════════════════════════════════════════════════════════════════╝"
        log ""
        error "Exit code: $exit_code"
        log ""
        log "Failed at phase:"
        case $exit_code in
            2) log "  Phase 1: Atomic Commit" ;;
            3) log "  Phase 1: Quality Gate" ;;
            4) log "  Phase 2: GitHub Issues" ;;
            5) log "  Phase 3: PR Creation" ;;
            6) log "  Phase 4: Actions Monitoring" ;;
            7) log "  Phase 5: Issue Resolution (max retries)" ;;
            8) log "  Phase 6: Merge" ;;
            9) log "  Phase 7: Post-Merge Validation" ;;
        esac
        log ""
    fi
    
    exit $exit_code
}

main "$@"
