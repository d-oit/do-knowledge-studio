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

# --- End-to-end verify.sh gate tests -------------------------------
#
# These stub every heavy tool (shellcheck, pnpm, yamllint, bats) with fast
# no-ops so the full gate runs in well under a second. The shellcheck stub's
# exit code is controlled per test to exercise both gate outcomes.

VERIFY_SH="$BATS_TEST_DIRNAME/../scripts/verify.sh"

setup_verify_stubs() {
  STUB_DIR="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$STUB_DIR"
  for cmd in pnpm yamllint bats; do
    printf '#!/usr/bin/env bash\nexit 0\n' >"$STUB_DIR/$cmd"
    chmod +x "$STUB_DIR/$cmd"
  done
  printf '#!/usr/bin/env bash\nexit %s\n' "${STUB_SHELLCHECK_EXIT:-0}" \
    >"$STUB_DIR/shellcheck"
  chmod +x "$STUB_DIR/shellcheck"
}

@test "verify.sh exits 1 and reports when a check fails" {
  STUB_SHELLCHECK_EXIT=1
  setup_verify_stubs

  run env PATH="$STUB_DIR:$PATH" bash "$VERIFY_SH"

  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ Shell Lint (BATS) failed"* ]]
  [[ "$output" == *"Verification failed."* ]]
  # The gate must keep running the remaining checks after a failure.
  [[ "$output" == *"✓ Shell Tests (BATS) passed"* ]]
}

@test "verify.sh exits 0 when every check passes" {
  STUB_SHELLCHECK_EXIT=0
  setup_verify_stubs

  run env PATH="$STUB_DIR:$PATH" bash "$VERIFY_SH"

  [ "$status" -eq 0 ]
  [[ "$output" == *"✓ Shell Lint (BATS) passed"* ]]
  [[ "$output" == *"✓ Shell Lint (CI parity) passed"* ]]
  [[ "$output" == *"All checks passed."* ]]
}
