#!/usr/bin/env bash
# Full quality gate with auto-detection for multiple languages.
# Exit 0 = silent success, Exit 2 = errors surfaced to agent.
# Used in pre-commit hook and CI.
# NOTE: errexit disabled explicitly - it causes unpredictable failures in CI
# Why +e instead of -e? We need to capture command output before exiting,
# and we aggregate all failures before deciding the final exit code.
set +e
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Source lint-cache library
# shellcheck source=scripts/lib/lint_cache.sh
if [ -f "$REPO_ROOT/scripts/lib/lint_cache.sh" ]; then
    # shellcheck source=scripts/lib/lint_cache.sh
    source "$REPO_ROOT/scripts/lib/lint_cache.sh"
else
    # Fail soft when the library is absent: leaving `lint_if_changed` undefined
    # makes every call fail as `command not found`, which the gate reports as
    # "<linter> failed: <file>" for every file. That is a false failure, not a
    # real one (the shellcheck call even discards stderr, so the cause is
    # invisible). Run the linter directly instead — no cache, but truthful
    # results — and say so once (plans/147 §4.1).
    echo "Warning: scripts/lib/lint_cache.sh is missing - lints run uncached" >&2
    lint_if_changed() {
        shift 3
        "$@"
    }
fi

# Source the Markdown file-enumeration library. It lives in scripts/lib/ so
# this script does not grow with every new enumeration rule, and so the rule
# has its own BATS coverage. The fallback keeps the gate working if the
# library is missing or unreadable: a missing enumeration would otherwise
# leave `list_markdown_files` undefined, and the Markdown section would
# silently lint nothing — a gate that reports success without checking
# anything. The `source` result is checked for that reason: the file can
# exist and still fail to load.
# shellcheck source=scripts/lib/markdown-files.sh
if [ -f "$REPO_ROOT/scripts/lib/markdown-files.sh" ] &&
    source "$REPO_ROOT/scripts/lib/markdown-files.sh" &&
    declare -F list_markdown_files >/dev/null 2>&1; then
    :
else
    echo "Warning: scripts/lib/markdown-files.sh is missing or unreadable - falling back to a filesystem sweep" >&2
    list_markdown_files() {
        find . -name "*.md" \
            -not -path "./node_modules/*" \
            -not -path "./target/*" \
            -not -path "./.git/*" \
            -not -path "./.agents/*" \
            -not -path "./.claude/*" \
            -not -path "./.gemini/*" \
            -not -path "./.qwen/*" \
            -not -path "./.opencode/*" \
            -not -path "./playwright-report/*" \
            -not -path "./test-results/*" \
            -not -path "./coverage/*" \
            2>/dev/null || true
    }
fi

# Language-specific checks are required; do not report a green gate if their
# library cannot be loaded.
# shellcheck source=scripts/lib/language-checks.sh
if [ -f "$REPO_ROOT/scripts/lib/language-checks.sh" ] &&
    source "$REPO_ROOT/scripts/lib/language-checks.sh" &&
    declare -F run_language_checks >/dev/null 2>&1; then
    :
else
    echo "Error: scripts/lib/language-checks.sh is missing or unreadable - language checks cannot run" >&2
    exit 2
fi


# Colors for output (disabled in CI via TTY check, or via FORCE_COLOR=0)
# TTY check (-t 1): Determines if stdout is a terminal (not redirected to file/pipe)
# This prevents ANSI codes from appearing in CI logs while keeping colors for local dev
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# FAILED acts as an error accumulator - any failed check sets this to 1
# We don't exit immediately so we can report ALL issues, not just the first
FAILED=0

# Maximum allowed warnings across all checks. Zero means warnings are errors.
MAX_ALLOWED_WARNINGS=0

# DETECTED_LANGUAGES stores which language ecosystems are present in the repo
# We use this array to conditionally run only relevant checks
DETECTED_LANGUAGES=()

# Scopes for validation
VALID_SCOPES=("all" "docs" "agent" "frontend" "cli" "export" "tooling")
SCOPE=""
FAST_MODE=false
CHANGED_ONLY=false

# Simple argument parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        --scope)
            SCOPE="$2"
            shift 2
            ;;
        --fast)
            FAST_MODE=true
            shift
            ;;
        --changed)
            CHANGED_ONLY=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--scope <scope>] [--fast] [--changed]"
            echo "Scopes: ${VALID_SCOPES[*]}"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# Validate scope
scope_match=false
for s in "${VALID_SCOPES[@]}"; do
  [[ "$s" == "$SCOPE" ]] && scope_match=true && break
