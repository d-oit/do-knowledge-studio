# Lessons Learned

Catalog of technical discoveries, debugging resolutions, and process improvements for the AI agent template.

## Format

Each lesson follows a dual-write pattern for both human readability and agent discovery:

1. **Verbose Entry (this file)**: Detailed debugging log and onboarding resource.
   - Sequential numbering (LESSON-001, LESSON-002, etc.)
   - Date and component tags
   - Issue/Symptoms/Root Cause/Solution/Prevention structure
2. **Distilled Insight (nearest AGENTS.md)**: 1–3 line note for runtime agent loading.
   - Placed in the `AGENTS.md` file closest to the affected code (e.g., `scripts/AGENTS.md`).
   - Focuses on the non-obvious core finding.

For machine-readable index, see `lessons.jsonl`.

---

### LESSON-001: Bash Exit Code 2 - Misuse of Shell Builtins in CI

**Date**: 2026-04-01
**Component**: CI/CD / Bash Scripts / Quality Gate
**Severity**: High

**Issue**: Quality Gate CI job fails with exit code 2 in GitHub Actions while passing locally.

**Symptoms**:
- `Process completed with exit code 2` in CI only
- Same script passes on developer machines
- Validate Skills job passes, Quality Gate fails
- No visible error output before exit

**Root Cause**:
1. **Exit Code 2 Meaning**: "Misuse of shell builtins" per Bash documentation - indicates empty function definitions, missing keywords, permission problems, or builtin misuse
2. **`set -e` is unreliable**: Has "extremely convoluted and version-dependent behavior" per BashFAQ/105
3. **Functions behave differently**: `set -e` is effectively ignored inside functions called in conditionals
4. **`realpath --relative-to` is GNU-specific**: Not available in minimal CI containers (Alpine, etc.)
5. **TTY/Color Detection**: `test -t 1` returns true locally, false in non-TTY CI

**Solution**:
```bash
# Don't use set -e - it's unreliable in CI
set -uo pipefail

# Use readlink -f for portability instead of realpath --relative-to
target=$(readlink -f "$link" 2>/dev/null || echo "")

# Safe color detection
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
else
    RED=''
fi

# Track failures explicitly
EXIT_CODE=0
run_check() { ... ; EXIT_CODE=1; }
exit $EXIT_CODE
```

**Prevention**:
- Test scripts in non-TTY mode: `bash script.sh | cat`
- Avoid GNU-specific options like `realpath --relative-to`
- Never rely on `set -e` for CI scripts
- Use explicit error tracking with EXIT_CODE variables
- Document CI-specific behavior in skill references

**Files Modified**:
- `scripts/validate-skills.sh` - Fixed set -e and realpath issues
- `scripts/quality_gate.sh` - Fixed set -e and color handling
- `.github/workflows/ci-and-labels.yml` - Added debug output

---

### LESSON-002: AGENTS.md Line Limit Violation - Progressive Disclosure Principle

**Date**: 2026-04-02
**Component**: Documentation / Architecture / AGENTS.md
**Severity**: Medium

**Issue**: AGENTS.md grew to 278 lines, exceeding the 150-line target for progressive disclosure.

**Symptoms**:
- Document contains detailed workflow explanations
- Language-specific code examples duplicated from skills
- Extensive troubleshooting sections inline
- Hard to scan for essential information

**Root Cause**:
1. **Scope creep**: Added detailed content instead of references
2. **No enforcement**: Line limit documented but not checked automatically
3. **Duplication**: Content existed in both AGENTS.md and skills

**Solution**:
1. **Line Count Reduction** (278 → 146 lines):
   - Moved detailed workflows → `agents-docs/HARNESS.md`
   - Moved language examples → skill `references/` folders
   - Moved troubleshooting → individual skill docs
   - Kept in AGENTS.md: constants, overview, setup, quality gate commands, style rules, security warnings, agent guidance principles, skills table, reference links

2. **Created specialized skills**:
   - `agents-md` skill (96 lines): AGENTS.md creation guidance
   - `code-quality` skill (124 lines): Code patterns and linting tools
   - `test-runner` skill (160 lines): Framework commands and testing strategy

3. **Reference naming standardization**:
   - Standardized on `references/` (plural) across all skills
   - Migrated 13 skills from `references/` → `references/`

4. **Centralized configuration**:
   - Created `.agents/config.sh` with named constants and utility functions
   - Single source of truth for MAX_LINES_PER_SOURCE_FILE, etc.

**Prevention**:
- Add validation in `validate-skills.sh` to check AGENTS.md line count
- Document the "250-line rule" prominently in skill creation docs
- Use `@agents-docs/` references instead of inline content
- Review AGENTS.md size during PR review

**Files Modified**:
- `AGENTS.md` - Reduced from 278 to 146 lines
- `.agents/skills/agents-md/SKILL.md` - Created
- `.agents/skills/code-quality/SKILL.md` - Created
- `.agents/skills/test-runner/SKILL.md` - Created
- `.agents/config.sh` - Created with centralized constants
- 13 skills migrated: `references/` → `references/`

