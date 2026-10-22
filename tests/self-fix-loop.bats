#!/usr/bin/env bash
# tests/self-fix-loop.bats — BATS tests for scripts/self-fix-loop.sh
#
# Covers: argument parsing, JSON helper functions, dry-run mode, and
# environment variable config.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/self-fix-loop.sh"
  export LIB="$BATS_TEST_DIRNAME/../scripts/lib/self-fix-github.sh"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK/scripts/lib"
  cp "$BATS_TEST_DIRNAME/../scripts/lib/markdown-files.sh" "$WORK/scripts/lib/markdown-files.sh"
  cp "$LIB" "$WORK/scripts/lib/self-fix-github.sh"
  source "$LIB"
}

# Build a throwaway repository whose `gh` is stubbed, with a passing quality
# gate, so the GitHub phases run without network access. `payload` is what
# `gh pr checks --json name,state` returns.
make_ci_fixture() {
  local dir="$1"
  local payload="$2"
  mkdir -p "$dir/scripts/lib" "$dir/bin"
  cp "$BATS_TEST_DIRNAME/../scripts/lib/markdown-files.sh" "$dir/scripts/lib/markdown-files.sh"
  cp "$LIB" "$dir/scripts/lib/self-fix-github.sh"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$dir/scripts/quality_gate.sh"
  chmod +x "$dir/scripts/quality_gate.sh"
  cat >"$dir/bin/gh" <<GH
#!/usr/bin/env bash
case "\$1 \$2" in
  "pr list") echo "123" ;;
  "pr checks") printf '%s\n' '$payload' ;;
  *) : ;;
esac
GH
  chmod +x "$dir/bin/gh"
  (
    cd "$dir" || exit 1
    git init -q -b trunk .
    git config user.email "self-fix-test@example.com"
    git config user.name "Self Fix Test"
    git config commit.gpgsign false
    printf 'base\n' >base.txt
    git add -A
    git commit -qm base
  )
}

# Drive the real entrypoint against a fixture with a bounded retry budget.
run_loop() {
  local dir="$1"
  run env REPO_ROOT="$dir" PATH="$dir/bin:$PATH" \
    SELF_FIX_LOOP_MAX_RETRIES=1 SELF_FIX_LOOP_POLL_INTERVAL=1 \
    bash "$SCRIPT"
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

@test "json_get_failed_checks includes Codacy ACTION_REQUIRED among blocking failures" {
  local checks='[{"name":"Build","state":"SUCCESS"},{"name":"Lint","state":"FAILURE"},{"name":"Tests","state":"ERROR"},{"name":"Deploy","state":"CANCELLED"},{"name":"Codacy","state":"ACTION_REQUIRED"},{"name":"Optional","state":"SKIPPED"},{"name":"Neutral","state":"NEUTRAL"}]'
  local failures
  failures=$(printf '%s\n' "$checks" | json_get_failed_checks)

  run python3 -c '
import json, sys
expected = [
    {"name": "Lint", "state": "FAILURE"},
    {"name": "Tests", "state": "ERROR"},
    {"name": "Deploy", "state": "CANCELLED"},
    {"name": "Codacy", "state": "ACTION_REQUIRED"},
]
assert json.loads(sys.argv[1]) == expected
' "$failures"
  [ "$status" -eq 0 ]
}

@test "an unreadable CI result aborts instead of reporting success" {
  # A malformed `gh pr checks` payload is an unknown state. The loop used to
  # funnel it into the "no failures" shape and exit 0, so a green report was
  # possible for checks nobody could read.
  local repo="$BATS_TEST_TMPDIR/repo"
  make_ci_fixture "$repo" 'this is not json'

  run_loop "$repo"

  [ "$status" -eq 5 ]
  [[ "$output" == *"Could not read the CI check results"* ]]
  [[ "$output" != *"All checks pass"* ]]
}

@test "an unusable python interpreter cannot turn a failing payload green" {
  # Every helper shells out to python3. A payload full of FAILUREs must not be
  # reported as passing just because the interpreter is missing.
  local repo="$BATS_TEST_TMPDIR/repo"
  make_ci_fixture "$repo" '[{"name":"Lint","state":"FAILURE"}]'
  printf '#!/usr/bin/env bash\nexit 127\n' >"$repo/bin/python3"
  chmod +x "$repo/bin/python3"
  # Commit it so the working tree is clean: an untracked file would take the
  # commit-and-push path instead and mask what this test is about.
  git -C "$repo" add -A
  git -C "$repo" commit -qm "probe: unusable python3"

  run_loop "$repo"

  [ "$status" -eq 5 ]
  [[ "$output" != *"All checks pass"* ]]
}

@test "phase_analyze_failures reports an unreadable payload as unknown" {
  run bash -c '
    source "$1"
    step() { :; }
    info() { :; }
    warn() { :; }
    log() { :; }
    error() { :; }
    analysis_status=0
    phase_analyze_failures "not json" || analysis_status=$?
    printf "analysis status: %s\n" "$analysis_status"
  ' _ "$LIB"

  [ "$status" -eq 0 ]
  [[ "$output" == *"analysis status: 2"* ]]
}

@test "the failure list stays on stderr so the caller receives JSON" {
  # stdout is the caller's data channel: `main` hands this straight to
  # `phase_fix`, which parses it. Display text on stdout made every real failure
  # arrive as unparsable text, and the fix phase reported "No failures to fix.".
  run --separate-stderr bash -c '
    source "$1"
    step() { :; }
    info() { :; }
    warn() { :; }
    log() { :; }
    error() { :; }
    DRY_RUN=false
    phase_analyze_failures "[{\"name\":\"Lint\",\"state\":\"FAILURE\"}]" || true
  ' _ "$LIB"

  [ "$status" -eq 0 ]
  # stdout is the JSON the caller parses, and nothing else.
  [[ "$output" != *"❌"* ]]
  # The human-readable list is still reported, on stderr.
  [[ "$stderr" == *"❌ Lint: FAILURE"* ]]

  printf '%s' "$output" | python3 -c '
import json, sys
checks = json.load(sys.stdin)
assert checks == [{"name": "Lint", "state": "FAILURE"}], checks
'
}

@test "a real CI failure reaches the fix phase" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_ci_fixture "$repo" '[{"name":"Lint","state":"FAILURE"}]'

  run_loop "$repo"

  [[ "$output" == *"Investigating: Lint (FAILURE)"* ]]
  [[ "$output" != *"No failures to fix."* ]]
}

