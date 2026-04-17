#!/usr/bin/env bash
# Library for Swarm Worktree Web Research Workflow

# Constants
readonly WORKTREE_BASE="/tmp/swarm-worktrees"
readonly ANALYSIS_DIR="analysis"
readonly REPORTS_DIR="reports"
readonly SWARM_BRANCH_PREFIX="swarm-analysis"

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging - Using $* to handle multi-argument logs and quoting for safety
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

validate_environment() {
    log_info "Validating environment..."
    local tools=("git" "python3" "gh" "bc")
    local tool
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Missing required tool: $tool"
            return 1
        fi
    done

    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
        log_warn "GITHUB_TOKEN not set, PR creation may fail"
    fi
    return 0
}

setup_worktree() {
    local branch_name="$1"
    local worktree_path
    worktree_path="${WORKTREE_BASE}/${branch_name}"

    log_info "Setting up worktree: ${worktree_path}"
    mkdir -p "$WORKTREE_BASE"

    git worktree add -b "$branch_name" "$worktree_path" main > /dev/null
    echo "$worktree_path"
}

cleanup_worktree() {
    local worktree_path="$1"
    local branch_name
    branch_name=$(basename "$worktree_path")

    log_info "Cleaning up worktree: ${worktree_path}"
    git worktree remove "$worktree_path" > /dev/null
    git branch -D "$branch_name" > /dev/null
}

generate_research_queries() {
    local topic="$1"
    local output_file="$2"

    log_info "Generating research queries for topic: ${topic}"

    # Securely generate queries using Python to avoid injection
    python3 -c "
import sys
topic = sys.argv[1]
queries = [
    f'{topic} best practices',
    f'{topic} optimization strategies',
    f'{topic} common pitfalls',
    f'{topic} performance benchmarks'
]
for q in queries: print(q)
" "$topic" > "$output_file"
}

resolve_with_optimization() {
    local query="$1"
    local output_file="$2"
    local context="$3"

    log_info "Resolving: ${query}"

    # Safe JSON generation using Python
    local json_input
    json_input=$(python3 -c "
import json, sys
data = {'query': sys.argv[1], 'context': sys.argv[2]}
print(json.dumps(data))
" "$query" "$context")

    if [[ -f ".agents/skills/do-web-doc-resolver/scripts/resolve.py" ]]; then
        python3 .agents/skills/do-web-doc-resolver/scripts/resolve.py <<< "$json_input" > "$output_file"
    else
        # Mock for template
        python3 -c "
import json, sys, datetime
query = sys.argv[1]
res = {
    'query': query,
    'result': {
        'score': 0.85,
        'content': f'Simulated research content for {query}',
        'metrics': {'paid_usage': False, 'cache_hit': True}
    },
    'timestamp': datetime.datetime.utcnow().isoformat()
}
print(json.dumps(res))
" "$query" > "$output_file"
    fi
}

batch_resolve() {
    local queries_file="$1"
    local output_dir="$2"
    local max_parallel="${3:-3}"

    log_info "Starting batch resolution (max parallel: ${max_parallel})"
    mkdir -p "$output_dir"

    local pids=()
    local count=0
    local context="Swarm optimization research"
    local query

    while IFS= read -r query; do
        [[ -n "$query" ]] || continue

        # Secure filename using SHA256 to avoid command injection
        # Split declaration and assignment for SC2155
        local sanitized_query
        sanitized_query=$(echo -n "$query" | sha256sum | awk '{print $1}')
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

    python3 -c "
import json, sys, datetime
from pathlib import Path

output_dir = sys.argv[1]
summary_file = sys.argv[2]

results = []
total_score = 0
count = 0
paid_count = 0
cache_hits = 0

for json_file in Path(output_dir).glob('*.json'):
    if json_file.name.startswith('_'): continue
    try:
        with open(json_file) as f:
            data = json.load(f)
            results.append(data)
            result = data.get('result', {})
            total_score += result.get('score', 0)
            count += 1
            metrics = result.get('metrics', {})
            if metrics.get('paid_usage'): paid_count += 1
            if metrics.get('cache_hit'): cache_hits += 1
    except Exception as e:
        print(f'Error reading {json_file}: {e}')

summary = {
    'timestamp': datetime.datetime.utcnow().isoformat(),
    'total_queries': count,
    'average_score': round(total_score / count, 2) if count > 0 else 0,
    'cache_hit_rate': round(cache_hits / count, 2) if count > 0 else 0,
    'paid_usage_rate': round(paid_count / count, 2) if count > 0 else 0,
    'estimated_tokens_saved': cache_hits * 2000,
    'results': results
}

with open(summary_file, 'w') as f:
    json.dump(summary, f, indent=2)
" "$output_dir" "$summary_file"

    log_success "Summary saved to: ${summary_file}"
}

execute_swarm_analysis() {
    local worktree_path="$1"
    local topic="$2"
    local analysis_dir="$3"
    # shellcheck disable=SC2034
    local reports_dir="$4"

    local synthesis_file="${worktree_path}/${analysis_dir}/SWARM_SYNTHESIS.md"

    # Simulated synthesis
    cat > "$synthesis_file" << EOF
# Swarm Analysis Synthesis: ${topic}
Generated at: \$(date)

## Methodology
Multi-agent swarm investigation with optimized web research.

## Findings
- Simulated finding 1 for ${topic}
- Simulated finding 2 for ${topic}
EOF
    echo "$synthesis_file"
}