---

### LESSON-999: ESLint v9 + Vite 8 Rolldown Migration (2026-04-30)

**Date**: 2026-04-30
**Component**: ESLint / Vite / Vitest / Playwright / Root Files
**Severity**: Medium

**Issue**: Project used deprecated ESLint v8 config (`.eslintrc.cjs`), Vite 8 `manualChunks` (Rollup API), and `happy-dom` for Vitest.

**Symptoms**:
- `@eslint/js@10` requires ESLint v10 — conflicts with ESLint v9
- `eslint-plugin-react-hooks@4.x` has peer conflicts with ESLint v9
- Vite 8 uses Rolldown — `build.rollupOptions` + `manualChunks` are deprecated
- `PHASES.md` in root violates AGENTS.md "Markdown is NOT canonical truth"
- Multiple `gh` accounts cause 403 on push — need `gh auth switch`

**Root Cause**:
1. **ESLint v9 flat config**: Legacy `.eslintrc.cjs` format deprecated in v9+
2. **Vite 8 Rolldown**: Replaces Rollup; `manualChunks` → `codeSplitting.groups`
3. **Package versioning**: `@eslint/js@10` needs ESLint v10, not v9 — pin to `@eslint/js@^9`
4. **React hooks plugin**: v4.x has peer `eslint@^3-8`; v5.x required for ESLint v9
5. **Markdown in root**: `PHASES.md` violates project rule — must be in `docs/`

**Solution**:
```bash
# Fix package versions
npm install --save-dev @eslint/js@^9 eslint-plugin-react-hooks@5.2.0 --legacy-peer-deps

# ESLint flat config (eslint.config.js)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
// ... plugins, rules

# Vite 8 Rolldown config
build: {
  rolldownOptions: {
    output: {
      codeSplitting: { groups: [{ name: 'vendor-graph', test: /sigma/ }, ...] }
    }
  }
}

# Vitest jsdom
environment: 'jsdom', setupFiles: ['src/test/setup.ts']

# Playwright tuning
timeout: 30000, outputDir: 'test-results'
```

**Prevention**:
- Pin `@eslint/js@^9` (not `^10`) when using ESLint v9
- Use `eslint-plugin-react-hooks@5.x` with ESLint v9
- Vite 8: use `rolldownOptions` + `codeSplitting.groups`
- Markdown docs in `docs/` only (never root)
- Check `gh auth status` before push with multiple accounts

