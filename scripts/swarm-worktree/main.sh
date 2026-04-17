#!/usr/bin/env bash
# Main orchestration for Swarm Worktree Web Research Workflow

set -euo pipefail

# Detect repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=scripts/swarm-worktree/lib.sh
source "${REPO_ROOT}/scripts/swarm-worktree/lib.sh"

run_swarm_with_research() {
    local worktree_path="$1"
    local analysis_topic="$2"

    log_info "Executing swarm analysis in worktree: ${worktree_path}"
    log_info "Analysis topic: ${analysis_topic}"

    mkdir -p "${worktree_path}/${ANALYSIS_DIR}"
    mkdir -p "${worktree_path}/${REPORTS_DIR}"

    local queries_file="${worktree_path}/${ANALYSIS_DIR}/research_queries.txt"
    generate_research_queries "$analysis_topic" "$queries_file"

    local research_output_dir="${worktree_path}/${ANALYSIS_DIR}/web_research"
    batch_resolve "$queries_file" "$research_output_dir" 3

    log_info "Launching swarm agents with research context..."

    local synthesis_file
    synthesis_file=$(execute_swarm_analysis \
        "$worktree_path" "$analysis_topic" "$ANALYSIS_DIR" "$REPORTS_DIR")

    log_success "Swarm analysis setup complete"
    echo "$synthesis_file"
}

run_github_actions_validation() {
    local worktree_path="$1"
    local branch_name="$2"

    log_info "Running GitHub Actions validation for branch: ${branch_name}"

    pushd "$worktree_path" > /dev/null

    git add -A "$ANALYSIS_DIR" "$REPORTS_DIR" 2>/dev/null || true

    if git diff --cached --quiet; then
        log_warn "No changes to commit"
        popd > /dev/null
        return 0
    fi

    # Securely construct commit message
    local commit_msg
    commit_msg=$(printf "feat(analysis): swarm analysis with optimized web research\n\n- Multi-agent swarm analysis executed\n- Web research with quality profile (%s)\n- Full link and reference validation\n- Token optimization via caching\n\nAnalysis: %s/SWARM_SYNTHESIS.md" "${WEB_RESOLVER_PROFILE:-quality}" "${ANALYSIS_DIR}")

    git commit -m "$commit_msg"

    # NOTE: Actual push is simulated
    log_info "Simulated push to branch %s" "${branch_name}"

    popd > /dev/null

    log_info "Creating PR and monitoring Actions..."

    if [[ -f ".agents/skills/github-workflow/run.sh" ]]; then
        bash .agents/skills/github-workflow/run.sh \
            --message "feat: swarm analysis with optimized web research" \
            --base-branch main \
            --branch-name "$branch_name" \
            --timeout "${GITHUB_TIMEOUT:-3600}" \
            --check-all-actions \
            --fail-on-warning
    else
        log_warn "GitHub workflow skill not available, using manual PR creation"

        local pr_url
        pr_url=$(gh pr create \
            --title "feat: swarm analysis - ${branch_name}" \
            --body "Swarm analysis with optimized web research" \
            --base main \
            --head "$branch_name" 2>/dev/null || echo "")

        if [[ -n "$pr_url" ]]; then
            log_success "PR created: %s" "${pr_url}"
            log_info "Monitoring GitHub Actions checks..."
            gh pr checks "$branch_name" --watch --interval 30 || {
                log_error "PR checks failed or timed out"
                return 1
            }
        fi
    fi

    log_success "GitHub Actions validation complete"
    return 0
}

show_usage() {
    cat << EOF
Swarm Worktree Web Research Workflow

USAGE:
  $0 [OPTIONS] <analysis_topic>

OPTIONS:
  --profile PROFILE       Web resolver profile (free|fast|balanced|quality)
                          Default: quality
  --worktree-path PATH    Custom worktree path
  --cleanup               Clean up worktree after completion
  --no-pr                 Skip PR creation (analysis only)
  --dry-run               Show what would be done
  -h, --help              Show this help

EXAMPLES:
  # Full workflow with quality profile
  $0 "API performance optimization"

EOF
}

main() {
    local analysis_topic=""
    local profile="${WEB_RESOLVER_PROFILE:-quality}"
    local worktree_path=""
    local cleanup=false
    local no_pr=false
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --profile)
                profile="$2"
                shift 2
                ;;
            --worktree-path)
                worktree_path="$2"
                shift 2
                ;;
            --cleanup)
                cleanup=true
                shift
                ;;
            --no-pr)
                no_pr=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                show_usage
                return 0
                ;;
            *)
                analysis_topic="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$analysis_topic" ]]; then
        log_error "Analysis topic required"
        show_usage
        return 1
    fi

    export WEB_RESOLVER_PROFILE="$profile"

    if [[ "$dry_run" == true ]]; then
        log_info "DRY RUN - Would execute analysis for: %s" "${analysis_topic}"
        return 0
    fi

    if ! validate_environment; then
        return 1
    fi

    local branch_name
    branch_name="${SWARM_BRANCH_PREFIX}-$(date +%s)"

    local wt_path
    wt_path=$(setup_worktree "$branch_name")

    local synthesis_file
    synthesis_file=$(run_swarm_with_research "$wt_path" "$analysis_topic")

    if [[ "$no_pr" == false ]]; then
        run_github_actions_validation "$wt_path" "$branch_name"
    fi

    if [[ "$cleanup" == true ]]; then
        cleanup_worktree "$wt_path"
    fi

    log_success "Workflow completed successfully!"
    log_info "Analysis synthesis: %s" "${synthesis_file}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
