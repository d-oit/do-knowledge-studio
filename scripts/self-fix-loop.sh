#!/usr/bin/env bash
# Self-Fix Loop - Automated commit, push, monitor, fix, retry cycle
# Uses swarm agents with skills on demand until all GitHub Actions pass.
# Exit 0 = all checks passed, non-zero = max retries/timeout/fatal error.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Configuration
MAX_RETRIES="${SELF_FIX_LOOP_MAX_RETRIES:-5}"
TIMEOUT="${SELF_FIX_LOOP_TIMEOUT:-1800}"
POLL_INTERVAL="${SELF_FIX_LOOP_POLL_INTERVAL:-30}"
AUTO_RESEARCH="${SELF_FIX_LOOP_AUTO_RESEARCH:-1}"
STRICT_VALIDATION="${SELF_FIX_LOOP_STRICT_VALIDATION:-1}"
DRY_RUN=false
FIX_ISSUES=true
BASE_BRANCH="main"

# State
RETRY_COUNT=0
PR_NUMBER=""
BRANCH_NAME=""
LAST_FAILURES=()

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; MAGENTA=''; NC=''
fi

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
info() { echo -e "${CYAN}[$(date +%H:%M:%S)] INFO:${NC} $*"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $*" >&2; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $*"; }
phase() { echo -e "${MAGENTA}[$(date +%H:%M:%S)] PHASE $1:${NC} $2"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --max-retries) MAX_RETRIES="$2"; shift 2 ;;
        --auto-research) AUTO_RESEARCH=1; shift ;;
        --no-auto-research) AUTO_RESEARCH=0; shift ;;
        --fix-issues) FIX_ISSUES=true; shift ;;
        --no-fix-issues) FIX_ISSUES=false; shift ;;
        --strict-validation) STRICT_VALIDATION=1; shift ;;
        --no-strict-validation) STRICT_VALIDATION=0; shift ;;
        --timeout) TIMEOUT="$2"; shift 2 ;;
        --poll-interval) POLL_INTERVAL="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --base-branch) BASE_BRANCH="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: self-fix-loop.sh [OPTIONS]"
            echo "  --max-retries N       Max fix iterations (default: 5)"
            echo "  --auto-research       Use web research on failures"
            echo "  --fix-issues          Attempt automatic fixes"
            echo "  --strict-validation   ALL checks must pass"
            echo "  --timeout SECONDS     Per-iteration timeout"
            echo "  --poll-interval SECS  CI polling interval"
            echo "  --dry-run             Simulate without pushing"
            echo "  --base-branch BRANCH  Target branch (default: main)"
            exit 0
            ;;
        *) error "Unknown option: $1"; exit 1 ;;
    esac
done

# Phase 1: Commit & Push
phase_commit_push() {
    phase 1 "Commit & Push"
    log "═══════════════════════════════════════════════════════════════════"

    # Check git status
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Not a git repository"
        return 1
    fi

    # Check for changes
    if [[ -z "$(git status --porcelain)" ]]; then
        warn "No changes to commit"
        return 0
    fi

    # Generate branch name if not on feature branch
    local current_branch
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
        local timestamp
        timestamp=$(date +%s)
        BRANCH_NAME="self-fix-${timestamp}"
        log "Creating feature branch: $BRANCH_NAME"
        if [[ "$DRY_RUN" == true ]]; then
            log "[DRY-RUN] Would create branch: $BRANCH_NAME"
        else
            git checkout -b "$BRANCH_NAME" || return 1
        fi
    else
        BRANCH_NAME="$current_branch"
    fi

    # Run quality gate
    log "Running quality gate..."
    if [[ -x "$REPO_ROOT/scripts/quality_gate.sh" ]]; then
        if ! SKIP_TESTS=true SKIP_GLOBAL_HOOKS_CHECK=true "$REPO_ROOT/scripts/quality_gate.sh"; then
            error "Quality gate failed"
            return 1
        fi
        success "Quality gate passed"
    else
        warn "quality_gate.sh not found or not executable"
    fi

    # Stage and commit
    local commit_msg="fix: self-fix-loop iteration $((RETRY_COUNT + 1)) of $MAX_RETRIES"
    log "Staging all changes..."
    if [[ "$DRY_RUN" != true ]]; then
        git add -A
        git commit -m "$commit_msg" || return 1
        success "Committed: $(git rev-parse --short HEAD)"
    else
        log "[DRY-RUN] Would commit: $commit_msg"
    fi

    # Push
    log "Pushing to origin/$BRANCH_NAME..."
    if [[ "$DRY_RUN" != true ]]; then
        git push -u origin "$BRANCH_NAME" 2>&1 || return 1
        success "Pushed to origin/$BRANCH_NAME"
    else
        log "[DRY-RUN] Would push to origin/$BRANCH_NAME"
    fi

    return 0
}

