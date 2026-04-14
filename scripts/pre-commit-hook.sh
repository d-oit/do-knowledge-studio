#!/usr/bin/env bash
# Git pre-commit hook.
# Install: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
set -euo pipefail

# Get repository root for portable paths
# Use git rev-parse for reliable resolution regardless of hook install location
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Source lint-cache library
# shellcheck source=scripts/lib/lint_cache.sh
if [ -f "$REPO_ROOT/scripts/lib/lint_cache.sh" ]; then
    # shellcheck source=scripts/lib/lint_cache.sh
    source "$REPO_ROOT/scripts/lib/lint_cache.sh"
fi

# Validate git hooks configuration (prevent global hooks from overriding local)
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh"; then
        echo ""
        echo "Commit aborted. Fix the hooks configuration or use SKIP_GLOBAL_HOOKS_CHECK=true to skip."
        exit 1
    fi
fi

# If VERSION is being changed, propagate to all version references
if git diff --cached --name-only | grep -q "^VERSION$"; then
    echo "VERSION changed - propagating to all files..."
    "$REPO_ROOT/scripts/propagate-version.sh"
    # Re-stage files that were updated by propagation
    git add README.md QUICKSTART.md agents-docs/MIGRATION.md CHANGELOG.md 2>/dev/null || true
fi

echo "Running pre-commit checks..."
"$REPO_ROOT/scripts/quality_gate.sh"

echo "Pre-commit checks passed."