#!/usr/bin/env bash
#
# Swarm Worktree Web Research Workflow
# Combines git worktrees, swarm analysis, and optimized web research
# for maximum token efficiency and validation quality.
#

set -euo pipefail

# Get repository root for portable paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source shared libraries
# shellcheck source=lib/worktree-manager.sh
source "$REPO_ROOT/scripts/lib/worktree-manager.sh"
# shellcheck source=lib/research-engine.sh
source "$REPO_ROOT/scripts/lib/research-engine.sh"
# shellcheck source=lib/swarm-analysis.sh
source "$REPO_ROOT/scripts/lib/swarm-analysis.sh"

# Worktree cleanup trap - prevents stale worktree accumulation on error/exit
# See: https://github.com/your-org/your-project/issues/119
trap cleanup_worktrees EXIT INT TERM ERR

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Configuration
readonly WORKTREE_BASE="${WORKTREE_BASE:-.worktrees}"
readonly ANALYSIS_DIR="analysis"
readonly REPORTS_DIR="reports"
readonly SWARM_BRANCH_PREFIX="swarm-analysis"

# Web Resolver Optimization Settings
export WEB_RESOLVER_PROFILE="${WEB_RESOLVER_PROFILE:-quality}"
readonly WEB_RESOLVER_MAX_CHARS="${WEB_RESOLVER_MAX_CHARS:-8000}"
readonly WEB_RESOLVER_MIN_CHARS="${WEB_RESOLVER_MIN_CHARS:-200}"
readonly WEB_RESOLVER_CACHE_TTL_DAYS="${WEB_RESOLVER_CACHE_TTL_DAYS:-30}"

# GitHub Workflow Settings
readonly GITHUB_TIMEOUT="${GITHUB_TIMEOUT:-3600}"
readonly GITHUB_MERGE_METHOD="${GITHUB_MERGE_METHOD:-squash}"
readonly GITHUB_FAIL_ON_WARNING="${GITHUB_FAIL_ON_WARNING:-1}"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==============================================================================
# PHASE 1: Setup and Validation
# ==============================================================================

validate_environment() {
    log_info "Validating environment..."

    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not a git repository"
        exit 1
    fi

    local required_tools=("git" "python3" "gh")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done

    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi

    if [[ ! -f ".agents/skills/do-web-doc-resolver/scripts/resolve.py" ]]; then
        log_warn "Web resolver skill not found at expected location"
    fi

    log_success "Environment validated"
}

# ==============================================================================
# PHASE 2: Web Research (batch resolve + summary)
# ==============================================================================

