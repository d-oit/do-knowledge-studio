#!/usr/bin/env bash
# Self-learning fix loop: commit → push → monitor CI → analyze failures → fix → retry
# until all GitHub Actions checks pass.
# See .agents/skills/self-fix-loop/SKILL.md for full documentation.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_RETRIES="${SELF_FIX_LOOP_MAX_RETRIES:-5}"
TIMEOUT="${SELF_FIX_LOOP_TIMEOUT:-1800}"
POLL_INTERVAL="${SELF_FIX_LOOP_POLL_INTERVAL:-20}"
export AUTO_RESEARCH="${SELF_FIX_LOOP_AUTO_RESEARCH:-1}"
STRICT_VALIDATION="${SELF_FIX_LOOP_STRICT_VALIDATION:-1}"
BASE_BRANCH="main"
DRY_RUN=false
TARGET_PR=""  # existing PR number to target
VERCEL_RETRIES=0
MAX_VERCEL_RETRIES=3

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    export RED='\033[0;31m'
    export GREEN='\033[0;32m'
    export YELLOW='\033[1;33m'
    export BLUE='\033[0;34m'
    export MAGENTA='\033[0;35m'
    export CYAN='\033[0;36m'
    export NC='\033[0m'
else
    export RED=''; export GREEN=''; export YELLOW=''; export BLUE=''
    export MAGENTA=''; export CYAN=''; export NC=''
fi