**Files Modified**:
- `eslint.config.js` (new), deleted `.eslintrc.cjs`
- `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- `src/test/setup.ts` (new), `docs/PHASES.md` (moved)
- `AGENTS.md`, `README.md`, `plans/2026-best-practices-audit.md`

---

### LESSON-003: Skill Malformed JSON - Invalid evals.json Syntax

**Date**: 2026-04-04
**Component**: Skills / Evaluations / skill-creator
**Severity**: Critical

**Issue**: `skill-creator/evals/evals.json` contains malformed JSON that breaks skill evaluation.

**Symptoms**:
- Eval ID 4 missing closing brace before ID 5
- JSON parser fails on skill evaluation
- Silent failures in skill testing
- Other skills may have similar issues

**Root Cause**:
1. **No JSON Schema validation**: `skill-rules.json` and `evals.json` lack schema enforcement
2. **Manual editing**: JSON files edited without validation
3. **No CI check**: Quality gate doesn't validate JSON structure

**Solution**:
1. **Immediate fix**: Add missing closing brace in skill-creator evals.json
2. **Schema validation**: Create JSON Schema for `evals.json` and `skill-rules.json`
3. **CI enforcement**: Add validation step to quality gate
4. **Automated checking**: Add pre-commit hook for JSON validation

**Prevention**:
- Never edit evals.json manually without validation
- Use `jq` to validate JSON before committing: `cat evals.json | jq empty`
- Add JSON Schema validation in `validate-skills.sh`
- CI check for all skill metadata files

**Files Modified**:
- `.agents/skills/skill-creator/evals/evals.json` - Fixed JSON syntax
- Schema validation to be added to quality gate

---

### LESSON-004: Atomic Commit Workflow Zero Test Coverage

**Date**: 2026-04-04
**Component**: Testing / atomic-commit / Scripts
**Severity**: Critical

**Issue**: The entire atomic commit workflow (2,835 lines across 8 scripts) has ZERO test coverage.

**Symptoms**:
- 8 scripts in `scripts/atomic-commit/` completely untested
- Rollback mechanisms not validated
- GitHub CLI integration (`gh` commands) not mocked
- Retry logic with exponential backoff untested
- Polling mechanisms not validated
- Secret detection patterns not tested against sample data

**Root Cause**:
1. **Complex mocking required**: `gh` and `git` commands need sophisticated mocks
2. **Integration complexity**: Multi-phase workflow hard to test in isolation
3. **No test framework setup**: BATS not fully integrated in CI
4. **CI disables tests**: `SKIP_TESTS=true` in workflow

**Solution**:
1. **Create BATS test suite** for all atomic-commit scripts
2. **Mock infrastructure**: Create mock `gh` and `git` commands for testing
3. **Phase-based testing**: Test each phase independently
4. **Integration tests**: Full workflow with temporary git repositories
5. **Enable tests in CI**: Remove `SKIP_TESTS=true`

**Prevention**:
- Every script >50 lines must have tests
- Mock external dependencies (gh, git, API calls)
- Property-based testing for validation logic
- Test coverage reporting with kcov/bashcov

**Files to Test**:
- `scripts/atomic-commit/run.sh` (285 lines)
- `scripts/atomic-commit/atomic-commit.sh` (569 lines)
- `scripts/atomic-commit/pre-commit-check.sh` (439 lines)
- `scripts/atomic-commit/create-pr.sh` (556 lines)
- `scripts/atomic-commit/sync-and-push.sh` (523 lines)
- `scripts/atomic-commit/verify-checks.sh` (463 lines)

---

### LESSON-005: GitHub Actions SKIP_TESTS - Tests Disabled in CI

**Date**: 2026-04-04
**Component**: CI/CD / Testing / GitHub Actions
**Severity**: Critical

**Issue**: CI workflow explicitly disables all testing with `SKIP_TESTS=true`.

**Symptoms**:
- Quality gate runs but skips test execution
- BATS framework not installed or executed
- Python tests skipped conditionally
- No test result reporting (JUnit/SARIF)
- Code changes not validated

**Root Cause**:
1. **Historical workaround**: Tests were failing so they were disabled
2. **No test infrastructure**: BATS not properly set up in CI
3. **Fear of blocking**: Tests might fail so CI skips them

**Solution**:
1. **Remove `SKIP_TESTS=true`** from `.github/workflows/ci-and-labels.yml`
2. **Install BATS in CI**: Add setup step for test framework
3. **Run all tests**: BATS and Python tests must pass
4. **Add coverage reporting**: Track coverage over time
5. **Fix failing tests**: Address pre-existing test failures

**Prevention**:
- Tests must pass for PR merge
- Pre-commit hooks run tests locally
- CI tests identical to local tests
- Coverage gates in CI (e.g., must maintain 80% coverage)

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Remove SKIP_TESTS, add test execution

---

### LESSON-006: Skill Evaluation Gaps - Insufficient Edge Case Coverage

**Date**: 2026-04-04
**Component**: Skills / Evaluations / Coverage
**Severity**: High

**Issue**: 80% of skills (24 of 30) lack comprehensive edge case evaluations.

**Symptoms**:
- Skills with <5 evals (6 skills, 20%)
- No error handling evals (18 skills, 60%)
- No integration scenarios between skills
- Subjective assertions in evals ("feels natural", "can understand")
- No negative test cases (failure paths)

**Root Cause**:
1. **Focus on happy path**: Evals only test success scenarios
2. **No eval guidance**: AVAILABLE_SKILLS.md lacks evaluation authoring guide
3. **No quality gate**: CI doesn't validate eval coverage
4. **Manual process**: No automation for eval structure

**Solution**:
1. **Add edge case evals** to all skills:
   - parallel-execution: threshold synchronization, failure handling
   - goap-agent: dynamic replanning (only 4 evals currently)
   - testing-strategy: mutation testing (mentioned but not tested)
   - security-code-auditor: Go/Rust/Java-specific tests

2. **Standardize eval format**:
   - Remove subjective assertions
   - Add version field to all evals.json
   - Include negative test cases

3. **Create evals documentation**:
   - Add section to `agents-docs/AVAILABLE_SKILLS.md`
   - Document how to write comprehensive evals

**Prevention**:
- Minimum 5 evals per skill (goap-agent currently fails this)
- At least 1 negative test case per skill
- JSON Schema validation for evals.json
- No subjective assertions (replace with checkable patterns)

**Priority Skills to Fix**:
- skill-creator: Fix malformed JSON, add line limit eval
- parallel-execution: Add threshold sync eval
- testing-strategy: Add mutation testing eval
- security-code-auditor: Add language-specific evals

---

### LESSON-007: Atomic Commit Missing Timeout - Network Operation Hangs

**Date**: 2026-04-04
**Component**: atomic-commit / Git Operations / Timeout
**Severity**: High

**Issue**: Git push retry loop in atomic commit workflow has no timeout; can hang indefinitely.

**Symptoms**:
- CI jobs hang forever on network issues
- No visibility into which operation is stuck
- Resources consumed indefinitely
- Pipeline blocking

**Root Cause**:
1. **No timeout wrapper**: `git push` commands lack timeout
2. **Infinite retry**: Retry loop has no maximum duration
3. **No progress indication**: Hanging operations are silent

**Solution**:
```bash
# Add timeout to all external commands
MAX_OPERATION_SECONDS=300