done
if [[ -n "$SCOPE" ]] && [[ "$scope_match" == false ]]; then
    echo -e "${RED}Error: Invalid scope '${SCOPE}'. Valid scopes are: ${VALID_SCOPES[*]}${NC}"
    exit 1
fi

# Set default scope to "all" if not provided and not in changed-only mode
if [[ -z "$SCOPE" ]] && [ "$CHANGED_ONLY" = false ]; then
    SCOPE="all"
fi

# Resolve the ref that --changed diffs against, most specific first:
#   1. QUALITY_GATE_BASE_REF  explicit override (also what the BATS tests drive)
#   2. GITHUB_BASE_REF        set by GitHub Actions on pull_request events
#   3. origin/HEAD            the remote's default branch
#   4. main
# Returns non-zero when nothing resolves, so the caller can fail closed instead
# of reporting success for work nobody checked (plans/147).
resolve_base_ref() {
    local candidate
    local candidates=()
    local default_branch=""

    if [ -n "${QUALITY_GATE_BASE_REF:-}" ]; then
        candidates+=("$QUALITY_GATE_BASE_REF")
    fi
    if [ -n "${GITHUB_BASE_REF:-}" ]; then
        candidates+=("origin/$GITHUB_BASE_REF" "$GITHUB_BASE_REF")
    fi
    default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
    if [ -n "$default_branch" ]; then
        candidates+=("$default_branch" "${default_branch#origin/}")
    fi
    candidates+=("origin/main" "main")

    for candidate in "${candidates[@]}"; do
        [ -n "$candidate" ] || continue
        if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null 2>&1; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

# Detect changed scope if requested
if [ "$CHANGED_ONLY" = true ]; then
    if ! command -v git &> /dev/null; then
        echo -e "${YELLOW}Warning: git not found, defaulting to scope 'all'${NC}"
        SCOPE="all"
    else
        echo -e "${BLUE}Detecting changed files...${NC}"
        CHANGED_FILES=""
        MERGE_BASE=""
        CHANGE_SET_UNKNOWN=false

        # Fail closed: an undeterminable change set must widen the gate, never
        # narrow it to nothing (plans/147).
        BASE_REF=""
        if BASE_REF=$(resolve_base_ref); then
            # Diff from the merge base so every commit on the branch is checked,
            # not just its tip. The previous HEAD~1 fallback hid the shell changes
            # on PR #806 behind a trailing docs-only commit.
            MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2>/dev/null || true)
            if [ -z "$MERGE_BASE" ]; then
                echo -e "${YELLOW}  ⚠ No merge base with '$BASE_REF' - running the full gate${NC}"
                SCOPE="${SCOPE:-all}"
                CHANGE_SET_UNKNOWN=true
            else
                if [ "$MERGE_BASE" = "$(git rev-parse HEAD 2>/dev/null)" ]; then
                    if git rev-parse --verify --quiet HEAD~1 >/dev/null 2>&1; then
                        # The tip *is* the base, i.e. this is a push to the default
                        # branch: check the commit that landed, not nothing.
                        MERGE_BASE=$(git rev-parse HEAD~1)
                    else
                        # Tip is the base and there is no history to say what
                        # landed (a shallow checkout). Widen rather than report
                        # "no changes" for work nobody looked at.
                        echo -e "${YELLOW}  ⚠ '$BASE_REF' is the tip and no parent commit is available (shallow checkout)${NC}"
                        echo -e "${YELLOW}    Running the full gate instead of checking nothing.${NC}"
                        SCOPE="${SCOPE:-all}"
                        CHANGE_SET_UNKNOWN=true
                    fi
                fi
                if [ "$CHANGE_SET_UNKNOWN" = true ]; then
                    CHANGED_FILES=""
                elif CHANGED_FILES=$(git diff --name-only "$MERGE_BASE" 2>/dev/null); then
                    echo "  Base: $BASE_REF (diff from $(git rev-parse --short "$MERGE_BASE" 2>/dev/null))"
                else
                    echo -e "${YELLOW}  ⚠ git diff against '$MERGE_BASE' failed - running the full gate${NC}"
                    SCOPE="${SCOPE:-all}"
                    CHANGED_FILES=""
                    CHANGE_SET_UNKNOWN=true
                fi
            fi
        else
            echo -e "${YELLOW}  ⚠ No base ref found (QUALITY_GATE_BASE_REF, GITHUB_BASE_REF, origin/HEAD, main)${NC}"
            echo -e "${YELLOW}    Running the full gate instead of checking nothing.${NC}"
            SCOPE="${SCOPE:-all}"
            CHANGE_SET_UNKNOWN=true
        fi

        # Mapping patterns to scopes
        HAS_DOCS=false
        HAS_AGENT=false
        HAS_FRONTEND=false
        HAS_CLI=false
        HAS_EXPORT=false
        HAS_TOOLING=false

        # Only a *determined* empty change set means there is nothing to check.
        if [ "$CHANGE_SET_UNKNOWN" = false ] && [ -z "$CHANGED_FILES" ]; then
            echo -e "${GREEN}No changes detected.${NC}"
            exit 0
        fi

        if [ -n "$CHANGED_FILES" ]; then
            while IFS= read -r file; do
                [[ "$file" =~ \.md$ ]] || [[ "$file" =~ ^agents-docs/ ]] && HAS_DOCS=true
                [[ "$file" =~ ^\.agents/ ]] || [[ "$file" =~ ^AGENTS\.md$ ]] || [[ "$file" =~ ^scripts/validate-(skills|skill-format|links)\.sh$ ]] && HAS_AGENT=true
                [[ "$file" =~ ^src/ ]] || [[ "$file" =~ ^public/ ]] || [[ "$file" =~ ^index\.html$ ]] || [[ "$file" =~ ^vite\.config\.ts$ ]] && HAS_FRONTEND=true
                [[ "$file" =~ ^cli/ ]] && HAS_CLI=true
                [[ "$file" =~ ^export/ ]] && HAS_EXPORT=true
                [[ "$file" =~ ^scripts/ ]] || [[ "$file" =~ ^tests/ ]] || [[ "$file" =~ ^\.github/ ]] || [[ "$file" =~ ^package\.json$ ]] && HAS_TOOLING=true
            done <<< "$CHANGED_FILES"
        fi
    fi