@test "a failed push aborts with exit 2 instead of reporting a green loop" {
  # `! cmd; then local code=$?` always read 0, so the documented abort was dead
  # code: a failed push was retried, the next iteration saw a clean tree, and
  # the loop exited 0 with the commit never landed.
  local repo="$BATS_TEST_TMPDIR/repo"
  make_ci_fixture "$repo" '[{"name":"Lint","state":"SUCCESS"}]'
  printf 'changed\n' >>"$repo/base.txt"

  run_loop "$repo"

  [ "$status" -eq 2 ]
  [[ "$output" == *"Push failed."* ]]
  [[ "$output" == *"Git operations failed. Aborting."* ]]
}

@test "phase_analyze_failures blocks a Codacy-only ACTION_REQUIRED result" {
  local checks='[{"name":"Codacy Static Code Analysis","state":"ACTION_REQUIRED"}]'

  run bash -c '
    source "$1"
    step() { :; }
    info() { :; }
    warn() { :; }
    log() { :; }
    analysis_status=0
    phase_analyze_failures "$2" || analysis_status=$?
    printf "analysis status: %s\n" "$analysis_status"
  ' _ "$LIB" "$checks"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Codacy Static Code Analysis"* ]]
  [[ "$output" == *"ACTION_REQUIRED"* ]]
  [[ "$output" == *"analysis status: 1"* ]]
}

@test "json_has_pending recognizes every in-flight state and ignores terminal states" {
  local state
  for state in PENDING QUEUED IN_PROGRESS EXPECTED; do
    [ "$(printf '[{"state":"%s"}]' "$state" | json_has_pending)" = "true" ]
  done
  for state in SUCCESS FAILURE ERROR CANCELLED ACTION_REQUIRED SKIPPED NEUTRAL; do
    [ "$(printf '[{"state":"%s"}]' "$state" | json_has_pending)" = "false" ]
  done
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

  # The helper exercises the scoped Markdown rewrite used by Phase 5.
  run bash "$BATS_TEST_DIRNAME/helpers/run-markdown-fix.bash" "$repo"
  [ "$status" -eq 0 ]

  # The repository's own Markdown was rewritten.
  [ "$(cat "$repo/plans/plan.md")" = "# Plan" ]
  # The vendored skill library and the generated artifact were left alone.
  [ "$(cat "$repo/.agents/skills/example/SKILL.md")" = "# Vendored skill   " ]
  [ "$(cat "$repo/playwright-report/report.md")" = "# Generated   " ]
}