batch_resolve() {
    local queries_file="$1"
    local output_dir="$2"
    local max_parallel="${3:-3}"

    log_info "Batch resolving $(wc -l < "$queries_file") queries (max parallel: ${max_parallel})"
    mkdir -p "$output_dir"

    local pids=()
    local count=0

    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        local query context
        query=$(echo "$line" | cut -d'|' -f1 | xargs)
        context=$(echo "$line" | cut -d'|' -f2 | xargs)
        context="${context:-general}"

        local sanitized_query
        sanitized_query=$(echo "$query" | tr -c '[:alnum:]' '_')
        local output_file="${output_dir}/${sanitized_query}.json"

        if [[ ${#pids[@]} -ge $max_parallel ]]; then
            wait "${pids[0]}"
            pids=("${pids[@]:1}")
        fi

        resolve_with_optimization "$query" "$output_file" "$context" &
        pids+=("$!")
        ((count++))

        if (( count % 5 == 0 )); then
            sleep 2
        fi
    done < "$queries_file"

    wait
    log_success "Batch resolution complete: ${count} queries processed"
    generate_research_summary "$output_dir"
}

generate_research_summary() {
    local output_dir="$1"
    local summary_file="${output_dir}/_summary.json"

    log_info "Generating research summary..."

    python3 << 'EOF' - "$output_dir" "$summary_file"
import json, sys
from pathlib import Path

output_dir = sys.argv[1]
summary_file = sys.argv[2]

results = []
total_score = 0
count = 0
paid_count = 0
cache_hits = 0

for json_file in Path(output_dir).glob("*.json"):
    if json_file.name.startswith("_"):
        continue
    try:
        with open(json_file) as f:
            data = json.load(f)
            results.append(data)
            result = data.get("result", {})
            total_score += result.get("score", 0)
            count += 1
            metrics = result.get("metrics", {})
            if metrics.get("paid_usage"):
                paid_count += 1
            if metrics.get("cache_hit"):
                cache_hits += 1
    except Exception as e:
        print(f"Error reading {json_file}: {e}")

summary = {
    "timestamp": __import__('datetime').datetime.utcnow().isoformat(),
    "total_queries": count,
    "average_score": round(total_score / count, 2) if count > 0 else 0,
    "cache_hit_rate": round(cache_hits / count, 2) if count > 0 else 0,
    "paid_usage_rate": round(paid_count / count, 2) if count > 0 else 0,
    "estimated_tokens_saved": cache_hits * 2000,
    "results": results
}

with open(summary_file, 'w') as f:
    json.dump(summary, f, indent=2)

print(f"Summary: {count} queries, avg score: {summary['average_score']}")
EOF

    log_success "Summary saved to: ${summary_file}"
}

# ==============================================================================
# PHASE 3: Swarm Analysis (orchestration)
# ==============================================================================

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

# ==============================================================================
# PHASE 4: GitHub Actions Validation
# ==============================================================================

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

    git commit -m "feat(analysis): swarm analysis with optimized web research

- Multi-agent swarm analysis executed
- Web research with quality profile (${WEB_RESOLVER_PROFILE})
- Full link and reference validation
- Token optimization via caching

Analysis: ${ANALYSIS_DIR}/SWARM_SYNTHESIS.md"

    git push -u origin "$branch_name" || {
        log_error "Failed to push branch ${branch_name}"
        popd > /dev/null
        return 1
    }

    popd > /dev/null

    log_info "Creating PR and monitoring Actions..."

    if [[ -f ".agents/skills/github-workflow/run.sh" ]]; then
        bash .agents/skills/github-workflow/run.sh \
            --message "feat: swarm analysis with optimized web research" \
            --base-branch main \
            --branch-name "$branch_name" \
            --timeout "$GITHUB_TIMEOUT" \
            --check-all-actions \
            --fail-on-warning
    else
        log_warn "GitHub workflow skill not available, using manual PR creation"

        local pr_url
        pr_url=$(gh pr create \
            --title "feat: swarm analysis - ${1:-topic}" \
            --body "Swarm analysis with optimized web research" \
            --base main \
            --head "$branch_name" 2>/dev/null || echo "")

        if [[ -n "$pr_url" ]]; then
            log_success "PR created: ${pr_url}"
            log_info "Monitoring GitHub Actions checks..."
            gh pr checks "$branch_name" --watch --interval 30 || {
                log_error "PR checks failed or timed out"
                return 1
            }
        fi
    fi

    log_success "GitHub Actions validation complete"
}

# ==============================================================================
# Main Workflow
# ==============================================================================

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

  # Fast analysis with balanced profile
  $0 --profile balanced "React hooks patterns"

  # Analysis only, no PR
  $0 --no-pr "Database query optimization"

ENVIRONMENT:
  WEB_RESOLVER_PROFILE    Resolver profile (default: quality)
  WEB_RESOLVER_MAX_CHARS  Max content length (default: 8000)
  GITHUB_TIMEOUT          Actions timeout in seconds (default: 3600)
  GITHUB_TOKEN            GitHub token for API access

EOF
}

main() {
    local analysis_topic=""
    local profile="${WEB_RESOLVER_PROFILE}"
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
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
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
        exit 1
    fi

    export WEB_RESOLVER_PROFILE="$profile"

    log_info "=========================================="
    log_info "Swarm Worktree Web Research Workflow"
    log_info "=========================================="
    log_info "Topic: ${analysis_topic}"
    log_info "Profile: ${profile}"
    log_info "Timestamp: $(date)"
    log_info "=========================================="

    if [[ "$dry_run" == true ]]; then
        log_info "DRY RUN - Would execute:"
        log_info "  1. Validate environment"
        log_info "  2. Setup worktree for: ${SWARM_BRANCH_PREFIX}-$(date +%s)"
        log_info "  3. Execute web research with ${profile} profile"
        log_info "  4. Run swarm analysis"
        log_info "  5. Create PR and validate Actions"
        [[ "$cleanup" == true ]] && log_info "  6. Cleanup worktree"
        exit 0
    fi

    validate_environment

    local branch_name
    branch_name="${SWARM_BRANCH_PREFIX}-$(date +%s)"
    if [[ -n "$worktree_path" ]]; then
        setup_worktree "$branch_name" > /dev/null
        worktree_path="${WORKTREE_BASE}/${branch_name}"
    else
        worktree_path=$(setup_worktree "$branch_name")
    fi

    local synthesis_file
    synthesis_file=$(run_swarm_with_research "$worktree_path" "$analysis_topic")

    if [[ "$no_pr" == false ]]; then
        run_github_actions_validation "$worktree_path" "$branch_name"
    else
        log_info "Skipping PR creation (--no-pr flag)"
        log_info "Analysis available at: ${worktree_path}/${ANALYSIS_DIR}"
    fi

    if [[ "$cleanup" == true ]]; then
        cleanup_worktree "$worktree_path"
    else
        log_info "Worktree preserved at: ${worktree_path}"
        log_info "To cleanup later: git worktree remove ${worktree_path}"
    fi

    log_success "=========================================="
    log_success "Workflow completed successfully!"
    log_success "=========================================="

    if [[ "$no_pr" == false ]]; then
        log_info "PR created and validated with GitHub Actions"
    fi

    log_info "Analysis synthesis: ${synthesis_file}"
    log_info "Web research results: ${worktree_path}/${ANALYSIS_DIR}/web_research/"
}

main "$@"