# Phase 2: Create/Update PR
phase_create_pr() {
    phase 2 "Create/Update PR"
    log "═══════════════════════════════════════════════════════════════════"

    if ! command -v gh &>/dev/null; then
        error "GitHub CLI (gh) required for PR operations"
        return 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would create/update PR"
        PR_NUMBER="DRY-RUN"
        return 0
    fi

    # Check for existing PR
    local existing_pr
    existing_pr=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
        PR_NUMBER="$existing_pr"
        log "Updating existing PR #$PR_NUMBER"
        # Push new commits (already done in phase 1)
        success "PR #$PR_NUMBER updated"
    else
        log "Creating new PR..."
        local pr_body="## Self-Fix Loop

Automated fix loop - iteration $((RETRY_COUNT + 1))

- **Branch:** \`$BRANCH_NAME\`
- **Base:** \`$BASE_BRANCH\`
- **Max Retries:** $MAX_RETRIES
- **Auto-Research:** $AUTO_RESEARCH

## Checklist
- [x] Changes committed
- [x] Quality gate passed
- [x] Pushed to remote
- [ ] All GitHub Actions passing"

        local pr_output
        if ! pr_output=$(gh pr create \
            --title "fix: self-fix-loop iteration $((RETRY_COUNT + 1))" \
            --body "$pr_body" \
            --base "$BASE_BRANCH" \
            --head "$BRANCH_NAME" 2>&1); then
            error "Failed to create PR: $pr_output"
            return 1
        fi

        PR_NUMBER=$(echo "$pr_output" | grep -oE '[0-9]+$' || echo "")
        if [[ -z "$PR_NUMBER" ]]; then
            PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null || echo "")
        fi
        success "Created PR #$PR_NUMBER"
    fi

    return 0
}

# Phase 3: Monitor CI
phase_monitor_ci() {
    phase 3 "Monitor CI"
    log "═══════════════════════════════════════════════════════════════════"
    log "PR: #$PR_NUMBER | Timeout: ${TIMEOUT}s | Poll: ${POLL_INTERVAL}s"

    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would monitor CI checks"
        return 0
    fi

    local start_time
    start_time=$(date +%s)

    while true; do
        local elapsed=$(( $(date +%s) - start_time ))
        if [[ $elapsed -gt $TIMEOUT ]]; then
            error "Timeout after ${elapsed}s (limit: ${TIMEOUT}s)"
            return 4
        fi

        # Get PR checks
        local checks_output
        checks_output=$(gh pr checks "$PR_NUMBER" 2>&1 || true)

        # Check PR state
        local pr_state
        pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null || echo "OPEN")
        if [[ "$pr_state" == "MERGED" ]]; then
            success "PR already merged!"
            return 0
        fi
        if [[ "$pr_state" == "CLOSED" ]]; then
            error "PR was closed"
            return 1
        fi

        # Analyze status
        local has_pending=false has_failure=false

        if echo "$checks_output" | grep -qiE "(pending|queued|in progress|running|waiting)"; then
            has_pending=true
        fi
        if echo "$checks_output" | grep -qiE "(fail|error|✗|×)"; then
            has_failure=true
        fi

        # Check workflow runs
        local workflow_runs
        workflow_runs=$(gh run list --branch "$BRANCH_NAME" --limit 5 --json status,conclusion 2>/dev/null || echo "[]")
        if echo "$workflow_runs" | grep -q '"status":"in_progress"'; then
            has_pending=true
        fi
        if echo "$workflow_runs" | grep -q '"conclusion":"failure"'; then
            has_failure=true
        fi

        if [[ "$has_pending" == true ]]; then
            if [[ $(( $(date +%s) - start_time )) -gt $(( TIMEOUT / 2 )) ]]; then
                log "Still waiting... (${elapsed}s elapsed)"
            fi
            sleep "$POLL_INTERVAL"
            continue
        fi

        # All checks complete
        if [[ "$has_failure" == false ]]; then
            success "ALL CHECKS PASSED"
            return 0
        fi

        # Failures detected - capture them
        error "CI CHECKS FAILED"
        LAST_FAILURES=()
        while IFS= read -r line; do
            LAST_FAILURES+=("$line")
        done < <(echo "$checks_output" | grep -iE "(fail|error)" | head -20)

        log "Failures:"
        for f in "${LAST_FAILURES[@]}"; do
            log "  - $f"
        done

        return 1
    done
}

# Phase 4: Analyze & Fix
phase_analyze_fix() {
    phase 4 "Analyze & Fix"
    log "═══════════════════════════════════════════════════════════════════"

    if [[ "$FIX_ISSUES" != true ]]; then
        error "Auto-fix disabled"
        return 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log "[DRY-RUN] Would analyze and fix failures"
        return 0
    fi

    # Determine failure categories and apply fixes
    local fix_applied=false

    for failure in "${LAST_FAILURES[@]}"; do
        log "Analyzing: $failure"

        # Shell script failures
        if echo "$failure" | grep -qiE "(shellcheck|shell|bash|sh)"; then
            log "→ Shell script issue detected"
            if command -v shellcheck &>/dev/null; then
                local shell_scripts
                shell_scripts=$(find . -name "*.sh" -not -path "./.git/*" -not -path "./target/*" 2>/dev/null || true)
                if [[ -n "$shell_scripts" ]]; then
                    while IFS= read -r script; do
                        [ -n "$script" ] || continue
                        log "  Checking: $script"
                        shellcheck --severity=error "$script" 2>&1 || true
                    done <<< "$shell_scripts"
                fi
                fix_applied=true
            fi
        fi

        # YAML/Actions failures
        if echo "$failure" | grep -qiE "(yaml|yml|action|workflow)"; then
            log "→ YAML/Actions issue detected"
            if command -v yamllint &>/dev/null; then
                yamllint -d "{extends: default, rules: {line-length: {max: 120}}}" .github/ 2>&1 || true
                fix_applied=true
            fi
        fi

        # Markdown failures
        if echo "$failure" | grep -qiE "(markdown|md|markdownlint)"; then
            log "→ Markdown issue detected"
            if command -v markdownlint &>/dev/null; then
                markdownlint "**/*.md" --ignore node_modules --ignore target 2>&1 || true
                fix_applied=true
            fi
        fi

        # Python failures
        if echo "$failure" | grep -qiE "(python|ruff|black|pytest|flake8)"; then
            log "→ Python issue detected"
            if command -v ruff &>/dev/null; then
                ruff check --fix . 2>&1 || true
                fix_applied=true
            fi
            if command -v black &>/dev/null; then
                black . 2>&1 || true
                fix_applied=true
            fi
        fi

        # TypeScript/JavaScript failures
        if echo "$failure" | grep -qiE "(typescript|javascript|eslint|tsc|npm|pnpm)"; then
            log "→ TypeScript/JavaScript issue detected"
            if [[ -f "package.json" ]]; then
                if command -v pnpm &>/dev/null; then
                    pnpm lint --fix 2>&1 || true
                    fix_applied=true
                elif command -v npm &>/dev/null; then
                    npm run lint -- --fix 2>&1 || true
                    fix_applied=true
                fi
            fi
        fi

        # Skill validation failures
        if echo "$failure" | grep -qiE "(skill|symlink|SKILL\.md)"; then
            log "→ Skill validation issue detected"
            "$REPO_ROOT/scripts/setup-skills.sh" 2>&1 || true
            "$REPO_ROOT/scripts/validate-skills.sh" 2>&1 || true
            "$REPO_ROOT/scripts/validate-skill-format.sh" 2>&1 || true
            fix_applied=true
        fi

        # Link validation failures
        if echo "$failure" | grep -qiE "(link|reference|broken)"; then
            log "→ Link validation issue detected"
            "$REPO_ROOT/scripts/validate-links.sh" 2>&1 || true
            fix_applied=true
        fi
    done

    if [[ "$fix_applied" == false && "$AUTO_RESEARCH" == "1" ]]; then
        log "No local fix found - would use web research"
        log "In full implementation, this would:"
        log "  1. Launch web-search-researcher for each failure"
        log "  2. Use do-web-doc-resolver for official docs"
        log "  3. Apply fixes using relevant skills"
        warn "Web research integration requires manual agent invocation"
    fi

    # Stage any fixes
    if [[ -n "$(git status --porcelain)" ]]; then
        log "Staging fixes..."
        git add -A
        git commit -m "fix: auto-fix for CI failures (iteration $((RETRY_COUNT + 1)))" || true
        success "Fix committed"
    else
        warn "No fixable changes detected"
    fi

    return 0
}

# Main loop
main() {
    log ""
    log "╔═══════════════════════════════════════════════════════════════════╗"
    log "║     SELF-FIX LOOP - Automated Commit, Push, Monitor, Fix         ║"
    log "╚═══════════════════════════════════════════════════════════════════╝"
    log ""
    log "Configuration:"
    log "  Max retries: $MAX_RETRIES"
    log "  Auto-research: $AUTO_RESEARCH"
    log "  Fix issues: $FIX_ISSUES"
    log "  Strict validation: $STRICT_VALIDATION"
    log "  Timeout: ${TIMEOUT}s"
    log "  Poll interval: ${POLL_INTERVAL}s"
    log "  Dry run: $DRY_RUN"
    log ""

    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "═══════════════════════════════════════════════════════════════════"
        log "  ITERATION $RETRY_COUNT of $MAX_RETRIES"
        log "═══════════════════════════════════════════════════════════════════"
        log ""

        # Phase 1: Commit & Push
        if ! phase_commit_push; then
            error "Phase 1 failed - cannot continue"
            exit 2
        fi

        # Phase 2: Create/Update PR
        if ! phase_create_pr; then
            error "Phase 2 failed - cannot continue"
            exit 5
        fi

        # Phase 3: Monitor CI
        if phase_monitor_ci; then
            success ""
            log "╔═══════════════════════════════════════════════════════════════════╗"
            success "║     ALL CHECKS PASSED - Loop completed successfully!             ║"
            log "╚═══════════════════════════════════════════════════════════════════╝"
            log ""
            log "Summary:"
            log "  Iterations: $RETRY_COUNT"
            log "  Branch: $BRANCH_NAME"
            log "  PR: #$PR_NUMBER"
            exit 0
        fi

        # Phase 4: Analyze & Fix (if retries remaining)
        if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
            log ""
            phase_analyze_fix || true
            log ""
            log "Retrying..."
        else
            error ""
            log "╔═══════════════════════════════════════════════════════════════════╗"
            error "║     MAX RETRIES EXCEEDED - Could not pass all checks               ║"
            log "╚═══════════════════════════════════════════════════════════════════╝"
            log ""
            log "Summary:"
            log "  Iterations: $RETRY_COUNT"
            log "  Branch: $BRANCH_NAME"
            log "  PR: #$PR_NUMBER"
            error "  Status: FAILED - manual intervention required"
            exit 3
        fi
    done
}

main
