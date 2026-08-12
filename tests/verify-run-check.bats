#!/usr/bin/env bats
#
# Regression tests for scripts/lib/run-check.sh — the shared run_check
# helper used by scripts/verify.sh.

RUN_CHECK_LIB="$BATS_TEST_DIRNAME/../scripts/lib/run-check.sh"

setup() {
  # shellcheck source=scripts/lib/run-check.sh
  source "$RUN_CHECK_LIB"
}

@test "successful check reports a pass and leaves FAILED at 0" {
  run_check "Fake Check" true >"$BATS_TEST_TMPDIR/out.txt"

  [ "$FAILED" -eq 0 ]
  grep -q "Running Fake Check..." "$BATS_TEST_TMPDIR/out.txt"
  grep -q '✓ Fake Check passed' "$BATS_TEST_TMPDIR/out.txt"
}

@test "failing check reports a failure and sets FAILED=1" {
  run_check "Fake Check" false >"$BATS_TEST_TMPDIR/out.txt"

  [ "$FAILED" -eq 1 ]
  grep -q '✗ Fake Check failed' "$BATS_TEST_TMPDIR/out.txt"
}

@test "failing check returns 0 so set -e callers keep running" {
  run_check "Fake Check" false >/dev/null 2>&1
  rc=$?

  [ "$rc" -eq 0 ]
  [ "$FAILED" -eq 1 ]
}

@test "missing command is treated as a failing check" {
  run_check "Fake Check" nonexistent_command_xyz >/dev/null 2>&1

  [ "$FAILED" -eq 1 ]
}

@test "arguments are passed to the check command verbatim" {
  run_check "Echo" sh -c 'test "$1" = "a b" && test "$2" = "c"' -- 'a b' c >/dev/null

  [ "$FAILED" -eq 0 ]
}

@test "color tokens are defined for callers" {
  [ -n "$RED" ]
  [ -n "$GREEN" ]
  [ -n "$BLUE" ]
  [ -n "$YELLOW" ]
  [ -n "$NC" ]
}

@test "double-sourcing the library is idempotent" {
  FAILED=7
  # shellcheck source=scripts/lib/run-check.sh
  source "$RUN_CHECK_LIB"

  # The guard must not reinitialize FAILED on a second load.
  [ "$FAILED" -eq 7 ]
}