timeout $MAX_OPERATION_SECONDS git push origin "$branch" || {
    echo "ERROR: Push timed out after ${MAX_OPERATION_SECONDS}s"
    EXIT_CODE=1
}

# Or implement watchdog timer
```

**Prevention**:
- Wrap all network operations with timeout
- Implement exponential backoff with maximum total time
- Add progress logging for long operations
- CI timeout should be shorter than GitHub Actions timeout

**Files Modified**:
- `scripts/atomic-commit/sync-and-push.sh` - Add timeout to git operations

---

### LESSON-008: Agent Override Inconsistency - CLAUDE.md vs GEMINI.md

**Date**: 2026-04-04
**Component**: Documentation / Agent Overrides / CLAUDE.md
**Severity**: Medium

**Issue**: Agent-specific override files have inconsistent content depth and purpose.

**Symptoms**:
- `CLAUDE.md` has substantial content (46 lines)
- `GEMINI.md` is only `@AGENTS.md` (1 line)
- `QWEN.md` is minimal
- Override pattern is unclear
- Content duplication risk

**Root Cause**:
1. **No clear policy**: What can be overridden vs. what must stay in AGENTS.md
2. **Ad hoc additions**: Overrides added without schema
3. **No validation**: No check that overrides follow pattern

**Solution**:
1. **Define override schema** in `agents-docs/AGENT_OVERRIDES.md`:
   - Allowed: CLI-specific settings, tool preferences, timeout overrides
   - Forbidden: Duplicating AGENTS.md content, changing procedures

2. **Standardize minimal pattern**:
   ```markdown
   @AGENTS.md
   
   # Claude-Specific Settings
   - Max output tokens: 8192
   - Preferred diff format: unified
   ```

3. **Add validation**: Check that agent files only contain overrides

**Prevention**:
- Document override hierarchy
- Validate agent-specific files in CI
- Never duplicate AGENTS.md content
- Keep overrides minimal (<20 lines)

**Files Modified**:
- `CLAUDE.md` - Remove shared content, keep only overrides
- `GEMINI.md` - Already correct pattern
- `agents-docs/AGENT_OVERRIDES.md` - Create documentation

---

### LESSON-009: Documentation Sync Duplication - Frontmatter Parsing Logic

**Date**: 2026-04-04
**Component**: Scripts / Documentation / DRY Principle
**Severity**: Medium

**Issue**: `update-agents-md.sh` and `update-agents-registry.sh` implement similar frontmatter parsing logic independently.

**Symptoms**:
- Code duplication between two scripts
- Same regex patterns in multiple places
- Violates DRY principle
- Maintenance burden (fix in 2+ places)

**Root Cause**:
1. **Scripts evolved separately**: No shared library concept
2. **Copy-paste development**: Similar functionality added independently
3. **No abstraction**: Missing shared utility layer

**Solution**:
1. **Create shared library** `scripts/lib/docs-utils.sh`:
   ```bash
   extract_frontmatter_field() { ... }
   generate_markdown_table() { ... }
   update_section_in_file() { ... }
   ```

2. **Refactor scripts** to use library:
   ```bash
   source "$(dirname "$0")/../scripts/lib/docs-utils.sh"
   ```

3. **Add tests** for library functions

**Prevention**:
- Check for duplication during PR review
- Create `scripts/lib/` for shared utilities
- Document library usage in AGENTS.md
- Add ShellCheck for library imports

**Files Modified**:
- `scripts/lib/docs-utils.sh` - Create shared library
- `scripts/update-agents-md.sh` - Refactor to use library
- `scripts/update-agents-registry.sh` - Refactor to use library

---

## Resources

- [BashFAQ/105 - Why set -e doesn't work](https://mywiki.wooledge.org/BashFAQ/105)
- [TLDP Exit Codes](https://tldp.org/LDP/abs/html/exitcodes.html)
- [ShellCheck Wiki](https://github.com/koalaman/shellcheck/wiki/)
- [GitHub Actions Workflow Commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)

## Status

- ✅ LESSON-001 through LESSON-015 documented
- ✅ Root cause analysis complete
- ✅ Solutions implemented or documented
- ✅ CI verified for all recent lessons

---

**Next User Should**:
- Reference specific lesson: `@agents-docs/LESSONS.md#LESSON-001`
- Add new lessons using the template format above
- Update `lessons.jsonl` when adding lessons
- Include Date, Component, Issue, Symptoms, Root Cause, Solution, Prevention

---

### LESSON-010: Git Worktree Cleanup and Registration

**Date**: 2026-04-05
**Component**: Scripts / Worktree Management
**Severity**: Medium

**Issue**: Scripts creating git worktrees leave orphaned directories and administrative data if they crash or are interrupted.

**Symptoms**:
- `git worktree list` shows many unused worktrees
- `fatal: '...' already exists` when running scripts multiple times
- Disk space consumption on long-running development machines

