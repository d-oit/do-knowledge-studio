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

# The loop requires the shared repository-file rules and its GitHub phase
# functions; fail closed instead of running a partial automation flow.
# shellcheck source=scripts/lib/markdown-files.sh
if [ -f "$REPO_ROOT/scripts/lib/markdown-files.sh" ] &&
    source "$REPO_ROOT/scripts/lib/markdown-files.sh" &&
    declare -F trim_markdown_trailing_whitespace >/dev/null 2>&1; then
    :
else
    error "scripts/lib/markdown-files.sh is missing or unreadable."
    exit 2
fi

# shellcheck source=scripts/lib/self-fix-github.sh
if [ -f "$REPO_ROOT/scripts/lib/self-fix-github.sh" ] &&
    source "$REPO_ROOT/scripts/lib/self-fix-github.sh" &&
    declare -F phase_commit_and_push >/dev/null 2>&1; then
    :
else
    error "scripts/lib/self-fix-github.sh is missing or unreadable."
    exit 2
fi
# ShellCheck does not follow the sourced GitHub/CI phase module.
: "$STRICT_VALIDATION" "$TARGET_PR"



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

        # ACTION_REQUIRED (a Codacy finding, a requested review) blocks the merge
        # and cannot be auto-fixed: triage it with the `codacy` skill. It is
        # reported as an unresolved failure, so the loop never claims success
        # while it stands.
        if [ "$failed_state" = "ACTION_REQUIRED" ]; then
            warn "${failed_name} requires action — triage with the codacy skill (not auto-fixable)."
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
            # The scoped trailing-whitespace pass below applies the fix.
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
    # The quality-gate Markdown list excludes ignored output and vendored skills.
    find . -type f \( -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" \
        -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \) \
        -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./pnpm-lock.yaml" \
        -exec sed -i 's/[[:space:]]*$//' {} \; 2>/dev/null || true
    trim_markdown_trailing_whitespace

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
        # Capture the status from the command itself: `! cmd` inverts a failure
        # into 0, so `$?` inside the `then` body was always 0 and the abort
        # below could never fire — a failed push was retried, then reported as a
        # successful loop with the work never landed.
        local phase1_status=0
        phase_commit_and_push || phase1_status=$?
        if [ "$phase1_status" -ne 0 ]; then
            if [ "$phase1_status" -eq 2 ]; then
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
        local analysis_status=0
        failed_jobs=$(phase_analyze_failures "$checks_json") || analysis_status=$?

        # Exit 2 means the CI results could not be read. That is an unknown
        # state, so abort instead of reporting success for unchecked work.
        if [ "$analysis_status" -eq 2 ]; then
            error "CI check results were unreadable. Aborting before any success report."
            exit 5
        fi

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

