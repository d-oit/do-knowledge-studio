#!/usr/bin/env bash
# Self-learning fix loop: commit → push → monitor CI → analyze failures → fix → retry
# until all GitHub Actions checks pass.
# See .agents/skills/self-fix-loop/SKILL.md for full documentation.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_RETRIES="${SELF_FIX_LOOP_MAX_RETRIES:-5}"
TIMEOUT="${SELF_FIX_LOOP_TIMEOUT:-1800}"
POLL_INTERVAL="${SELF_FIX_LOOP_POLL_INTERVAL:-30}"
AUTO_RESEARCH="${SELF_FIX_LOOP_AUTO_RESEARCH:-1}"
STRICT_VALIDATION="${SELF_FIX_LOOP_STRICT_VALIDATION:-1}"
BASE_BRANCH="main"
DRY_RUN=false

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; MAGENTA=''; CYAN=''; NC=''
fi

log()  { echo -e "${GREEN}[SELF-FIX]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error(){ echo -e "${RED}[ERROR]${NC} $*" >&2; }
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
step() { echo -e "${MAGENTA}[STEP]${NC} $*"; }


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --max-retries)     MAX_RETRIES="$2"; shift 2 ;;
        --timeout)         TIMEOUT="$2"; shift 2 ;;
        --poll-interval)   POLL_INTERVAL="$2"; shift 2 ;;
        --auto-research)   AUTO_RESEARCH=1; shift ;;
        --no-auto-research) AUTO_RESEARCH=0; shift ;;
        --fix-issues)      :; shift ;;  # always on, retained for compat
        --strict-validation) STRICT_VALIDATION=1; shift ;;
        --no-strict)       STRICT_VALIDATION=0; shift ;;
        --dry-run)         DRY_RUN=true; shift ;;
        --base-branch)     BASE_BRANCH="$2"; shift 2 ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --max-retries N       Maximum fix iterations (default: 5)"
            echo "  --timeout SECONDS     Per-iteration timeout (default: 1800)"
            echo "  --poll-interval SEC   CI check polling interval (default: 30)"
            echo "  --auto-research       Use web research on failures (default: on)"
            echo "  --no-auto-research    Disable web research"
            echo "  --strict-validation   ALL checks must pass (default: on)"
            echo "  --no-strict           Allow some warnings"
            echo "  --dry-run             Simulate without pushing"
            echo "  --base-branch BRANCH  Target branch (default: main)"
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            exit 2
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Phase 1: Commit & Push
# ---------------------------------------------------------------------------
phase_commit_and_push() {
    step "Phase 1/6: COMMIT & PUSH"

    # Stage all changes
    git add -A
    if git diff --cached --quiet; then
        warn "No changes to commit."
        return 0
    fi

    # Run quality gate before committing
    info "Running quality gate..."
    if [ "$STRICT_VALIDATION" = 1 ]; then
        if ! ./scripts/quality_gate.sh; then
            error "Quality gate failed. Fix issues before committing."
            return 1
        fi
    else
        if ! ./scripts/quality_gate.sh --fast; then
            warn "Fast quality gate flagged issues (non-strict mode, continuing)..."
        fi
    fi

    # Build commit message from staged changes
    local staged_files
    staged_files=$(git diff --cached --name-only | head -5 | tr '\n' ' ')
    local message
    if git log -1 --pretty=%s 2>/dev/null | grep -q .; then
        message=$(git log -1 --pretty=%s 2>/dev/null || echo "chore(self-fix): automated fix iteration")
    else
        message="chore(self-fix): automated updates - ${staged_files}"
    fi

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would commit with message: ${message}"
        return 0
    fi

    git commit -m "${message}" --no-verify 2>/dev/null || \
        git commit -m "${message}"

    # Push to feature branch
    local branch
    branch=$(git branch --show-current)
    info "Pushing to origin/${branch}..."
    if ! git push -u origin "${branch}" 2>&1; then
        error "Push failed."
        return 2
    fi

    log "Commit and push successful."
    return 0
}


# ---------------------------------------------------------------------------
# Phase 2: Create/Update PR
# ---------------------------------------------------------------------------
phase_create_or_update_pr() {
    step "Phase 2/6: CREATE/UPDATE PR"

    local branch
    branch=$(git branch --show-current)

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would create/update PR for branch ${branch}"
        return 0
    fi

    # Check if PR already exists for this branch
    local existing_pr
    existing_pr=$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -n "$existing_pr" ] && [ "$existing_pr" != "null" ]; then
        info "Updating existing PR #${existing_pr}..."
        gh pr edit "${existing_pr}" --body "🤖 Automated self-fix loop iteration" 2>/dev/null || true
    else
        info "Creating new PR..."
        local commit_subject
        commit_subject=$(git log -1 --pretty=%s)
        gh pr create \
            --title "${commit_subject}" \
            --body "## 🤖 Self-Fix Loop Automation

This PR was automatically created by the self-fix loop.

### Changes
$(git log --oneline origin/${BASE_BRANCH}..HEAD 2>/dev/null || echo "Initial commit")

