#!/usr/bin/env bash
# Developer entry point for validation.
# Supports "fast" (local/pre-commit) and "full" (pre-push/CI) validation.

set -e
set -u
set -o pipefail

# Get repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors for output
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    BLUE=''
    NC=''
fi

usage() {
    echo "Usage: $0 [--fast] [--full] [--scope <scope>] [--changed]"
    echo ""
    echo "Options:"
    echo "  --fast      Run fast validation (skips heavy tests)"
    echo "  --full      Run full validation (all tests, all checks)"
    echo "  --scope     Validate a specific scope (docs, agent, frontend, cli, export, tooling)"
    echo "  --changed   Auto-detect scope based on changed files"
    echo ""
    echo "Examples:"
    echo "  $0 --fast              # Quick check before commit"
    echo "  $0 --full              # Complete check before push"
    echo "  $0 --scope frontend    # Only check frontend code"
}

# Defaults
MODE="fast"
ARGS=()
CHANGED_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --fast)
            MODE="fast"
            shift
            ;;
        --full)
            MODE="full"
            shift
            ;;
        --scope)
            ARGS+=("$1" "$2")
            shift 2
            ;;
        --changed)
            ARGS+=("$1")
            CHANGED_ONLY=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

if [[ "$MODE" == "fast" ]]; then
    echo -e "${BLUE}Running FAST validation...${NC}"
    SKIP_GLOBAL_HOOKS_CHECK=true ./scripts/quality_gate.sh --fast "${ARGS[@]}"
else
    echo -e "${BLUE}Running FULL validation...${NC}"
    SKIP_GLOBAL_HOOKS_CHECK=true ./scripts/quality_gate.sh "${ARGS[@]}"

    # Run E2E tests if relevant
    # (Currently Playwright is heavy, so we only run in full mode)
    RUN_E2E=false
    if [[ " ${ARGS[*]} " =~ "frontend" ]] || [[ " ${ARGS[*]} " =~ "all" ]] || [[ -z "${ARGS[*]}" ]]; then
        RUN_E2E=true
    elif [ "$CHANGED_ONLY" = true ]; then
        if command -v git &> /dev/null; then
            BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
            BASE_BRANCH=${BASE_BRANCH:-main}
            if git diff --name-only "$BASE_BRANCH" | grep -qE "^(src/|public/|index\.html|vite\.config\.ts)"; then
                RUN_E2E=true
            fi
        fi
    fi

    if [ "$RUN_E2E" = true ]; then
         echo -e "${BLUE}Running E2E tests...${NC}"
         if command -v npm &> /dev/null && [ -f "package.json" ]; then
             npm run test:e2e || echo -e "${RED}E2E tests failed (or not configured for this environment)${NC}"
         fi
    fi
fi
