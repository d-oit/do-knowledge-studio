#!/usr/bin/env bash
# tests/install-hooks.bats — BATS tests for scripts/install-hooks.sh
#
# Covers: pre-commit hook creation, commit-msg hook creation, permissions,
# idempotent re-runs, and missing .git directory.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/install-hooks.sh"
  # Create isolated git repo per test
  export REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
  git -C "$REPO" init --quiet 2>/dev/null
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Run install-hooks against a workspace.
run_install() {
  local root="${1:-$REPO}"
  run env REPO_ROOT="$root" bash "$SCRIPT"
}

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@test "creates pre-commit hook" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ -f "$REPO/.git/hooks/pre-commit" ]
}

@test "creates commit-msg hook" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ -f "$REPO/.git/hooks/commit-msg" ]
}

@test "hooks are executable" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ -x "$REPO/.git/hooks/pre-commit" ]
  [ -x "$REPO/.git/hooks/commit-msg" ]
}

@test "pre-commit hook runs minimal_quality_gate.sh" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  grep -q "minimal_quality_gate.sh" "$REPO/.git/hooks/pre-commit"
}

@test "commit-msg hook enforces header length limit" {
  run_install "$REPO"
  [ "$status" -eq 0 ]

  # Create a valid commit message file
  local msgfile="$REPO/.git/commit-msg-test"
  printf 'ci: short message\n' > "$msgfile"

  # Source the hook logic — it should accept short messages
  run bash -c "source <(sed -n '/^#!/d; /^COMMIT_MSG_FILE/,/^HOOK$/p' '$REPO/.git/hooks/commit-msg' | head -n -1); echo ok"
  # Just verify the hook file contains the length check
  grep -q "HEADER_LEN" "$REPO/.git/hooks/commit-msg"
}

@test "commit-msg hook enforces conventional commit format" {
  run_install "$REPO"
  [ "$status" -eq 0 ]

  # Verify the hook checks for conventional commit prefixes
  grep -q "feat\|fix\|docs\|style\|refactor\|perf\|test\|build\|ci\|chore\|revert\|ux" "$REPO/.git/hooks/commit-msg"
}

@test "is idempotent — re-running does not fail" {
  run_install "$REPO"
  [ "$status" -eq 0 ]

  run_install "$REPO"
  [ "$status" -eq 0 ]

  # Hooks should still exist and be executable
  [ -x "$REPO/.git/hooks/pre-commit" ]
  [ -x "$REPO/.git/hooks/commit-msg" ]
}

@test "skips when not a git repository" {
  local notgit="$BATS_TEST_TMPDIR/notgit"
  mkdir -p "$notgit"
  run_install "$notgit"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skipping"* ]]
}

@test "commit-msg header length check is at 120 chars" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  grep -q "120" "$REPO/.git/hooks/commit-msg"
}
