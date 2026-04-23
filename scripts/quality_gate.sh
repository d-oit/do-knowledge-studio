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

# DETECTED_LANGUAGES stores which language ecosystems are present in the repo
# We use this array to conditionally run only relevant checks
DETECTED_LANGUAGES=()

echo "Running quality gate..."
echo ""

# --- Validate git hooks configuration (prevent global hooks from overriding local) ---
if [ "${SKIP_GLOBAL_HOOKS_CHECK:-false}" != "true" ]; then
    echo -e "${BLUE}Validating git hooks configuration...${NC}"
    if ! ./scripts/validate-git-hooks.sh; then
        # Don't fail the quality gate, just warn
        FAILED=1
    fi
    echo ""
fi

# --- Validate GitHub Actions SHAs ---
echo -e "${BLUE}Validating GitHub Actions SHAs...${NC}"
if ! ./scripts/validate-github-actions-shas.sh; then
    FAILED=1
fi
echo ""

# --- Always: validate agent-facing surfaces ---
echo -e "${BLUE}Validating agent-facing surfaces...${NC}"
if ! ./scripts/agent-surface.py validate; then
    FAILED=1
fi
echo ""

# --- Validate SKILL.md format ---
echo -e "${BLUE}Validating SKILL.md format...${NC}"
if ! ./scripts/validate-skill-format.sh; then
    FAILED=1
fi
echo ""

# --- Validate reference links in SKILL.md files ---
echo -e "${BLUE}Validating reference links in SKILL.md files...${NC}"
if ! ./scripts/validate-links.sh; then
    FAILED=1
fi
echo ""

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
if find . -name "*.sh" -not -path "./.git/*" | grep -q .; then
    echo "  ${GREEN}✓${NC} Shell scripts detected"
    DETECTED_LANGUAGES+=("shell")
fi

# Markdown detection via file existence
# We always check markdown if .md files exist (for linting with markdownlint)
if find . -name "*.md" -not -path "./.git/*" | grep -q .; then
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
# Pattern for each language section:
#   1. Check if language was detected: [[ " ${DETECTED_LANGUAGES[*]} " =~ " language " ]]
#      The spaces around pattern ensure we match whole words (prevents "go" matching "mango")
#   2. Check if required tool is installed: command -v tool &> /dev/null
#   3. Run checks, capturing output to variable: OUTPUT=$(command 2>&1)
#   4. On failure: echo error message, output to stderr, set FAILED=1
#   5. On success: echo green checkmark
# Why capture output? We want clean "pass/fail" output first, with details on failure only

# Rust checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " rust " ]]; then
    echo -e "${BLUE}Running Rust checks...${NC}"

    if command -v cargo &> /dev/null; then
        # Format check: cargo fmt --check returns error if files would be reformatted
        # This enforces consistent formatting without modifying files
        if ! OUTPUT=$(cargo fmt --check 2>&1); then
            echo -e "${RED}  ✗ cargo fmt failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ cargo fmt passed${NC}"
        fi

        # Clippy: Rust's linter - catches common mistakes and anti-patterns
        # SKIP_CLIPPY allows skipping in CI if clippy is slow or has false positives
        if [ "${SKIP_CLIPPY:-false}" != "true" ]; then
            if ! OUTPUT=$(cargo clippy --all-targets -- -D warnings 2>&1); then
                echo -e "${RED}  ✗ cargo clippy failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ cargo clippy passed${NC}"
            fi
        fi

        # Tests: Run library tests only (faster than integration tests)
        # SKIP_TESTS allows skipping in environments without test dependencies
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(cargo test --lib 2>&1); then
                echo -e "${RED}  ✗ cargo test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ cargo test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ cargo not installed - skipping Rust checks${NC}"
    fi
    echo ""
fi

# TypeScript / JavaScript checks
# Prefers pnpm (faster, disk efficient) but falls back to npm if pnpm unavailable
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " typescript " ]]; then
    echo -e "${BLUE}Running TypeScript/JavaScript checks...${NC}"

    # Check for pnpm first (preferred package manager)
    if command -v pnpm &> /dev/null; then
        # Lint: Runs ESLint or configured linter via "pnpm lint" script
        if ! OUTPUT=$(pnpm lint 2>&1); then
            echo -e "${RED}  ✗ pnpm lint failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm lint passed${NC}"
        fi

        # Typecheck: Runs tsc --noEmit to verify types without generating JS
        # Catches type errors that might not appear in tests
        if ! OUTPUT=$(pnpm typecheck 2>&1); then
            echo -e "${RED}  ✗ pnpm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm typecheck passed${NC}"
        fi

        # Tests via SKIP_TESTS env var (useful for CI without test env)
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(pnpm test 2>&1); then
                echo -e "${RED}  ✗ pnpm test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ pnpm test passed${NC}"
            fi
        fi
    elif command -v npm &> /dev/null; then
        # Fallback to npm - runs same checks via "npm run <script>" syntax
        if ! OUTPUT=$(npm run lint 2>&1); then
            echo -e "${RED}  ✗ npm lint failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ npm lint passed${NC}"
        fi

        if ! OUTPUT=$(npm run typecheck 2>&1); then
            echo -e "${RED}  ✗ npm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ npm typecheck passed${NC}"
        fi

        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(npm test 2>&1); then
                echo -e "${RED}  ✗ npm test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ npm test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ pnpm/npm not installed - skipping TypeScript checks${NC}"
    fi
    echo ""
fi