fi

if [ "$FAST_MODE" = true ]; then
    echo -e "${YELLOW}Running in FAST mode (skipping heavy tests)${NC}"
    SKIP_TESTS=true
fi

echo "Running quality gate (Scope: $SCOPE)..."
echo ""

# --- Validate git hooks configuration (Plan 131 G7: no bypass; the
# validator resolves the committed .githooks/ directory on fresh checkouts) ---
echo -e "${BLUE}Validating git hooks configuration...${NC}"
if ! ./scripts/validate-git-hooks.sh; then
    FAILED=1
fi
echo ""

# --- Validate GitHub Actions SHAs ---
if [[ "$SCOPE" == "all" || "$SCOPE" == "tooling" || "${HAS_TOOLING:-false}" == "true" ]]; then
    echo -e "${BLUE}Validating GitHub Actions SHAs...${NC}"
    if ! ./scripts/validate-github-actions-shas.sh; then
        FAILED=1
    fi
    echo ""
fi

# --- Always: no committed merge-conflict markers ---
# A rebase resolution can leave markers *inside* a committed file: git reports
# the rebase as successful, and the failure surfaces three layers down as a
# vitest "Transform failed" with no hint of the cause. Detecting it here costs
# milliseconds (Plan 163).
echo -e "${BLUE}Checking for committed merge-conflict markers...${NC}"
CONFLICT_MARKERS=$(git grep -nE '^(<<<<<<< |>>>>>>> )' -- . ':(exclude)*.md' ':(exclude)*.lock' ':(exclude)pnpm-lock.yaml' 2>/dev/null || true)
if [ -n "$CONFLICT_MARKERS" ]; then
    echo -e "${RED}  ✗ merge-conflict markers committed:${NC}"
    printf '%s\n' "$CONFLICT_MARKERS" | head -20
    FAILED=1
else
    echo -e "${GREEN}  ✓ no conflict markers in tracked source${NC}"
fi
echo ""

# --- Always: validate package manager configuration ---
if [[ "$SCOPE" == "all" || "$SCOPE" == "tooling" || "${HAS_TOOLING:-false}" == "true" ]]; then
    echo -e "${BLUE}Validating package manager configuration...${NC}"
    if ! ./scripts/validate-package-manager.sh; then
        FAILED=1
    fi
    echo ""
fi

# --- Always: validate skill symlinks and format ---
if [[ "$SCOPE" == "all" || "$SCOPE" == "agent" || "${HAS_AGENT:-false}" == "true" ]]; then
    echo -e "${BLUE}Validating skill symlinks and format...${NC}"
    if ! ./scripts/validate-skills.sh; then
        FAILED=1
    fi
    echo ""
fi

# --- Always: validate agent-facing surfaces ---
echo -e "${BLUE}Validating agent-facing surfaces...${NC}"
if ! ./scripts/validate-skills.sh; then
    FAILED=1
fi
echo ""

