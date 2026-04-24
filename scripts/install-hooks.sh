#!/usr/bin/env bash
# Install git hooks for auto-updating documentation
# Usage: ./scripts/install-hooks.sh
# Or: cp scripts/install-hooks.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "Installing git hooks for documentation auto-update..."
echo ""

# Pre-installation safety check: validate git hooks configuration
# Global hooks can override local hooks, which would silently break our automation
# We validate first so users aren't confused when hooks don't run
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    echo "Checking git hooks configuration..."
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh" 2>/dev/null; then
        echo ""
        echo "⚠️  WARNING: Git hooks configuration issue detected!"
        echo ""
        "$REPO_ROOT/scripts/validate-git-hooks.sh" || true
        echo ""
        echo "It's recommended to fix this before installing hooks."
        echo "To continue anyway: SKIP_GLOBAL_HOOKS_CHECK=true ./scripts/install-hooks.sh"
        echo ""
        exit 1
    fi
fi

# Ensure .git/hooks directory exists
# This shouldn't happen in a valid git repo, but we handle it gracefully
if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: .git/hooks directory not found. Are you in a git repository?"
    exit 1
fi

# Install post-commit hook (for docs sync)
# 
# HOOK TEMPLATE GENERATION PATTERN:
# We use a here-document (<< 'HOOK') to embed the hook script content.
# The delimiter 'HOOK' (quoted) prevents variable expansion at install time,
# which is critical because the hook must use $REPO_ROOT at runtime, not install time.
#
# SUBSTITUTION STRATEGY:
#   - $REPO_ROOT is written as $REPO_ROOT (literal) in the template
#   - It will be resolved by git rev-parse --show-toplevel at hook runtime
#   - This makes the hook portable across different clone locations
#
# WHY post-commit?
#   This hook runs after a commit is created but before it's pushed.
#   We use it to auto-update derived documentation (AGENTS.md, AGENTS.md)
#   when the source files (.agents/skills/*) change.
#
# THE amend --no-edit PATTERN:
#   After updating docs, we amend the commit to include the changes.
#   --no-edit preserves the original commit message.
#   This doesn't trigger an infinite loop because git hooks don't run on amend.
#
cat > "$HOOKS_DIR/post-commit" << 'HOOK'
#!/bin/bash
# Auto-update documentation when skills/agents change
# Runs after each commit to keep docs in sync

# Get the repository root dynamically
# Why git rev-parse? The hook runs from .git/hooks/, not repo root.
# This ensures REPO_ROOT is correct regardless of where git was invoked.
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$REPO_ROOT" || exit 1

# Get the previous commit hash
# HEAD~1 = parent of current commit (what changed since last commit)
PREV_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "")

if [ -z "$PREV_COMMIT" ]; then
    # First commit - skip (nothing to diff against)
    exit 0
fi

# Get list of changed files between previous and current commit
# We use this to determine if we need to regenerate docs
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# Update skill table if skills changed
# The pattern matches any file under .agents/skills/ directory
echo "$CHANGED_FILES" | grep -q ".agents/skills/" && {
    echo "Skills changed - updating AGENTS.md..."
    "$REPO_ROOT/scripts/update-agents-md.sh"
    git add AGENTS.md
    # Amend the commit to include the updated AGENTS.md
    if ! git commit --amend --no-edit 2>/dev/null; then
        echo "Warning: Failed to amend commit with updated AGENTS.md"
    fi
}

# Update registry if agents changed  
# The pattern matches files in .claude/, .opencode/, etc. agent directories
echo "$CHANGED_FILES" | grep -qE "\.(claude|opencode)/agents/" && {
    echo "Agents changed - updating AGENTS.md..."
    "$REPO_ROOT/scripts/update-agents-registry.sh"
    git add agents-docs/AGENTS.md
    if ! git commit --amend --no-edit 2>/dev/null; then
        echo "Warning: Failed to amend commit with updated AGENTS.md"
    fi
}

exit 0
HOOK

chmod +x "$HOOKS_DIR/post-commit"
echo "✓ Installed post-commit hook (auto-updates docs)"

# Install pre-commit hook (for quality gate)
#
# PRE-COMMIT HOOK DESIGN:
#   This hook blocks commits that fail quality checks.
#   It's the "gatekeeper" that enforces code quality before code enters history.
#
# WHY set -e?
#   The hook must exit with error on any failure to block the commit.
#   This is different from install-hooks.sh which uses -e for general safety.
#
# VALIDATION ORDER:
#   1. Git hooks config (prevents global hooks from interfering)
#   2. Quality gate (runs all language-specific checks)
#   If any step fails, the commit is aborted with a helpful message.
#
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/bin/bash
# Pre-commit hook - runs quality gate before each commit
# Install: ./scripts/install-hooks.sh

set -e

# Resolve repository root at runtime (hooks run from .git/hooks/)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$REPO_ROOT" || exit 1

# Source lint-cache library
# shellcheck source=scripts/lib/lint_cache.sh
if [ -f "$REPO_ROOT/scripts/lib/lint_cache.sh" ]; then
    # shellcheck source=scripts/lib/lint_cache.sh
    source "$REPO_ROOT/scripts/lib/lint_cache.sh"
fi

# Validate git hooks configuration (prevent global hooks from overriding local)
# This catches cases where user's global git config would prevent hooks from running
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    if ! "$REPO_ROOT/scripts/validate-git-hooks.sh"; then
        echo ""
        echo "Commit aborted. Fix the hooks configuration or use SKIP_GLOBAL_HOOKS_CHECK=true to skip."
        exit 1
    fi
fi

echo "Running pre-commit quality checks..."

# Run quality gate
# Any failure here aborts the commit (due to set -e)
if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
    echo ""
    echo "❌ Quality gate failed. Fix issues before committing."
    echo "   To bypass (not recommended): git commit --no-verify"
    exit 1
fi

echo ""
echo "✓ Pre-commit checks passed."
exit 0
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "✓ Installed pre-commit hook (runs quality gate)"

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "Hooks active:"
echo "  - pre-commit: Runs quality gate before each commit"
echo "  - post-commit: Auto-updates AGENTS.md and AGENTS.md"
echo ""
echo "To verify:"
echo "  ls -la .git/hooks/"
echo ""
echo "To uninstall, remove hooks:"
echo "  rm .git/hooks/pre-commit .git/hooks/post-commit"
