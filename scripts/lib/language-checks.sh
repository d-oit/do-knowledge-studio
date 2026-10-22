#!/usr/bin/env bash
# Language-specific checks for scripts/quality_gate.sh.
#
# The caller provides detected languages, scope flags, output colors, and
# per-language options as shell globals. Each check returns nonzero on failure;
# run_language_checks aggregates results while still running later checks.

# --- Run language-specific checks ---
# Pattern for each language section:
#   1. Check if language was detected: [[ " ${DETECTED_LANGUAGES[*]} " =~ " language " ]]
#      The spaces around pattern ensure we match whole words (prevents "go" matching "mango")
#   2. Check if required tool is installed: command -v tool &> /dev/null
#   3. Run checks, capturing output to variable: OUTPUT=$(command 2>&1)
#   4. On failure: echo error message, output to stderr, set CHECKS_FAILED=1
#   5. On success: echo green checkmark
# Why capture output? We want clean "pass/fail" output first, with details on failure only
run_rust_checks() {
    local OUTPUT CHECKS_FAILED=0

# Rust checks
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " rust " ]] && [[ "$SCOPE" == "all" || "${HAS_TOOLING:-false}" == "true" ]]; then
    echo -e "${BLUE}Running Rust checks...${NC}"

    if command -v cargo &> /dev/null; then
        # Format check: cargo fmt --check returns error if files would be reformatted
        # This enforces consistent formatting without modifying files
        if ! OUTPUT=$(cargo fmt --check 2>&1); then
            echo -e "${RED}  ✗ cargo fmt failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ cargo fmt passed${NC}"
        fi

        # Clippy: Rust's linter - catches common mistakes and anti-patterns
        # SKIP_CLIPPY allows skipping in CI if clippy is slow or has false positives
        if [ "${SKIP_CLIPPY:-false}" != "true" ]; then
            if ! OUTPUT=$(cargo clippy --all-targets -- -D warnings 2>&1); then
                echo -e "${RED}  ✗ cargo clippy failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
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
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ cargo test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ cargo not installed - skipping Rust checks${NC}"
    fi
    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}

