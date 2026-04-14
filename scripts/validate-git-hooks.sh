#!/usr/bin/env bash
# Validate git hooks configuration to prevent global hooks from overriding local hooks.
# Exit 0 = no global hooks detected, Exit 1 = global hooks detected (warning issued).

set -euo pipefail

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    RED=''
    YELLOW=''
    GREEN=''
    NC=''
fi

# Check for global hooks path configuration
GLOBAL_HOOKS_PATH=$(git config --global core.hooksPath 2>/dev/null || true)
LOCAL_HOOKS_PATH=$(git config --local core.hooksPath 2>/dev/null || true)

if [ -n "$GLOBAL_HOOKS_PATH" ]; then
    echo -e "${RED}✗ ERROR: Global git hooks path is set!${NC}"
    echo -e "   Global hooks path: ${YELLOW}$GLOBAL_HOOKS_PATH${NC}"
    echo ""
    echo "This can prevent local pre-commit hooks from running."
    echo ""
    echo "To fix this, choose one option:"
    echo ""
    echo "  Option 1 - Remove global hooks (recommended for this repo):"
    echo "    git config --global --unset core.hooksPath"
    echo ""
    echo "  Option 2 - Disable global hooks for this repo only:"
    echo "    git config --local core.hooksPath .git/hooks"
    echo ""
    echo "  Option 3 - Skip this check (not recommended):"
    echo "    SKIP_GLOBAL_HOOKS_CHECK=true git commit ..."
    echo ""
    exit 1
fi

# Check if local hooks path is correctly set
if [ -n "$LOCAL_HOOKS_PATH" ] && [ "$LOCAL_HOOKS_PATH" != ".git/hooks" ]; then
    echo -e "${RED}✗ ERROR: Local hooks path is non-standard!${NC}"
    echo -e "   Local hooks path: ${YELLOW}$LOCAL_HOOKS_PATH${NC}"
    echo ""
    echo "To reset to standard path:"
    echo "    git config --local core.hooksPath .git/hooks"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Git hooks configuration validated${NC}"
exit 0
