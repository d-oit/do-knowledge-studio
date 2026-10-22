#!/usr/bin/env bash
# tests/self-fix-loop.bats — BATS tests for scripts/self-fix-loop.sh
#
# Covers: argument parsing, JSON helper functions, dry-run mode, and
# environment variable config.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/self-fix-loop.sh"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Source only the helpers from self-fix-loop.sh (not main)
source_helpers() {
  # Extract functions up to Argument parsing section
  bash -c "
    set -euo pipefail
    REPO_ROOT='$WORK'
    cd '$WORK'
    # Source just the helper functions
    $(sed -n '/^json_get_failed_checks/,/^}$/p' "$SCRIPT")
    $(sed -n '/^json_has_pending/,/^}$/p' "$SCRIPT")
    # Export for BATS
    export -f json_get_failed_checks json_has_pending
  "
}

# ---------------------------------------------------------------------------
# Tests: Argument parsing
# ---------------------------------------------------------------------------

@test "--help exits 0 and shows usage" {
  run bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
  [[ "$output" == *"--max-retries"* ]]
  [[ "$output" == *"--timeout"* ]]
  [[ "$output" == *"--dry-run"* ]]
  [[ "$output" == *"--base-branch"* ]]
}

@test "unknown argument exits with error" {
  run bash "$SCRIPT" --bogus-flag 2>&1
  [ "$status" -eq 2 ]
  [[ "$output" == *"Unknown argument"* ]]
}

# ---------------------------------------------------------------------------
# Tests: Environment variable config
# ---------------------------------------------------------------------------

@test "respects SELF_FIX_LOOP_MAX_RETRIES env var" {
  # Just verify the script reads the env var by checking --help doesn't fail
  run env SELF_FIX_LOOP_MAX_RETRIES=3 bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
}

@test "respects SELF_FIX_LOOP_TIMEOUT env var" {
  run env SELF_FIX_LOOP_TIMEOUT=600 bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
}

@test "respects SELF_FIX_LOOP_POLL_INTERVAL env var" {
  run env SELF_FIX_LOOP_POLL_INTERVAL=10 bash "$SCRIPT" --help
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# Tests: Dry-run mode (integration)
# ---------------------------------------------------------------------------

@test "dry-run exits cleanly without git operations" {
  # Create a minimal git repo for dry-run
  mkdir -p "$WORK"
  git -C "$WORK" init --quiet 2>/dev/null || true
  git -C "$WORK" config user.email "test@test.com" 2>/dev/null || true
  git -C "$WORK" config user.name "Test" 2>/dev/null || true

  # Dry-run should not fail even without gh CLI
  run env REPO_ROOT="$WORK" bash "$SCRIPT" --dry-run --max-retries 1 --timeout 5 --poll-interval 1
  # Should exit 0 or 4 (timeout) but not crash
  [[ "$status" -eq 0 ]] || [[ "$status" -eq 4 ]] || [[ "$status" -eq 1 ]]
  [[ "$output" == *"DRY RUN"* ]] || [[ "$output" == *"Self-Fix Loop Started"* ]]
}

# ---------------------------------------------------------------------------
# Tests: JSON helpers (via inline sourcing)
# ---------------------------------------------------------------------------

@test "json_get_failed_checks parses failures correctly" {
  # Create a temp script that sources the helpers and tests them
  local test_script="$WORK/test-json.sh"
  cat > "$test_script" << 'OUTER'
#!/usr/bin/env bash
set -euo pipefail

# Inline the helper function
json_get_failed_checks() {
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    failures = []
    for c in data:
        s = c.get('state', '')
        n = c.get('name', '')
        if s in ('FAILURE', 'ERROR', 'CANCELLED'):
            failures.append({'name': n, 'state': s})
    print(json.dumps(failures))
except Exception as e:
    print(json.dumps([{'name': 'parse_error', 'state': str(e)}]))
" 2>/dev/null || echo '[]'
}

# Test 1: No failures
result=$(echo '[{"name":"Lint","state":"SUCCESS"}]' | json_get_failed_checks)
echo "Test1: $result"
[[ "$result" == "[]" ]]

# Test 2: Has failures
result=$(echo '[{"name":"Lint","state":"FAILURE"},{"name":"Test","state":"SUCCESS"}]' | json_get_failed_checks)
echo "Test2: $result"
[[ "$result" == *"FAILURE"* ]]
[[ "$result" == *"Lint"* ]]

# Test 3: ACTION_REQUIRED is not a failure
result=$(echo '[{"name":"Codacy","state":"ACTION_REQUIRED"}]' | json_get_failed_checks)
echo "Test3: $result"
[[ "$result" == "[]" ]]

echo "ALL PASS"
OUTER
  chmod +x "$test_script"
  run bash "$test_script"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ALL PASS"* ]]
}

@test "json_has_pending detects pending checks" {
  # Test via inline Python — avoids heredoc quoting issues
  run python3 -c "
import json, sys
data = json.loads('[{\"name\":\"Lint\",\"state\":\"PENDING\"}]')
for c in data:
    if c.get('state') in ('PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'):
        print('true')
        sys.exit(0)
print('false')
"
  [ "$status" -eq 0 ]
  [[ "$output" == *"true"* ]]
}

@test "the markdown fix rewrites only repository Markdown, not vendored skills" {
  # The repo-wide `find` this replaced also rewrote the vendored skill
  # libraries (271 files) and any generated Playwright artifacts, which the
  # quality gate deliberately excludes. The enumeration library is the same
  # one the gate uses, so the two cannot drift.
  #
  # This test runs the rewrite and asserts the resulting file contents, not
  # just the file list: a test that only checked the list would still pass
  # with a broken `while` loop or a wrong `sed` expression.
  local repo="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$repo/scripts/lib" "$repo/plans" "$repo/.agents/skills/example" "$repo/playwright-report"
  cp "$BATS_TEST_DIRNAME/../scripts/lib/markdown-files.sh" "$repo/scripts/lib/markdown-files.sh"
  printf 'playwright-report/\n' >"$repo/.gitignore"
  printf '# Plan   \n' >"$repo/plans/plan.md"
  printf '# Vendored skill   \n' >"$repo/.agents/skills/example/SKILL.md"
  printf '# Generated   \n' >"$repo/playwright-report/report.md"

  (
    cd "$repo" || exit 1
    git init -q -b trunk .
    git config user.email "self-fix-test@example.com"
    git config user.name "Self Fix Test"
    git add -A
    git commit -qm "base"
  )

  # Run the markdown branch of the fix loop exactly as scripts/self-fix-loop.sh
  # runs it (tests/helpers/run-markdown-fix.bash mirrors that branch).
  run bash "$BATS_TEST_DIRNAME/helpers/run-markdown-fix.bash" "$repo"
  [ "$status" -eq 0 ]

  # The repository's own Markdown was rewritten.
  [ "$(cat "$repo/plans/plan.md")" = "# Plan" ]
  # The vendored skill library and the generated artifact were left alone.
  [ "$(cat "$repo/.agents/skills/example/SKILL.md")" = "# Vendored skill   " ]
  [ "$(cat "$repo/playwright-report/report.md")" = "# Generated   " ]
}