run_typescript_checks() {
    local OUTPUT WARNING_COUNT should_run_e2e STRUCTURAL_RE
    local CHECKS_FAILED=0
# TypeScript / JavaScript checks
# Prefers pnpm (faster, disk efficient) but falls back to npm if pnpm unavailable
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " typescript " ]] && [[ "$SCOPE" == "all" || "$SCOPE" == "frontend" || "$SCOPE" == "cli" || "$SCOPE" == "export" || "$SCOPE" == "tooling" || "${HAS_FRONTEND:-false}" == "true" || "${HAS_CLI:-false}" == "true" || "${HAS_EXPORT:-false}" == "true" || "${HAS_TOOLING:-false}" == "true" ]]; then
    echo -e "${BLUE}Running TypeScript/JavaScript checks...${NC}"

    # Check for pnpm first (preferred package manager)
    if command -v pnpm &> /dev/null; then
        # Lint: Runs ESLint or configured linter via "pnpm lint" script
        if [ "${SKIP_LINT:-false}" != "true" ]; then
            if ! OUTPUT=$(pnpm lint 2>&1); then
                echo -e "${RED}  ✗ pnpm lint failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                # Enforce warnings-as-errors policy
                WARNING_COUNT=$(echo "$OUTPUT" | grep -c -E '⚠|warning|Warning' || true)
                if [ "$WARNING_COUNT" -gt "$MAX_ALLOWED_WARNINGS" ]; then
                    echo -e "${RED}  ✗ pnpm lint: $WARNING_COUNT warnings found (max allowed: $MAX_ALLOWED_WARNINGS)${NC}"
                    echo "$OUTPUT" >&2
                    CHECKS_FAILED=1
                else
                    echo -e "${GREEN}  ✓ pnpm lint passed${NC}"
                fi
            fi
        fi

        # Typecheck: Runs tsc --noEmit to verify types without generating JS
        # Catches type errors that might not appear in tests
        if ! OUTPUT=$(pnpm typecheck 2>&1); then
            echo -e "${RED}  ✗ pnpm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm typecheck passed${NC}"
        fi

        # Test-source typecheck: the app project excludes *.test.ts(x) and
        # tests/, so those types were only checked by Vitest's experimental
        # typecheck. Run tsc against tsconfig.test.json for a stable gate
        # (plans/165 "tooling follow-up", plans/176 T4).
        if ! OUTPUT=$(pnpm typecheck:test 2>&1); then
            echo -e "${RED}  ✗ pnpm typecheck:test failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ pnpm typecheck:test passed${NC}"
        fi

        # Tests via SKIP_TESTS env var (useful for CI without test env)
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(pnpm test 2>&1); then
                echo -e "${RED}  ✗ pnpm test failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ pnpm test passed${NC}"
            fi

            # End-to-end suite — but only when the change can actually break
            # composition. Unit tests mount isolated or mocked stores, so a
            # refactor can leave every one of them green while the app no
            # longer boots. That is not hypothetical: a slice default
            # silently overrode the seed state, the chat came up empty, and
            # only CI's E2E job caught it (LESSON-041).
            #
            # Runs when wiring, state ownership, or the app entrypoint changed.
            # SKIP_E2E=true opts out; FORCE_E2E=true runs it unconditionally.
            should_run_e2e=false
            if [ "${FORCE_E2E:-false}" = "true" ]; then
                should_run_e2e=true
            elif [ -n "${MERGE_BASE:-}" ]; then
                # Anchored on BOTH ends: an unanchored tail matched
            # store-coverage.test.ts as well as store.ts, so editing a unit test
            # would drag the whole E2E suite into the local loop.
            # Anchored at BOTH ends: an unanchored tail matched
            # store-coverage.test.ts as well as store.ts, so a unit-test edit
            # would drag the whole E2E suite into the local loop.
            #
            # Any module that can change what the store ACCEPTS or produces
            # belongs here, not just the ones that declare state. A schema or
            # migration change can break first load exactly as surely as a
            # slice-ordering change does.
            STRUCTURAL_RE='^(src/lib/studio/(store|hydration|hydration-quarantine|seed-state|history-snapshot|recovery-helpers|migrations|schema|use-hydrated|indexeddb-backup)\.ts|src/lib/studio/slices/.+\.ts|src/app/layout\.tsx|playwright\.config\.ts|src/components/studio/app-shell\.tsx|src/components/studio/ui/shared-primitives\.tsx|src/components/studio/(sidebar|right-panel|topbar|command-palette|offline-indicator)\.tsx|src/app/(globals\.css|error\.tsx|not-found\.tsx))$'
                if git diff --name-only "$MERGE_BASE" -- 2>/dev/null | grep -qE "$STRUCTURAL_RE"; then
                    should_run_e2e=true
                fi
            fi

            if [ "$should_run_e2e" = "true" ] && [ "${SKIP_E2E:-false}" != "true" ]; then
                echo -e "${BLUE}  Structural change detected — running E2E...${NC}"
                if ! OUTPUT=$(pnpm run test:e2e 2>&1); then
                    echo -e "${RED}  ✗ pnpm run test:e2e failed${NC}"
                    echo "$OUTPUT" >&2
                    CHECKS_FAILED=1
                else
                    echo -e "${GREEN}  ✓ pnpm run test:e2e passed${NC}"
                fi
            fi
        fi
    elif command -v npm &> /dev/null; then
        # Fallback to npm - runs same checks via "npm run <script>" syntax
        if [ "${SKIP_LINT:-false}" != "true" ]; then
            if ! OUTPUT=$(npm run lint 2>&1); then
                echo -e "${RED}  ✗ npm lint failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ npm lint passed${NC}"
            fi
        fi

        if ! OUTPUT=$(npm run typecheck 2>&1); then
            echo -e "${RED}  ✗ npm typecheck failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ npm typecheck passed${NC}"
        fi

        # Test-source typecheck — see the pnpm branch above (plans/165, plans/176 T4)
        if ! OUTPUT=$(npm run typecheck:test 2>&1); then
            echo -e "${RED}  ✗ npm typecheck:test failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ npm typecheck:test passed${NC}"
        fi

        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(npm test 2>&1); then
                echo -e "${RED}  ✗ npm test failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ npm test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ pnpm/npm not installed - skipping TypeScript checks${NC}"
    fi
    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}