# --- Validate reference links in SKILL.md files ---
if [[ "$SCOPE" == "all" || "$SCOPE" == "agent" || "$SCOPE" == "docs" || "${HAS_AGENT:-false}" == "true" || "${HAS_DOCS:-false}" == "true" ]]; then
    echo -e "${BLUE}Validating reference links in SKILL.md files...${NC}"
    if ! ./scripts/validate-links.sh; then
        FAILED=1
    fi
    echo ""
fi

# --- Auto-detect project languages ---
# We detect languages by checking for ecosystem-specific marker files.
# This avoids running Rust checks on a Python project, for example.
# Marker files chosen because they're required by the ecosystem:
#   - Cargo.toml: Rust's package manifest (always required)
#   - package.json: Node.js/npm/pnpm manifest (always required)
#   - requirements.txt/pyproject.toml: Python dependency specs
#   - go.mod: Go module definition (Go 1.11+)
#   - *.sh / *.md: File existence checks using find (no manifest file needed)
echo -e "${BLUE}Detecting project languages...${NC}"

# Rust detection via Cargo.toml
# Cargo.toml is Rust's package manifest - it's always present in valid Rust projects
if [ -f "Cargo.toml" ]; then
    echo "  ${GREEN}✓${NC} Rust (Cargo.toml)"
    DETECTED_LANGUAGES+=("rust")
fi

# TypeScript/JavaScript detection via package.json
# We check for package.json (not tsconfig.json) because it's required for dependencies
if [ -f "package.json" ]; then
    echo "  ${GREEN}✓${NC} TypeScript/JavaScript (package.json)"
    DETECTED_LANGUAGES+=("typescript")
fi

# Python detection - multiple valid project files
# We check all common markers: requirements.txt (pip), pyproject.toml (modern), setup.py (legacy)
# Any one indicates this is a Python project that needs linting/format checks
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    echo "  ${GREEN}✓${NC} Python (requirements.txt/pyproject.toml)"
    DETECTED_LANGUAGES+=("python")
fi

# Go detection via go.mod
# go.mod defines the module path and Go version - required for Go 1.11+ modules
if [ -f "go.mod" ]; then
    echo "  ${GREEN}✓${NC} Go (go.mod)"
    DETECTED_LANGUAGES+=("go")
fi

# Shell script detection via file existence
# Unlike compiled languages, shell scripts don't have a manifest file
# We use find + grep to check if any .sh files exist (excluding .git directory)
if [ -n "$(find . -name "*.sh" -not -path "./.git/*" -print -quit 2>/dev/null)" ]; then
    echo "  ${GREEN}✓${NC} Shell scripts detected"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection via file existence
# We always check markdown if .md files exist (for linting with markdownlint)
if [ -n "$(find . -name "*.md" -not -path "./.git/*" -print -quit 2>/dev/null)" ]; then
    echo "  ${GREEN}✓${NC} Markdown files detected"
    DETECTED_LANGUAGES+=("markdown")
fi

# No languages detected - template is language-agnostic but user needs to add project files
if [ ${#DETECTED_LANGUAGES[@]} -eq 0 ]; then
    echo -e "${YELLOW}  No recognized project files found.${NC}"
    echo "  Add Cargo.toml, package.json, requirements.txt, go.mod, or source files."
fi
echo ""

# --- Run language-specific checks ---
 # ShellCheck checks this script without following sourced functions; keep the
 # cross-file configuration inputs visible here as well.
 : "$MAX_ALLOWED_WARNINGS" "${HAS_FRONTEND:-false}" "${HAS_CLI:-false}" \
     "${HAS_EXPORT:-false}" "${SKIP_TESTS:-false}"
if ! run_language_checks; then
    FAILED=1
fi

# --- Final result aggregation ---
# We use FAILED flag to accumulate errors across all checks
# Benefits of this pattern:
#   1. Users see ALL failures at once (not just the first)
#   2. Each check is independent - one failure doesn't skip others
#   3. Exit code 2 specifically indicates quality gate failure
#      (distinct from generic exit 1 which could be script error)
if [ $FAILED -ne 0 ]; then
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}"
    echo -e "${RED}│ ✗ Quality Gate FAILED                                         │${NC}"
    echo -e "${RED}─────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo "Fix the errors above and re-run quality gate."
    echo "Use SKIP_TESTS=true or SKIP_CLIPPY=true to skip specific checks."
    exit 2
fi

echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
echo -e "${GREEN}│ ✓ All Quality Gates PASSED                                    │${NC}"
echo -e "${GREEN}─────────────────────────────────────────────────────────────────${NC}"
echo ""
echo "Languages checked: ${DETECTED_LANGUAGES[*]}"
