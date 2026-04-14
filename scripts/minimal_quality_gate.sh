#!/usr/bin/env bash
# Minimal test script for CI debugging

set +e
set -uo pipefail

# Get repository root for portable paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source lint-cache library
# shellcheck source=scripts/lib/lint_cache.sh
if [ -f "$REPO_ROOT/scripts/lib/lint_cache.sh" ]; then
    # shellcheck source=scripts/lib/lint_cache.sh
    source "$REPO_ROOT/scripts/lib/lint_cache.sh"
fi

echo "Starting minimal quality gate..."

# Test 1: Validate skills
"$REPO_ROOT/scripts/validate-skills.sh"
result=$?
echo "validate-skills.sh exit code: $result"

if [ $result -ne 0 ]; then
    echo "ERROR: validate-skills.sh failed"
    exit 2
fi

# Test 2: Check some files exist
if [ ! -d "$REPO_ROOT/.agents/skills" ]; then
    echo "ERROR: .agents/skills not found"
    exit 2
fi

# Test 3: Shellcheck scripts/ directory (cached)
if command -v shellcheck &> /dev/null; then
    echo "Running shellcheck on scripts/..."
    sc_failed=0
    # Only check .sh files directly in scripts/ for minimal gate
    for script in "$REPO_ROOT"/scripts/*.sh; do
        [ -f "$script" ] || continue
        if ! lint_if_changed "$script" "shellcheck" ".shellcheckrc" shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
            echo "  ✗ shellcheck failed: $script"
            sc_failed=1
        fi
    done
    if [ $sc_failed -ne 0 ]; then
        echo "ERROR: shellcheck failed on some scripts"
        exit 2
    fi
fi

echo "Minimal quality gate PASSED"
exit 0