**Root Cause**:
1. **Missing Cleanup Traps**: Scripts didn't use `trap` to ensure cleanup on exit/error
2. **No Central Registration**: No shared array to track created worktrees for bulk cleanup

**Solution**:
```bash
# Register worktrees in a shared array
CREATED_WORKTREES=()
cleanup() {
    for wt in "${CREATED_WORKTREES[@]}"; do
        git worktree remove --force "$wt" 2>/dev/null || true
    done
}
trap cleanup EXIT ERR

# Add to registry when created
git worktree add "$path" "$branch"
CREATED_WORKTREES+=("$path")
```

**Prevention**:
- Use `scripts/lib/worktree-manager.sh` for all worktree operations
- Always register created worktrees in `CREATED_WORKTREES`
- Use the `trap cleanup EXIT ERR` pattern in all stateful scripts

**Files Modified**:
- `scripts/lib/worktree-manager.sh` - Implemented registration and cleanup logic
- `scripts/swarm-worktree-web-research.sh` - Updated to use manager

---

### LESSON-011: CI Reliability - Why Validation Scripts Need `set +e`

**Date**: 2026-04-05
**Component**: CI/CD / Bash Scripts / Quality Gate
**Severity**: Medium

**Issue**: Validation scripts (like `validate-skills.sh`) exit prematurely on the first minor failure, preventing a full report of all issues.

**Symptoms**:
- CI job stops after the first failing skill check
- Developers have to fix one error at a time (whack-a-mole)
- Incomplete validation state in CI logs

**Root Cause**:
1. **Global `set -e`**: Scripts used `set -e` which causes immediate exit on any non-zero return code
2. **Incompatible with Error Accumulation**: Manual error tracking (e.g., `FAILED=1`) is bypassed by `set -e` if a command fails inside a loop

**Solution**:
```bash
# Explicitly disable errexit to allow manual error tracking
set +e
set -uo pipefail

FAILED=0
# ... run checks ...
[[ $something_failed ]] && FAILED=1

# Exit with accumulated status at the end
exit $((FAILED))
```

**Prevention**:
- Use `set +e` in scripts designed to accumulate multiple errors
- Document why `set +e` is used to prevent well-intentioned "fixes" back to `set -e`
- Use explicit `exit` codes based on accumulated `FAILED` variables

**Files Modified**:
- `scripts/validate-skills.sh` - Changed to `set +e` with error tracking
- `scripts/validate-skill-format.sh` - Changed to `set +e`

---

### LESSON-012: Bash Variable Scope - The `temp_table` Issue

**Date**: 2026-04-05
**Component**: Scripts / Bash / Variable Shadowing
**Severity**: Low

**Issue**: Using generic variable names like `temp_table` in scripts causes collisions and unexpected behavior when scripts are sourced or have complex trap logic.

**Symptoms**:
- Temporary files not being cleaned up
- `trap` removing files still in use by other parts of the script
- Data corruption in temporary markdown tables

**Root Cause**:
1. **Global Scope by Default**: Bash variables are global unless declared `local` in a function
2. **Naming Collisions**: Multiple functions or sourced scripts using the same `temp_table` name
3. **Trap Execution Context**: Traps run in the global scope and may see modified or unset variables

**Solution**:
```bash
# Define unique, descriptive names for temporary files
# Use REPO_ROOT and script-specific prefixes
readonly UPDATE_MD_TEMP_TABLE="$REPO_ROOT/.update_md_temp.md"

# Declare before trap to ensure availability
trap 'rm -f "$UPDATE_MD_TEMP_TABLE"' EXIT
```

**Prevention**:
- Use unique prefixes for temporary variables and files
- Use `readonly` where possible for configuration variables
- Define all variables used in `trap` BEFORE the trap is set

**Files Modified**:
- `scripts/update-agents-md.sh` - Refactored `temp_table` usage

---

### LESSON-013: CI Hangs Indefinitely Due to BATS Recursion

**Date**: 2026-04-04
**Component**: CI/CD / BATS Testing / Quality Gate
**Severity**: Critical

**Issue**: Quality Gate job in GitHub Actions hangs for 15+ minutes, never completes, eventually times out after 6 hours.

**Symptoms**:
- Job shows "Run quality gate" step in progress indefinitely
- No output after "Running Shell script checks..."
- Local execution completes in ~60 seconds
- Multiple workflow retries exhibit same behavior

**Root Cause**:
1. **BATS Version Incompatibility**: Ubuntu apt-get installs BATS 1.2.1 (2021), tests use `setup_file()` (requires 1.5+ from 2022)
2. **Infinite Recursion**: `quality_gate.sh` calls `bats tests/` → tests call `quality_gate.sh` → loops forever
3. **Missing Job Timeout**: No `timeout-minutes` specified, defaults to 6 hours
4. **No Recursion Guard**: Script has no mechanism to detect it's already running inside BATS

**Solution**:
```bash
# In quality_gate.sh - add recursion guard
if [ -d "tests" ] && [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
    # Only run BATS if not already inside a BATS test
    bats tests/
fi
```