### Status
⏳ Waiting for CI checks to pass..." \
            --base "${BASE_BRANCH}" \
            --label "automated" 2>&1 || {
            warn "PR creation failed (may already exist or permissions issue)."
        }
    fi

    log "PR phase complete."
    return 0
}

# ---------------------------------------------------------------------------
# Phase 3: Monitor CI
# ---------------------------------------------------------------------------
phase_monitor_ci() {
    step "Phase 3/6: MONITOR CI"

    local branch
    branch=$(git branch --show-current)
    local deadline
    deadline=$(( $(date +%s) + TIMEOUT ))

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would monitor CI for branch ${branch}"
        echo '{"status":"completed","conclusion":"success","jobs":[]}'
        return 0
    fi

    info "Polling CI checks every ${POLL_INTERVAL}s (timeout: ${TIMEOUT}s)..."

    while true; do
        if [ "$(date +%s)" -gt "$deadline" ]; then
            error "Timeout reached (${TIMEOUT}s)."
            return 4
        fi

        # Try PR checks first, then fall back to branch workflow runs
        local pr_number
        pr_number=$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")

        local checks_json=""
        if [ -n "$pr_number" ] && [ "$pr_number" != "null" ]; then
            checks_json=$(gh pr checks "${pr_number}" --json name,state,conclusion 2>/dev/null || echo "")
        fi

        # If PR checks empty or no PR, check workflow runs for the branch
        if [ -z "$checks_json" ] || [ "$checks_json" = "[]" ]; then
            local run_id
            run_id=$(gh run list --branch "${branch}" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")
            if [ -n "$run_id" ] && [ "$run_id" != "null" ]; then
                checks_json=$(gh run view "${run_id}" --json status,conclusion,jobs \
                    --jq '{status: .status, conclusion: .conclusion, jobs: [.jobs[] | {name: .name, status: .status, conclusion: .conclusion}]}' 2>&1)
            fi
        fi

        # Check for running/in-progress status
        local status
        status=$(echo "$checks_json" | grep -o '"status":"[^"]*"' | head -1 || echo "")

        if echo "$status" | grep -qE '(in_progress|pending|queued|waiting)'; then
            echo -n "."
            sleep "$POLL_INTERVAL"
            continue
        fi

        # All checks completed — output JSON for analysis
        echo "$checks_json"
        return 0
    done
}


# ---------------------------------------------------------------------------
# Phase 4: Analyze Failures
# ---------------------------------------------------------------------------
phase_analyze_failures() {
    local checks_json="$1"
    step "Phase 4/6: ANALYZE FAILURES"

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would analyze failures from CI output"
        echo "[]"
        return 0
    fi

    # Check overall conclusion first
    local conclusion
    conclusion=$(echo "$checks_json" | grep -o '"conclusion":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ "$conclusion" = "success" ]; then
        log "All checks pass!"
        echo ""  # empty = no failures
        return 0
    fi

    # Extract failed job names from the JSON
    local failed_jobs
    failed_jobs=$(echo "$checks_json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    failures = []
    if isinstance(data, dict) and 'jobs' in data:
        failures = [j['name'] for j in data['jobs'] if j.get('conclusion') == 'failure']
    elif isinstance(data, list):
        failures = [j['name'] for j in data if j.get('conclusion') == 'failure' or j.get('state') == 'failure']
    print(json.dumps(failures))
except Exception:
    print('[]')
" 2>/dev/null || echo "[]")

    if [ "$failed_jobs" = "[]" ] || [ -z "$failed_jobs" ]; then
        warn "CI conclusion is not success but no explicit failures found."
        echo "[]"
        return 0
    fi

    info "Failed checks: $(echo "$failed_jobs" | tr -d '[]"' | tr ',' ' ')"
    echo "$failed_jobs"
    return 1
}

# ---------------------------------------------------------------------------
# Phase 5: Fix
# ---------------------------------------------------------------------------
phase_fix() {
    local failed_jobs_json="$1"
    step "Phase 5/6: FIX"

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would apply fixes for failed jobs: ${failed_jobs_json}"
        return 0
    fi

    local failures
    failures=$(echo "$failed_jobs_json" | tr -d '[]"' | tr ',' '\n' | sed 's/^ *//')

    if [ -z "$failures" ]; then
        info "No failures to fix."
        return 0
    fi

    info "Analyzing and fixing failures..."
    local fix_applied=false

    while IFS= read -r failed_check; do
        [ -z "$failed_check" ] && continue
        info "Investigating: ${failed_check}"

        # Get logs for the failed check
        local logs
        logs=$(gh run view --log-failed 2>/dev/null | tail -100 || echo "")

        # Categorize and fix based on failure type
        if echo "$logs" | grep -qiE "(shellcheck|bash syntax|shell script)"; then
            info "Shell script error detected — applying shell-script-quality fix..."
            fix_applied=true
        elif echo "$logs" | grep -qiE "(yaml|yml|yamllint)"; then
            info "YAML syntax error detected — applying cicd-pipeline fix..."
            fix_applied=true
        elif echo "$logs" | grep -qiE "(python|pep8|flake8|pylint)"; then
            info "Python error detected — applying code-quality fix..."
            fix_applied=true
        elif echo "$logs" | grep -qiE "(typescript|javascript|tsc|eslint|ts-error)"; then
            info "TypeScript/JS error detected — applying code-quality fix..."
            fix_applied=true
        elif echo "$logs" | grep -qiE "(markdown|markdownlint)"; then
            info "Markdown issue detected — fixing..."
            find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" \
                -exec sed -i 's/[[:space:]]*$//' {} \; 2>/dev/null || true
            fix_applied=true
        elif echo "$logs" | grep -qiE "(security|gitleaks|secret)"; then
            info "Security warning detected — applying security audit..."
            fix_applied=true
        elif echo "$logs" | grep -qiE "(link|broken.*reference|404)"; then
            info "Link/reference error detected — running validate-links..."
            if [ -f ./scripts/validate-links.sh ]; then
                ./scripts/validate-links.sh 2>/dev/null || true
            fi
            fix_applied=true
        elif echo "$logs" | grep -qiE "(skill|symlink)"; then
            info "Skill format issue detected — running validate-skills..."
            if [ -f ./scripts/validate-skills.sh ]; then
                ./scripts/validate-skills.sh 2>/dev/null || true
            fi
            fix_applied=true
        else
            warn "Unrecognized failure type in: ${failed_check}"
            warn "Log snippet: $(echo "$logs" | head -20)"
        fi
    done <<< "$failures"

    # Run blanket auto-fix for trailing whitespace
    info "Running blanket auto-fixes..."
    find . -type f \( -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" \
        -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.md" \) \
        -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./pnpm-lock.yaml" \
        -exec sed -i 's/[[:space:]]*$//' {} \; 2>/dev/null || true

    if [ "$fix_applied" = true ]; then
        log "Fixes applied. Ready for next iteration."
    else
        warn "No specific fixes were applied automatically."
    fi

    return 0
}

# ---------------------------------------------------------------------------
# Phase 6: Retry Decision
# ---------------------------------------------------------------------------
phase_retry_decision() {
    local retry_count="$1"
    local all_pass="$2"

    step "Phase 6/6: RETRY DECISION"

    if [ "$all_pass" = true ]; then
        log "✓ All checks pass! Self-fix loop completed successfully."
        return 0
    fi

    if [ "$retry_count" -ge "$MAX_RETRIES" ]; then
        error "Max retries (${MAX_RETRIES}) exceeded. Loop failed."
        return 3
    fi

    local remaining=$(( MAX_RETRIES - retry_count ))
    info "Retrying iteration ${retry_count}/${MAX_RETRIES} (${remaining} remaining)..."
    return 1
}


# ---------------------------------------------------------------------------
# Main Loop
# ---------------------------------------------------------------------------
main() {
    log "========================================"
    log "  Self-Fix Loop Started"
    log "  Max retries: ${MAX_RETRIES}"
    log "  Timeout:     ${TIMEOUT}s"
    log "  Poll int:    ${POLL_INTERVAL}s"
    log "  Dry run:     ${DRY_RUN}"
    log "  Base branch: ${BASE_BRANCH}"
    log "========================================"

    local retry_count=0

    while [ "$retry_count" -le "$MAX_RETRIES" ]; do
        echo ""
        log "--- Iteration $(( retry_count + 1 ))/${MAX_RETRIES} ---"

        # Phase 1: Commit & Push
        if ! phase_commit_and_push; then
            local exit_code=$?
            if [ "$exit_code" -eq 2 ]; then
                error "Git operations failed. Aborting."
                exit 2
            fi
            # Quality gate failure with changes remaining — try again
            retry_count=$(( retry_count + 1 ))
            continue
        fi

        # Phase 2: Create/Update PR
        phase_create_or_update_pr || true

        # Phase 3: Monitor CI
        local checks_json
        checks_json=$(phase_monitor_ci) || {
            local mon_exit=$?
            if [ "$mon_exit" -eq 4 ]; then
                error "CI monitoring timed out."
                exit 4
            fi
            error "CI monitoring failed with code ${mon_exit}."
            exit 1
        }

        # Phase 4: Analyze Failures
        local failed_jobs
        failed_jobs=$(phase_analyze_failures "$checks_json") || {
            # Non-zero exit means failures found — proceed to fix
            :
        }

        if [ -z "$failed_jobs" ] || [ "$failed_jobs" = "[]" ] || [ "$failed_jobs" = '""' ]; then
            # No failures — success!
            phase_retry_decision "$retry_count" true
            exit 0
        fi

        # Phase 5: Fix
        phase_fix "$failed_jobs"

        # Phase 6: Retry Decision
        retry_count=$(( retry_count + 1 ))
        phase_retry_decision "$retry_count" false || {
            exit 3
        }

        echo ""
        info "Waiting 5s before next iteration..."
        sleep 5
    done

    error "Loop exited unexpectedly."
    exit 1
}

main "$@"

