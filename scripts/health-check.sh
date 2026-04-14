#!/usr/bin/env bash
# health-check.sh - Verify environment has all required template dependencies
#
# Usage: ./scripts/health-check.sh
#
# Exit codes:
#   0 = All required tools present
#   1 = Some tools missing (warning)
#   2 = Critical tools missing (error)

set -uo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if terminal supports colors
if [[ ! -t 1 ]]; then
    RED=''
    YELLOW=''
    GREEN=''
    NC=''
fi

# Counters
REQUIRED_MISSING=0
OPTIONAL_MISSING=0

# Check command existence
check_command() {
    local cmd="$1"
    local required="${2:-false}"
    local min_version="${3:-}"

    if command -v "$cmd" &>/dev/null; then
        local version=""
        case "$cmd" in
            git) version=$(git --version 2>/dev/null | head -1) ;;
            bash) version=${BASH_VERSION} ;;
            shellcheck) version=$(shellcheck --version 2>/dev/null | head -2 | tail -1) ;;
            bats) version=$(bats --version 2>/dev/null) ;;
            jq) version=$(jq --version 2>/dev/null) ;;
            markdownlint) version=$(markdownlint --version 2>/dev/null) ;;
            yamllint) version=$(yamllint --version 2>/dev/null) ;;
            *) version="installed" ;;
        esac

        echo -e "${GREEN}✓${NC} $cmd: $version"

        if [[ -n "$min_version" ]]; then
            # Version comparison would go here
            : # Placeholder
        fi
        return 0
    else
        if [[ "$required" == "true" ]]; then
            echo -e "${RED}✗${NC} $cmd: ${RED}REQUIRED but not found${NC}"
            ((REQUIRED_MISSING++))
        else
            echo -e "${YELLOW}⚠${NC} $cmd: ${YELLOW}optional, not found${NC}"
            ((OPTIONAL_MISSING++))
        fi
        return 1
    fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          TEMPLATE HEALTH CHECK                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check Bash version
echo "Shell Environment:"
echo "  Bash version: ${BASH_VERSION}"
if [[ "${BASH_VERSINFO[0]}" -lt 4 ]]; then
    echo -e "  ${YELLOW}⚠ Warning: Bash 4.0+ recommended${NC}"
fi
echo ""

# Required tools
echo "Required Tools:"
check_command "git" "true"
check_command "bash" "true"

# Core validation tools
echo ""
echo "Core Validation Tools:"
check_command "shellcheck" "false"
check_command "bats" "false"
check_command "markdownlint" "false"
check_command "jq" "false"
check_command "yamllint" "false"

# Git configuration
echo ""
echo "Git Configuration:"
if git config --global user.name &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} user.name: $(git config --global user.name)"
else
    echo -e "  ${YELLOW}⚠${NC} user.name: ${YELLOW}not set${NC}"
fi

if git config --global user.email &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} user.email: $(git config --global user.email)"
else
    echo -e "  ${YELLOW}⚠${NC} user.email: ${YELLOW}not set${NC}"
fi

# Check for global hooks that might conflict
echo ""
echo "Git Hooks Configuration:"
if git config --global core.hooksPath &>/dev/null; then
    hooks_path=$(git config --global core.hooksPath)
    echo -e "  ${YELLOW}⚠${NC} Global hooks detected: $hooks_path"
    echo -e "     Run: git config --global --unset core.hooksPath"
else
    echo -e "  ${GREEN}✓${NC} No conflicting global hooks"
fi

# Check template setup
echo ""
echo "Template Setup:"
if [[ -d ".agents/skills" ]]; then
    skill_count=$(find .agents/skills -maxdepth 1 -type d | wc -l)
    echo -e "  ${GREEN}✓${NC} Skills directory exists ($skill_count skills)"
else
    echo -e "  ${RED}✗${NC} Skills directory not found - run ./scripts/setup-skills.sh"
fi

if [[ -L ".claude/skills" ]]; then
    echo -e "  ${GREEN}✓${NC} Claude symlinks configured"
else
    echo -e "  ${YELLOW}⚠${NC} Claude symlinks missing - run ./scripts/setup-skills.sh"
fi

if [[ -L ".gemini/skills" ]]; then
    echo -e "  ${GREEN}✓${NC} Gemini symlinks configured"
else
    echo -e "  ${YELLOW}⚠${NC} Gemini symlinks missing - run ./scripts/setup-skills.sh"
fi

if [[ -f ".git/hooks/pre-commit" ]]; then
    echo -e "  ${GREEN}✓${NC} Pre-commit hook installed"
else
    echo -e "  ${YELLOW}⚠${NC} Pre-commit hook not installed"
    echo -e "     Run: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════════════════════"
if [[ $REQUIRED_MISSING -gt 0 ]]; then
    echo -e "${RED}Status: FAILED - $REQUIRED_MISSING required tool(s) missing${NC}"
    echo ""
    echo "Install missing tools:"
    echo "  Ubuntu/Debian: sudo apt-get install git bash"
    echo "  macOS: brew install git bash"
    echo ""
    exit 2
elif [[ $OPTIONAL_MISSING -gt 0 ]]; then
    echo -e "${YELLOW}Status: WARNING - $OPTIONAL_MISSING optional tool(s) missing${NC}"
    echo ""
    echo "To install optional tools:"
    echo "  Ubuntu/Debian:"
    echo "    sudo apt-get install shellcheck bats jq"
    echo "    npm install -g markdownlint-cli"
    echo "    pip install yamllint"
    echo ""
    echo "  macOS:"
    echo "    brew install shellcheck bats jq markdownlint-cli yamllint"
    echo ""
    exit 1
else
    echo -e "${GREEN}Status: HEALTHY - All tools present${NC}"
    echo ""
    echo "You're ready to use the template! Next steps:"
    echo "  1. Run: ./scripts/setup-skills.sh"
    echo "  2. Review: cat AGENTS.md"
    echo "  3. Run quality gate: ./scripts/quality_gate.sh"
    echo ""
    exit 0
fi
