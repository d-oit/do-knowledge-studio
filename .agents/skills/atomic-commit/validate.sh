#!/usr/bin/env bash
# Phase 1: PRE_COMMIT - Validation
# Validates code quality, checks for secrets, verifies branch
# Exit 0 = validation passed, Exit 1 = validation failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log() {
    echo -e "${BLUE}[validate]${NC} $*"
}

error() {
    echo -e "${RED}[validate]${NC} $*" >&2
}

success() {
    echo -e "${GREEN}[validate]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[validate]${NC} $*"
}

cd "$REPO_ROOT"

log "Running pre-commit validation..."
echo ""

# Check 1: Not on protected branch
CURRENT_BRANCH=$(git branch --show-current)
PROTECTED_BRANCHES="main master"

if [[ " $PROTECTED_BRANCHES " =~ $CURRENT_BRANCH ]]; then
    error "Cannot commit directly to $CURRENT_BRANCH branch"
    error "Create a feature branch first: git checkout -b feat/your-feature"
    exit 1
fi

success "On feature branch: $CURRENT_BRANCH"

# Check 2: Quality gate must pass (zero warnings policy)
log "Running quality gate (zero warnings policy)..."
echo ""

if [[ -x "$REPO_ROOT/scripts/quality_gate.sh" ]]; then
    if ! "$REPO_ROOT/scripts/quality_gate.sh"; then
        error "Quality gate failed - fix all warnings before committing"
        exit 1
    fi
else
    error "quality_gate.sh not found or not executable"
    exit 1
fi

echo ""
success "Quality gate passed"

# Check 3: Scan for secrets in staged changes
log "Scanning for secrets..."

# Basic secret patterns (additional patterns can be added)
SECRET_PATTERNS=(
    "api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]"
    "password\s*[:=]\s*['\"][^'\"]+['\"]"
    "secret\s*[:=]\s*['\"][a-zA-Z0-9]{16,}['\"]"
    "private[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9+/=]{20,}['\"]"
    "AKIA[0-9A-Z]{16}"  # AWS Access Key ID pattern
    "gh[pousr]_[A-Za-z0-9_]{36,}"  # GitHub token pattern
)

SECRET_FOUND=false
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [[ -n "$STAGED_FILES" ]]; then
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if git diff --cached 2>/dev/null | grep -iE "$pattern" > /dev/null 2>&1; then
            error "Potential secret detected matching pattern: ${pattern:0:30}..."
            SECRET_FOUND=true
        fi
    done
fi

if [[ "$SECRET_FOUND" == true ]]; then
    error "Secrets detected in staged changes"
    error "Remove secrets and use environment variables or secret management"
    exit 1
fi

success "No secrets detected"

# Check 4: Working directory status
UNSTAGED_FILES=$(git diff --name-only 2>/dev/null || true)
UNTRACKED_FILES=$(git ls-files --others --exclude-standard 2>/dev/null || true)

if [[ -n "$UNSTAGED_FILES" ]] || [[ -n "$UNTRACKED_FILES" ]]; then
    warn "Unstaged/untracked files exist:"
    [[ -n "$UNSTAGED_FILES" ]] && printf '%s\n' "$UNSTAGED_FILES" | sed 's/^/  unstaged: /'
    [[ -n "$UNTRACKED_FILES" ]] && printf '%s\n' "$UNTRACKED_FILES" | sed 's/^/  untracked: /'
    log "Continuing - these will be included in the atomic commit"
fi

# Check 5: Verify gh CLI is available (needed for PR creation)
if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) not found"
    error "Install from: https://cli.github.com/"
    exit 1
fi

# Check gh authentication
if ! gh auth status &>/dev/null; then
    error "GitHub CLI not authenticated"
    error "Run: gh auth login"
    exit 1
fi

success "GitHub CLI authenticated"

echo ""
success "═════════════════════════════════════════════════════════════════"
success "  All Pre-Commit Validations PASSED"
success "═════════════════════════════════════════════════════════════════"

exit 0