# Python checks
# Uses ruff (modern, fast Python linter) and black (strict formatter)
# Falls back to warnings if tools not installed (Python dev tools are optional)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " python " ]]; then
    echo -e "${BLUE}Running Python checks...${NC}"

    # ruff: Extremely fast Python linter written in Rust
    # Replaces flake8, pylint with unified, faster tool
    if command -v ruff &> /dev/null; then
        if ! OUTPUT=$(ruff check . 2>&1); then
            echo -e "${RED}  ✗ ruff check failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ ruff check passed${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ ruff not installed - skipping Python lint${NC}"
    fi

    # black: The uncompromising Python code formatter
    # --check flag returns error code if files would be reformatted
    if command -v black &> /dev/null; then
        if ! OUTPUT=$(black --check . 2>&1); then
            echo -e "${RED}  ✗ black check failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ black check passed${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ black not installed - skipping Python format${NC}"
    fi

    # pytest: Modern Python testing framework
    # -q (quiet) mode for cleaner output in CI
    if [ "${SKIP_TESTS:-false}" != "true" ]; then
        if command -v pytest &> /dev/null; then
            if ! OUTPUT=$(pytest tests/ -q 2>&1); then
                echo -e "${RED}  ✗ pytest failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ pytest passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ pytest not installed - skipping Python tests${NC}"
        fi
    fi
    echo ""
fi

# Go checks
# Standard Go toolchain provides everything needed: gofmt, go vet, go test
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " go " ]]; then
    echo -e "${BLUE}Running Go checks...${NC}"

    if command -v go &> /dev/null; then
        # gofmt: Standard Go formatter
        # -l lists files that would change (we want empty output = all formatted)
        if ! OUTPUT=$(gofmt -l . 2>&1); then
            echo -e "${RED}  ✗ gofmt found unformatted files${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ gofmt passed${NC}"
        fi

        # go vet: Static analysis tool that catches suspicious constructs
        # ./... means check all packages recursively
        if ! OUTPUT=$(go vet ./... 2>&1); then
            echo -e "${RED}  ✗ go vet failed${NC}"
            echo "$OUTPUT" >&2
            FAILED=1
        else
            echo -e "${GREEN}  ✓ go vet passed${NC}"
        fi

        # Tests: Run all tests in all packages
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(go test ./... 2>&1); then
                echo -e "${RED}  ✗ go test failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ go test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ go not installed - skipping Go checks${NC}"
    fi
    echo ""
fi

# Shell script checks
# Uses shellcheck (static analysis for bash/sh) and BATS (Bash Automated Testing System)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " shell " ]]; then
    echo -e "${BLUE}Running Shell script checks...${NC}"

    if command -v shellcheck &> /dev/null; then
        # Find all shell scripts excluding .git and build artifacts
        # Using grep -q to check if any files exist (find returns 0 even with no matches)
        SHELL_SCRIPTS=$(find . -name "*.sh" -not -path "./.git/*" -not -path "./target/*" 2>/dev/null || true)
        if [ -n "$SHELL_SCRIPTS" ]; then
            # Run shellcheck on each script individually
            # This gives us per-file failure tracking (sc_failed flag)
            sc_failed=0
            while IFS= read -r script; do
                [ -n "$script" ] || continue
                # Use --severity=error to only fail on actual errors, not style warnings
                # Use -f quiet to reduce output volume in CI environments
                # lint_if_changed handles hashing and caching
                if ! lint_if_changed "$script" "shellcheck" ".shellcheckrc" shellcheck --severity=error -f quiet "$script" 2>/dev/null; then
                    echo -e "${RED}  ✗ shellcheck failed: $script${NC}"
                    sc_failed=1
                fi
            done <<< "$SHELL_SCRIPTS"

            if [ $sc_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ shellcheck passed${NC}"
            else
                FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ shellcheck not installed - skipping shell checks${NC}"
    fi

    # BATS tests: Run if tests/ directory exists and tests not skipped
    # BATS provides a TAP-compliant testing framework for bash scripts
    # NOTE: Skip if we're already inside a BATS test (prevent recursion)
    if [ -d "tests" ] && [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
        if command -v bats &> /dev/null; then
            if ! OUTPUT=$(bats tests/ 2>&1); then
                echo -e "${RED}  ✗ bats tests failed${NC}"
                echo "$OUTPUT" >&2
                FAILED=1
            else
                echo -e "${GREEN}  ✓ bats tests passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ bats not installed - skipping shell tests${NC}"
        fi
    fi
    echo ""
fi

# Markdown checks (if markdownlint is available)
# markdownlint enforces consistent Markdown style across the repo
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]]; then
    echo -e "${BLUE}Running Markdown checks...${NC}"

    if command -v markdownlint &> /dev/null; then
        # Check all .md files, ignoring dependencies and build artifacts
        # --ignore patterns prevent linting generated files or node_modules
        MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./target/*" -not -path "./.git/*" 2>/dev/null || true)
        if [ -n "$MD_FILES" ]; then
            md_failed=0
            while IFS= read -r md_file; do
                [ -n "$md_file" ] || continue
                # lint_if_changed handles hashing and caching
                if ! OUTPUT=$(lint_if_changed "$md_file" "markdownlint" "markdownlint.toml" markdownlint "$md_file" 2>&1); then
                    echo -e "${RED}  ✗ markdownlint failed: $md_file${NC}"
                    echo "$OUTPUT" >&2
                    md_failed=1
                fi
            done <<< "$MD_FILES"

            if [ $md_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ markdownlint passed${NC}"
            else
                FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ markdownlint not installed - skipping markdown checks${NC}"
    fi
    echo ""
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