run_python_checks() {
    local OUTPUT CHECKS_FAILED=0
# Python checks
# Uses ruff (modern, fast Python linter) and black (strict formatter)
# Falls back to warnings if tools not installed (Python dev tools are optional)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " python " ]] && [[ "$SCOPE" == "all" || "$SCOPE" == "agent" || "${HAS_AGENT:-false}" == "true" ]]; then
    echo -e "${BLUE}Running Python checks...${NC}"

    # ruff: Extremely fast Python linter written in Rust
    # Replaces flake8, pylint with unified, faster tool
    if command -v ruff &> /dev/null; then
        if ! OUTPUT=$(ruff check . 2>&1); then
            echo -e "${RED}  ✗ ruff check failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
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
            CHECKS_FAILED=1
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
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ pytest passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ pytest not installed - skipping Python tests${NC}"
        fi
    fi
    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}

run_go_checks() {
    local OUTPUT CHECKS_FAILED=0
# Go checks
# Standard Go toolchain provides everything needed: gofmt, go vet, go test
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " go " ]] && [[ "$SCOPE" == "all" ]]; then
    echo -e "${BLUE}Running Go checks...${NC}"

    if command -v go &> /dev/null; then
        # gofmt: Standard Go formatter
        # -l lists files that would change (we want empty output = all formatted)
        if ! OUTPUT=$(gofmt -l . 2>&1); then
            echo -e "${RED}  ✗ gofmt found unformatted files${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ gofmt passed${NC}"
        fi

        # go vet: Static analysis tool that catches suspicious constructs
        # ./... means check all packages recursively
        if ! OUTPUT=$(go vet ./... 2>&1); then
            echo -e "${RED}  ✗ go vet failed${NC}"
            echo "$OUTPUT" >&2
            CHECKS_FAILED=1
        else
            echo -e "${GREEN}  ✓ go vet passed${NC}"
        fi

        # Tests: Run all tests in all packages
        if [ "${SKIP_TESTS:-false}" != "true" ]; then
            if ! OUTPUT=$(go test ./... 2>&1); then
                echo -e "${RED}  ✗ go test failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ go test passed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ go not installed - skipping Go checks${NC}"
    fi
    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}

