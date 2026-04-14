#!/usr/bin/env bash
# lib/research-engine.sh - Web research and resolution functions
# Source this file from scripts that need web research capabilities.

resolve_with_optimization() {
    local query_or_url="$1"
    local output_file="$2"
    local context="${3:-general}"
    local resolver_dir="${4:-.agents/skills/do-web-doc-resolver}"
    local profile="${WEB_RESOLVER_PROFILE:-quality}"

    local resolve_args=(
        "--profile" "$profile"
        "--max-chars" "${WEB_RESOLVER_MAX_CHARS:-8000}"
        "--trace"
        "--json"
    )

    case "$context" in
        "api-docs")
            resolve_args+=("--validate-links" "--quality-threshold" "0.8")
            ;;
        "tutorial")
            resolve_args+=("--check-completeness")
            ;;
        "reference")
            resolve_args+=("--profile" "quality" "--validate-all")
            ;;
    esac

    local result
    result=$(cd "$resolver_dir" && \
        python3 -m scripts.resolve "$query_or_url" "${resolve_args[@]}" 2>/dev/null || \
        echo '{"source": "error", "content": "Resolution failed", "score": 0}')

    cat > "$output_file" << EOF
{
  "query": "$query_or_url",
  "context": "$context",
  "profile": "$profile",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "result": $result
}
EOF

    local score
    score=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('score', 0))" 2>/dev/null || echo "0")

    if (( $(echo "$score > 0.7" | bc -l 2>/dev/null || echo "0") )); then
        return 0
    else
        return 1
    fi
}

generate_research_queries() {
    local topic="$1"
    local output_file="$2"

    cat > "$output_file" << EOF
# Research Queries for: ${topic}
# Format: query|context

${topic} best practices|api-docs
${topic} official documentation|reference
${topic} getting started tutorial|tutorial
${topic} implementation examples|tutorial
${topic} common patterns|reference
${topic} security considerations|api-docs
${topic} performance optimization|reference
EOF
}