```yaml
# In workflow - skip BATS in CI and add timeout
quality-gate:
  timeout-minutes: 10
  steps:
    - run: SKIP_TESTS=true ./scripts/quality_gate.sh
```

**Prevention**:
- Always set `timeout-minutes` on CI jobs (fail fast vs 6 hour hang)
- Check for `BATS_TEST_FILENAME` env var before invoking BATS
- Never call parent script from test files without guards
- Use `npm install -g bats` instead of apt-get for current version

**Tags**: #bats #recursion #ci-hang #timeout #testing

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Add timeout, skip BATS
- `scripts/quality_gate.sh` - Add BATS_TEST_FILENAME check

---

### LESSON-014: Shellcheck Warnings vs Errors in CI

**Date**: 2026-04-04
**Component**: CI/CD / Shellcheck / Code Quality
**Severity**: Medium

**Issue**: Shellcheck fails CI build on style warnings (SC2155, SC2034), blocking merges for non-functional issues.

**Symptoms**:
- Shellcheck reports "Declare and assign separately" warnings
- Unused variable warnings (SC2034)
- CI fails even though scripts execute correctly
- 31+ warnings on large scripts like `github-workflow/run.sh`

**Root Cause**:
1. **Style vs Safety**: SC2155 is a style recommendation, not a bug
2. **Strict Default**: Shellcheck exits 1 for any warning by default
3. **Large Scripts**: Complex scripts naturally have unused variables or combined declarations
4. **CI Blocking**: Quality gate treats warnings as failures

**Solution**:
```bash
# Use --severity=error to only fail on actual problems
shellcheck --severity=error -f quiet "$script"

# Alternative: disable specific checks if needed
# shellcheck disable=SC2155,SC2034
```

**Prevention**:
- Use `--severity=error` in CI quality gates
- Reserve warnings for local development
- Document which checks are enforced in AGENTS.md
- Don't let style issues block functional code

**Tags**: #shellcheck #ci #static-analysis #warnings #quality-gate

**Files Modified**:
- `scripts/quality_gate.sh` - Add --severity=error flag

---

### LESSON-015: GitHub API 403 Errors in Generic Templates

**Date**: 2026-04-04
**Component**: CI/CD / GitHub API / Token Permissions
**Severity**: High

**Issue**: CI job fails with "HTTP 403: Resource not accessible by integration" when calling GitHub API.

**Symptoms**:
- `gh label create` or similar commands fail with 403
- Job fails even with `GITHUB_TOKEN` set
- Works locally with personal access token
- Fails in pull requests from forks

**Root Cause**:
1. **Default Token Permissions**: `secrets.GITHUB_TOKEN` has read-only by default for security
2. **Missing Permissions Key**: Workflow didn't explicitly request `issues: write` permission
3. **Operation Requirements**: Creating labels via API requires `issues: write` permission (not just `pull-requests: write`)

**Solution** (Verified Working):
```yaml
# Add explicit permissions at job level
jobs:
  labels:
    runs-on: ubuntu-latest
    permissions:
      issues: write    # Required for creating labels
    steps:
      - run: gh label create "bug" --color d73a4a
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Alternative Approaches**:
- Use Personal Access Token (PAT) with full repo scope (less secure)
- Use GitHub App token (most secure for orgs)
- Pre-create labels manually (simplest for static sets)

**Prevention**:
- Always check GitHub API permission requirements for operations
- Use `permissions:` key to explicitly request needed scopes
- Reference official docs: https://docs.github.com/en/rest/issues/labels
- Test workflows in PR before merging to main

**Tags**: #github-api #permissions #token #issues-write #ci

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Add `permissions: issues: write`

**References**:
- GitHub Actions labeler shows exact permission requirements
- Community Discussion #60820 on 403 errors
- REST API docs: POST /repos/{owner}/{repo}/labels requires issues:write

---

---

### LESSON-016: Dependency Synchronization during Major Upgrades (Vite 8)

**Date**: 2026-04-16
**Component**: Build System / Dependencies
**Severity**: Medium

**Issue**: Upgrading Vite to major version 8 causes peer dependency conflicts and build failures if companion plugins and test runners are not updated in sync.

**Symptoms**:
- `npm install` warnings about peer dependency mismatches for `vite`.
- Test runner (`vitest`) failing to start or reporting incompatible API versions.
- React plugin (`@vitejs/plugin-react`) failing to transform files correctly.

**Root Cause**:
1. **Tight Coupling**: Tools like `vitest` and `@vitejs/plugin-react` have strict peer dependency ranges for `vite`.
2. **Major Version Breaking Changes**: Vite 8 introduces changes that require corresponding logic updates in its ecosystem.
3. **Partial Updates**: Updating only the main `vite` package via a Dependabot PR without its companions.

**Solution**:
Synchronize the upgrade across the entire Vite ecosystem:
- Update `vite` to `^8.0.8`
- Update `@vitejs/plugin-react` to `^6.0.1`
- Update `vitest` to `^4.1.4` (or latest compatible)
- Update `happy-dom` to `^20.9.0` for test environment compatibility

**Prevention**:
- When a Dependabot PR suggests a major version upgrade for a core build tool, check for required companion updates.
- Use `npm info <package> peerDependencies` to verify compatibility ranges.
- Consolidate ecosystem updates into a single atomic commit to keep the CI green.

**Tags**: #vite8 #vitest #dependencies #peer-dependencies #build-tooling

**Files Modified**:
- `package.json` - Synchronized ecosystem upgrade

---

## LESSON-022: Codacy Cloud CLI for PR issue suppression

**Issue**: Codacy Static Code Analysis check blocks PRs with ACTION_REQUIRED status. 91 issues on PR #209 were hard to triage from the web dashboard.

**Root Cause**: No local tooling to query or suppress Codacy Cloud issues programmatically.

**Solution**:
- Install `@codacy/codacy-cloud-cli` via `npm i -g @codacy/codacy-cloud-cli`
- Uses same `~/.codacy/credentials` as `codacy-analysis-cli` (shared auth)
- Query PR issues: `codacy pull-request gh org repo PR# --output json` → contains `newIssues[]` with `resultDataId` (numeric issue ID)
- Suppress: `codacy pull-request gh org repo PR# --ignore-issue <numeric-id> --ignore-reason FalsePositive`
- The Analysis CLI (`@codacy/analysis-cli`) locally runs limited tools (ESLint9, Stylelint, ShellCheck, Trivy, Agentlinter). Most Python/Ruby/Java tools fail locally. Cloud CLI is the primary tool for interacting with Codacy.