run_shell_checks() {
    local SHELL_SCRIPTS sc_failed script script_base file s
    local CHECKS_FAILED=0
    local -a NEW_UNCOVERED=()
# Shell script checks
# Uses shellcheck (static analysis for bash/sh) and BATS (Bash Automated Testing System)
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " shell " ]] && [[ "$SCOPE" == "all" || "$SCOPE" == "tooling" || "$SCOPE" == "agent" || "${HAS_TOOLING:-false}" == "true" || "${HAS_AGENT:-false}" == "true" ]]; then
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
                # Use -f quiet to reduce output volume in CI environments
                # lint_if_changed handles hashing and caching
                if ! lint_if_changed "$script" "shellcheck" ".shellcheckrc" shellcheck --severity=warning -f quiet "$script" 2>/dev/null; then
                    echo -e "${RED}  ✗ shellcheck failed: $script${NC}"
                    sc_failed=1
                fi
            done <<< "$SHELL_SCRIPTS"

            if [ $sc_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ shellcheck passed${NC}"
            else
                CHECKS_FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ shellcheck not installed - skipping shell checks${NC}"
    fi

    # BATS tests: shell-script regression suite in tests/*.bats (TAP-compliant).
    # The suite is mandatory — a missing tests/ directory is a hard failure so
    # CI can never silently skip it.
    # NOTE: Skip if we're already inside a BATS test (prevent recursion)
    if [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
        if [ ! -d "tests" ]; then
            echo -e "${RED}  ✗ tests/ directory missing — BATS suite required for shell scripts${NC}"
            CHECKS_FAILED=1
        elif command -v bats &> /dev/null; then
            if ! OUTPUT=$(bats tests/ 2>&1); then
                echo -e "${RED}  ✗ bats tests failed${NC}"
                echo "$OUTPUT" >&2
                CHECKS_FAILED=1
            else
                echo -e "${GREEN}  ✓ bats tests passed${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ bats not installed - skipping shell tests${NC}"
        fi
    fi

    # BATS coverage pairing: every new top-level scripts/*.sh added in
    # this PR must have matching tests/<name>.bats or be referenced from
    # an existing test, so new scripts always ship with regression tests.
    if [ "${CHANGED_ONLY:-false}" = true ] && [ -n "${MERGE_BASE:-}" ]; then
        NEW_UNCOVERED=()
        while IFS= read -r file; do
            [ -n "$file" ] || continue
            [[ "$file" == scripts/*.sh ]] || continue
            [[ "$file" == scripts/lib/* ]] && continue
            script_base=$(basename "$file" .sh)
            if [ -f "tests/$script_base.bats" ]; then continue; fi
            if grep -rlq "$file" tests/*.bats 2>/dev/null; then continue; fi
            NEW_UNCOVERED+=("$file")
        done < <(git diff --diff-filter=A --name-only "$MERGE_BASE" -- 'scripts/*.sh' 2>/dev/null || true)
        if [ "${#NEW_UNCOVERED[@]}" -gt 0 ]; then
            echo -e "${RED}  ✗ new shell scripts missing BATS coverage:${NC}"
            for s in "${NEW_UNCOVERED[@]}"; do
                echo -e "${RED}    $s (add tests/$(basename "$s" .sh).bats)${NC}"
            done
            CHECKS_FAILED=1
        elif git diff --diff-filter=A --name-only "$MERGE_BASE" -- 'scripts/*.sh' 2>/dev/null | grep -q .; then
            echo -e "${GREEN}  ✓ new shell scripts have BATS coverage${NC}"
        fi
    fi

    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}

run_markdown_checks() {
    local OUTPUT MARKDOWNLINT_CMD MD_FILES md_failed md_file
    local CHECKS_FAILED=0
# Markdown checks (if markdownlint is available)
# markdownlint enforces consistent Markdown style across the repo
if [[ " ${DETECTED_LANGUAGES[*]} " =~ " markdown " ]] && [[ "$SCOPE" == "all" || "$SCOPE" == "docs" || "$SCOPE" == "agent" || "${HAS_DOCS:-false}" == "true" || "${HAS_AGENT:-false}" == "true" ]]; then
    echo -e "${BLUE}Running Markdown checks...${NC}"

    MARKDOWNLINT_CMD=""
    if command -v markdownlint &> /dev/null; then
        MARKDOWNLINT_CMD="markdownlint"
    elif [ -x "$REPO_ROOT/node_modules/.bin/markdownlint" ]; then
        MARKDOWNLINT_CMD="$REPO_ROOT/node_modules/.bin/markdownlint"
    fi

    if [ -n "$MARKDOWNLINT_CMD" ]; then
        # The file list comes from git, so ignored build output (playwright
        # reports, test results, coverage) and dependencies are excluded by the
        # repository's own .gitignore rather than by a hand-maintained
        # denylist. See list_markdown_files above.
        MD_FILES=$(list_markdown_files)
        if [ -n "$MD_FILES" ]; then
            md_failed=0
            while IFS= read -r md_file; do
                [ -n "$md_file" ] || continue
                # A tracked file deleted from the working tree but not yet
                # staged as deleted is still listed by git. markdownlint
                # cannot read it, so skip it rather than spawning the linter
                # on a path that does not exist.
                [ -f "$md_file" ] || continue
                # lint_if_changed handles hashing and caching
                # lint_if_changed's third argument is only hashed into the cache
                # key (see scripts/lib/lint_cache.sh) — it is NOT appended to the
                # command. markdownlint does not discover a TOML config, so without
                # the explicit --config the gate linted with stock rules and failed
                # correct documents (MD013/MD025) on any machine where markdownlint
                # is installed (plans/164 §3.1).
                if ! OUTPUT=$(lint_if_changed "$md_file" "markdownlint" "markdownlint.toml" \
                    "$MARKDOWNLINT_CMD" --config markdownlint.toml "$md_file" 2>&1); then
                    echo -e "${RED}  ✗ markdownlint failed: $md_file${NC}"
                    echo "$OUTPUT" >&2
                    md_failed=1
                fi
            done <<< "$MD_FILES"

            if [ $md_failed -eq 0 ]; then
                echo -e "${GREEN}  ✓ markdownlint passed${NC}"
            else
                CHECKS_FAILED=1
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠ markdownlint not installed - skipping markdown checks${NC}"
    fi
    echo ""
fi
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        return 0
    fi
    return 1
}
run_language_checks() {
    local checks_failed=0
    run_rust_checks || checks_failed=1
    run_typescript_checks || checks_failed=1
    run_python_checks || checks_failed=1
    run_go_checks || checks_failed=1
    run_shell_checks || checks_failed=1
    run_markdown_checks || checks_failed=1

    if [ "$checks_failed" -eq 0 ]; then
        return 0
    fi
    return 1
}
