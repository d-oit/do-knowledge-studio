#!/usr/bin/env bash
# Git and GitHub phases for scripts/self-fix-loop.sh.
#
# The caller provides the loop's configuration and logging functions as shell
# globals/functions. This library keeps CI orchestration out of the entrypoint.
#
# The configuration is declared below rather than assumed: a library that only
# reads the caller's globals cannot be checked on its own, and ShellCheck's
# check-unassigned-uppercase (enabled by .github/workflows/security-scan.yml)
# reports each one as "referenced but not assigned". The defaults match the
# entrypoint's own, and the entrypoint sets these before sourcing, so they are
# no-ops in the real call.

TARGET_PR="${TARGET_PR:-}"
BASE_BRANCH="${BASE_BRANCH:-main}"
DRY_RUN="${DRY_RUN:-false}"
STRICT_VALIDATION="${STRICT_VALIDATION:-1}"
TIMEOUT="${TIMEOUT:-1800}"
POLL_INTERVAL="${POLL_INTERVAL:-20}"
# Safe JSON parsing with Python (avoids grep fragility)
# Usage: echo "JSON" | json_get_failed_checks
# Prints the blocking failures as JSON and exits 0. Exits non-zero — with a
# diagnostic on stderr — when the payload cannot be read, so the caller can fail
# closed instead of mistaking an unreadable result for "no failures". Exit
# status is the only signal: detecting it with python would depend on the very
# interpreter that just failed.
json_get_failed_checks() {
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception as e:
    print(f'unreadable CI checks JSON: {e}', file=sys.stderr)
    sys.exit(3)
if not isinstance(data, list):
    print('CI checks JSON is not a list of checks', file=sys.stderr)
    sys.exit(3)
failures = []
for c in data:
    s = c.get('state', '')
    n = c.get('name', '')
    # FAILURE, ERROR, CANCELLED, and ACTION_REQUIRED require action.
    # SKIPPED and NEUTRAL are non-blocking.
    if s in ('FAILURE', 'ERROR', 'CANCELLED', 'ACTION_REQUIRED'):
        failures.append({'name': n, 'state': s})
print(json.dumps(failures))
"
}


json_has_pending() {
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    pending = any(
        c.get('state') in ('PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED')
        for c in data
    )
    print('true' if pending else 'false')
except Exception:
    print('false')
" 2>/dev/null || echo 'false'
}
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

    # Use the Python helper to extract failed checks. A non-zero status means the
    # payload could not be read — an UNKNOWN state, not a passing one — so fail
    # closed instead of reporting success for checks nobody read (AGENTS.md).
    local failed_checks
    if ! failed_checks=$(echo "$checks_json" | json_get_failed_checks); then
        error "Could not read the CI check results — refusing to report success."
        echo ""
        return 2
    fi

    if [ "$failed_checks" = "[]" ] || [ -z "$failed_checks" ]; then
        log "All checks pass!"
        echo ""  # empty = no failures
        return 0
    fi

    # Display the failures on stderr. stdout carries only the JSON the caller
    # parses, so the ❌ lines must not be printed there: a caller that captured
    # them together got text where it expected a JSON array and silently found
    # no failures to fix.
    info "Failed checks:" >&2
    echo "$failed_checks" | python3 -c "
import json,sys
for c in json.load(sys.stdin):
    print(f'  ❌ {c[\"name\"]}: {c[\"state\"]}')
" >&2 2>/dev/null || echo "  (parse error)" >&2

    # Output only the JSON to stdout for the caller
    echo "$failed_checks"
    return 1
}