**Tags**: #codacy #static-analysis #ci-cd #quality-gate

---

## LESSON-023: Codacy Analysis CLI local limitations

**Issue**: Running `codacy-analysis analyze` locally shows "0 issues" even though Codacy Cloud reports 86+ issues.

**Root Cause**: The local Analysis CLI only supports tools bundled with Node.js or already on PATH. Python (Bandit, Pylint, Prospector, Lizard), Ruby (SQLint), and Java (PMD) tools fail to install or run. The cloud analysis runs many more tools.

**Solution**:
- Always use the Cloud CLI (`codacy pull-request`) to get actual PR issue data
- Local Analysis CLI useful for quick ESLint checks but not a substitute for cloud analysis
- `codacy-analysis init --default` gives the closest config to cloud defaults (61 tools found, 14 added for local)
- Use `--install-dependencies` flag but expect failures for non-JS tools

**Tags**: #codacy #analysis-cli #static-analysis #tooling-gaps

---

## LESSON-024: gitleaks-action v3 requires a paid license

**Issue**: `Security Scan` workflow failed on every PR with
`🛑 missing gitleaks license` (Plan 115). gitleaks-action v3.0.0 enforced
license validation when its owner-lookup API call failed (self-signed
certificate error reaching api.github.com), and no `GITLEAKS_LICENSE`
secret was configured.

**Root Cause**: gitleaks-action v3+ requires a paid `GITLEAKS_LICENSE`
secret; v2.x runs license-free for individual users. The failing license
gate also **masked real scan results** — the old allowlist was never
exercised because the scan never ran.

**Solution**:

- Pinned `gitleaks/gitleaks-action` to v2.3.9
  (`ff98106e4c7b2bc287b24eaf42907196329070c7`) — log confirms
  `No license key is required.`
- After unblocking, re-ran the scan → surfaced **8 false positives**
  (test fixtures, historical test files, doc examples) → extended
  `.gitleaks.toml` allowlist (`test[_-]?api[_-]?key`, `sk-abc123xyz`,
  `BEGIN RSA PRIVATE KEY`, path patterns)
- `workflow_dispatch` scans full git history (`fetch-depth: 0`), so
  deleted files still surface — allowlist by path pattern

**Tags**: #gitleaks #secret-detection #ci-cd #license #allowlist

---

## LESSON-025: yamllint lints block scalars and templates