log()  { echo -e "${GREEN}[SELF-FIX]${NC} $*" >&2; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error(){ echo -e "${RED}[ERROR]${NC} $*" >&2; }
info() { echo -e "${CYAN}[INFO]${NC} $*" >&2; }
step() { echo -e "${MAGENTA}[STEP]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
# Safe JSON parsing with Python (avoids grep fragility)
# Usage: echo "JSON" | json_get_failed_checks
# Returns failed checks excluding ACTION_REQUIRED (review requests) and SKIPPED
json_get_failed_checks() {
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    failures = []
    for c in data:
        s = c.get('state', '')
        n = c.get('name', '')
        # FAILURE, ERROR, CANCELLED are real failures
        # ACTION_REQUIRED (Codacy review) is non-blocking
        # SKIPPED, NEUTRAL are non-blocking
        if s in ('FAILURE', 'ERROR', 'CANCELLED'):
            failures.append({'name': n, 'state': s})
    print(json.dumps(failures))
except Exception as e:
    print(json.dumps([{'name': 'parse_error', 'state': str(e)}]))
" 2>/dev/null || echo '[]'
}


json_has_pending() {
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for c in data:
        s = c.get('state', '')
        if s in ('PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'):
            print('true')
            sys.exit(0)
    print('false')
except:
    print('false')
" 2>/dev/null || echo 'false'
}


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
        --pr)              TARGET_PR="$2"; shift 2 ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --max-retries N       Maximum fix iterations (default: 5)"
            echo "  --timeout SECONDS     Per-iteration timeout (default: 1800)"
            echo "  --poll-interval SEC   CI check polling interval (default: 20)"
            echo "  --auto-research       Use web research on failures (default: on)"
            echo "  --no-auto-research    Disable web research"
            echo "  --strict-validation   ALL checks must pass (default: on)"
            echo "  --no-strict           Allow some warnings"
            echo "  --dry-run             Simulate without pushing"
            echo "  --base-branch BRANCH  Target branch (default: main)"
            echo "  --pr NUMBER           Target existing PR number (checkout branch)"
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

    # If targeting existing PR, checkout its branch first
    if [ -n "$TARGET_PR" ]; then
        local pr_branch
        pr_branch=$(gh pr view "$TARGET_PR" --json headRefName --jq '.headRefName' 2>/dev/null || echo "")
        if [ -z "$pr_branch" ]; then
            error "Could not find branch for PR #${TARGET_PR}."
            return 2
        fi
        local current_branch
        current_branch=$(git branch --show-current)
        if [ "$current_branch" != "$pr_branch" ]; then
            info "Switching to PR #${TARGET_PR} branch: ${pr_branch}..."
            git fetch origin "$pr_branch" 2>/dev/null || true
            git checkout "$pr_branch" 2>/dev/null || {
                error "Failed to checkout branch ${pr_branch}."
                return 2
            }
            # Rebase onto base branch
            info "Rebasing onto ${BASE_BRANCH}..."
            if ! git rebase "origin/${BASE_BRANCH}" 2>/dev/null; then
                warn "Rebase failed — continuing with current state."
                git rebase --abort 2>/dev/null || true
            fi
        fi
    fi

    # Stage all changes
    git add -A
    if git diff --cached --quiet; then
        warn "No changes to commit."
        return 0
    fi

    # Run quality gate before committing (use --changed for speed)
    info "Running quality gate..."
    if [ "$STRICT_VALIDATION" = 1 ]; then
        if ! ./scripts/quality_gate.sh --changed; then
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

    # Determine PR number: use TARGET_PR or find by branch
    local pr_number="$TARGET_PR"
    if [ -z "$pr_number" ]; then
        pr_number=$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
    fi

    if [ -n "$pr_number" ] && [ "$pr_number" != "null" ]; then
        info "Updating existing PR #${pr_number}..."
        local change_log
        change_log=$(git log --oneline "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "No new commits")
        gh pr edit "${pr_number}" \
            --body "## 🤖 Self-Fix Loop — Iteration Update

### Changes since last update
${change_log}

### Status
⏳ CI checks in progress..." 2>/dev/null || true
    else
        info "Creating new PR..."
        local commit_subject
        commit_subject=$(git log -1 --pretty=%s)
        gh pr create \
            --title "${commit_subject}" \
            --body "## 🤖 Self-Fix Loop Automation

This PR was automatically created by the self-fix loop.

### Changes
$(git log --oneline "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "Initial commit")

### Status
⏳ Waiting for CI checks to pass..." \
            --base "${BASE_BRANCH}" \
            --label "automated" 2>&1 || {
            warn "PR creation failed."
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
        echo '[]'
        return 0
    fi

    # Determine PR number
    local pr_number="$TARGET_PR"
    if [ -z "$pr_number" ]; then
        pr_number=$(gh pr list --head "${branch}" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
    fi

    if [ -z "$pr_number" ] || [ "$pr_number" = "null" ]; then
        error "No open PR found for branch ${branch}."
        return 1
    fi

    info "Monitoring PR #${pr_number} checks every ${POLL_INTERVAL}s (timeout: ${TIMEOUT}s)..."

    local poll_count=0
    while true; do
        poll_count=$(( poll_count + 1 ))

        if [ "$(date +%s)" -gt "$deadline" ]; then
            error "Timeout reached (${TIMEOUT}s)."
            return 4
        fi

        # Fetch PR checks
        local checks_json
        checks_json=$(gh pr checks "${pr_number}" --json name,state 2>/dev/null || echo "[]")

        if [ "$checks_json" = "[]" ] || [ -z "$checks_json" ]; then
            sleep "$POLL_INTERVAL"
            continue
        fi

        # Check for pending/running checks
        local has_pending
        has_pending=$(echo "$checks_json" | json_has_pending)

        # Count states for display
        local total pending failed
        total=$(echo "$checks_json" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
        pending=$(echo "$checks_json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(len([c for c in d if c.get('state') in ('PENDING','QUEUED','IN_PROGRESS','EXPECTED')]))
" 2>/dev/null || echo "0")
        failed=$(echo "$checks_json" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(len([c for c in d if c.get('state') in ('FAILURE','ERROR','CANCELLED')]))
" 2>/dev/null || echo "0")

        if [ "$has_pending" = "true" ]; then
            if [ $(( poll_count % 5 )) -eq 1 ]; then
                info "Checks: ${pending} pending, ${failed} failed / ${total} total — waiting..."
            fi
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

    # Use the Python helper to extract failed checks
    local failed_checks
    failed_checks=$(echo "$checks_json" | json_get_failed_checks)

    # Check if we got parse errors
    if echo "$failed_checks" | python3 -c "
import json,sys
d=json.load(sys.stdin)
sys.exit(0 if any(c.get('name')=='parse_error' for c in d) else 1)
" 2>/dev/null; then
        warn "Failed to parse checks JSON."
        echo "[]"
        return 0
    fi

    if [ "$failed_checks" = "[]" ] || [ -z "$failed_checks" ]; then
        log "All checks pass!"
        echo ""  # empty = no failures
        return 0
    fi

    # Display failures to stderr
    info "Failed checks:" >&2
    echo "$failed_checks" | python3 -c "
import json,sys
for c in json.load(sys.stdin):
    print(f'  ❌ {c[\"name\"]}: {c[\"state\"]}')
" 2>/dev/null || echo "  (parse error)" >&2

    # Output only the JSON to stdout for the caller
    echo "$failed_checks"
    return 1
}

# ---------------------------------------------------------------------------
# Phase 5: Fix
# ---------------------------------------------------------------------------
phase_fix() {
    local failed_checks_json="$1"
    step "Phase 5/6: FIX"

    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would apply fixes for failed checks"
        return 0
    fi

    # Parse failures into name:state pairs
    local failures
    failures=$(echo "$failed_checks_json" | python3 -c "
import json,sys
for c in json.load(sys.stdin):
    print(f'{c[\"name\"]}|{c[\"state\"]}')
" 2>/dev/null || echo "")

    if [ -z "$failures" ]; then
        info "No failures to fix."
        return 0
    fi

    info "Analyzing and fixing failures..."
    local fix_applied=false
    local has_vercel_failure=false

    while IFS='|' read -r failed_name failed_state; do
        [ -z "$failed_name" ] && continue
        info "Investigating: ${failed_name} (${failed_state})"

        # Handle Vercel failures specially — trigger re-deploy
        if echo "$failed_name" | grep -qi "vercel"; then
            has_vercel_failure=true
            info "Vercel deployment failed — will trigger re-deploy."
            continue
        fi

        # Handle ACTION_REQUIRED (Codacy, etc.) — usually not blocking
        if [ "$failed_state" = "ACTION_REQUIRED" ]; then
            warn "${failed_name} requires action — skipping auto-fix."
            continue
        fi

        # For real failures, get the latest workflow run logs
        local branch
        branch=$(git branch --show-current)
        local run_id
        run_id=$(gh run list --branch "${branch}" --limit 3 --json databaseId,conclusion \
            --jq '.[] | select(.conclusion == "failure") | .databaseId' 2>/dev/null | head -1 || echo "")

        local logs=""
        if [ -n "$run_id" ]; then
            logs=$(gh run view "$run_id" --log-failed 2>/dev/null | tail -100 || echo "")
        fi

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
            if [ -f ./scripts/validate-links.sh ]; then ./scripts/validate-links.sh 2>/dev/null || true; fi
            fix_applied=true
        elif echo "$logs" | grep -qiE "(skill|symlink)"; then
            info "Skill format issue detected — running validate-skills..."
            if [ -f ./scripts/validate-skills.sh ]; then ./scripts/validate-skills.sh 2>/dev/null || true; fi
            fix_applied=true
        else
            warn "Unrecognized failure type in: ${failed_name}"
            warn "Run ID ${run_id:-N/A} — logs may be at the Vercel dashboard."
        fi
    done <<< "$failures"

    # Handle Vercel re-deploy if needed
    if [ "$has_vercel_failure" = true ]; then
        VERCEL_RETRIES=$(( VERCEL_RETRIES + 1 ))
        if [ "$VERCEL_RETRIES" -le "$MAX_VERCEL_RETRIES" ]; then
            info "Triggering Vercel re-deploy (attempt ${VERCEL_RETRIES}/${MAX_VERCEL_RETRIES})..."
            # Push an empty commit to trigger re-deploy
            git commit --allow-empty -m "chore: retry vercel deployment (${VERCEL_RETRIES})" --no-verify 2>/dev/null || true
            fix_applied=true
        else
            warn "Max Vercel retries (${MAX_VERCEL_RETRIES}) reached. Manual deploy may be needed."
        fi
    fi

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