**Issue**: `YAML Syntax Validation` CI failed on workflow changes that
parsed as valid YAML (PR #640/#641).

**Root Cause**: yamllint applies `line-length` (120 max) and
`new-line-at-end-of-file` rules **inside `run: |` block scalars** and
across `.github/workflow-templates/` files, not just top-level structure.

**Solution**:

- Break long `run:` script lines with backslash continuation; verify
  with `bash -n` on the extracted block
- Ensure trailing newline on every `.yml`/`.yaml`/`.properties.json`
  file: `[ -z "$(tail -c 1 file)" ]`
- Pre-push check: `awk 'length > 120 {print NR": "length}'` on all
  workflow files

**Tags**: #yamllint #github-actions #ci-cd #workflow #linting

---

## LESSON-026: Bot review threads block merges even when checks pass

**Issue**: PRs showed `BLOCKED` with all checks green; the branch rule
`required_review_thread_resolution: true` gates merges on unresolved
review threads, and OwlWatch posts LOW-severity threads on every PR.

**Root Cause**: `mergeStateStatus` reflects review-thread resolution,
not just CI. Unresolved bot threads (owl-watch, DeepSource) block
merges regardless of severity.

**Solution**:

- Before merging, query unresolved threads: GraphQL
  `pullRequest.reviewThreads(isResolved == false)`
- Resolve or address each: `resolveReviewThread(input: {threadId})`
  mutation
- Treat bot threads as merge gates, not noise

**Tags**: #review-threads #github #branch-protection #merge #owl-watch

---

## LESSON-027: New module-scope helpers trigger DeepSource JS-0067 and JS-R1005

**Issue**: PR #647 (BM25 cache refactor) failed the `DeepSource:
JavaScript` check twice in a row. First: `search` hit cyclomatic
complexity 7 (JS-R1005, "medium" risk) after adding a cache `if/else`
inline. Second: the extracted `function getIndex()` was flagged as
JS-0067 ("Unexpected function declaration in the global scope").

**Root Cause**:

- `.deepsource.toml` issue-pattern suppressions did not prevent the
  check from failing on these findings — the code-level fix is the
  only reliable path (and AGENTS.md forbids editing suppression
  config without explicit approval).
- Top-level `function` declarations always trip JS-0067; the project
  convention is `const fn = () => {}` for module-scope helpers
  (already documented in AGENTS.md but easy to miss on new code).

**Solution**:

- Extract cache/index logic into a helper so the exported function
  stays below the complexity threshold (aim < 6).
- Use arrow-function `const` declarations for new module-scope
  helpers — never `function` declarations.
- Run the local quality gate before pushing, but expect DeepSource
  to still surface findings CI-only; plan for one fix cycle.

**Tags**: #deepsource #static-analysis #complexity #github-actions #refactor

## LESSON-028: BLOCKED merge state with all-green checks may hide in-flight runs

**Issue**: PR #652 showed `mergeStateStatus: BLOCKED` while `gh pr checks`
reported every check as SUCCESS. Treating it as staleness too early led to
repeated failed merge attempts. The real blocker was a fresh "Unit Tests"
check run still `in_progress` on the head commit — the nudge commit had
re-triggered CI. After all 36 check runs completed green, the state stayed
BLOCKED — genuine staleness that survived an empty-commit nudge and a
close/reopen, requiring an approved admin merge.

**Root Cause**:

- `gh pr checks` aggregates per-check state and can report stale SUCCESS
  while the head commit has runs still in progress. The check-runs API on
  the head SHA (`commits/{sha}/check-runs`) is the source of truth.
- GitHub merge-state staleness (plans/098) can persist through nudge and
  close/reopen; the ladder ends at `--admin`, which AGENTS.md forbids
  without explicit user approval.

**Prevention**:

- Diagnose BLOCKED in order: ruleset required checks on the head commit,
  review threads, then in-flight check-runs on the head SHA — only then
  declare staleness.
- New `pr-merge-state-diagnoser.yml` workflow posts one idempotent
  comment naming the real blocker (in-flight runs, failures, or
  all-green staleness with the ladder).

**Tags**: #github-actions #merge-state #branch-protection #staleness

## LESSON-029: GitHub ubuntu-latest runners do not ship bats-core

**Issue**: The diagnoser BATS suite (tests/) passed 12/12 locally but had
NEVER executed in CI. `quality_gate.sh` only ran `bats tests/` when the
`tests/` dir existed and bats was installed, otherwise printing a warning
and continuing — and ubuntu-latest images ship shellcheck/yamllint but not
bats. A tests-only PR also failed to set `HAS_TOOLING` in `--changed`
scope, so the whole shell-check block (including BATS) was skipped
silently. The suite was green on every PR without ever running.

**Root Cause**:

- The ubuntu-latest runner image does not include bats-core; a gate that
  warns-and-continues on missing bats silently skips the suite in CI.
- `--changed` scope detection matched `scripts/`, `.github/`, and
  `package.json` for tooling, but not `tests/` — so tests-only changes
  skipped shell checks entirely.
- Bats 1.10 warns (BW02) unless `bats_require_minimum_version 1.5.0` is
  declared; without it, `run ! cmd` does not negate and instead tries to
  execute `!` (status 127).

**Prevention**:

- CI quality-gate and cleanup jobs install bats explicitly
  (`sudo apt-get install -y bats`) before running the gate.
- `quality_gate.sh` now FAILS when `tests/` is missing (never silently
  skips) and treats `^tests/` as tooling scope in `--changed` mode.
- `scripts/verify.sh` gained a "Shell Lint (BATS)" pass
  (`shellcheck --shell=bats -S warning`), which also catches SC2314
  (`!` does not fail a bats test — use `run !` + `bats_require_minimum_version`).

**Tags**: #github-actions #bats #runner-images #quality-gate #ci
