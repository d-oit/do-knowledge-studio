#!/usr/bin/env bats
# Regression coverage for the language-check library used by quality_gate.sh.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/quality_gate.sh"
  export LIB="$BATS_TEST_DIRNAME/../scripts/lib/language-checks.sh"
}

@test "a language check failure accumulates without skipping later checks" {
  local bin="$BATS_TEST_TMPDIR/bin"
  local calls="$BATS_TEST_TMPDIR/calls"
  mkdir -p "$bin"
  cat >"$bin/cargo" <<'CARGO'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CARGO_CALLS"
if [[ "$1" == "clippy" ]]; then
  echo "injected clippy failure" >&2
  exit 1
fi
CARGO
  chmod +x "$bin/cargo"

  run env PATH="$bin:$PATH" CARGO_CALLS="$calls" bash -c '
    source "$1"
    DETECTED_LANGUAGES=(rust)
    SCOPE=all
    HAS_TOOLING=false
    FAILED=0
    MAX_ALLOWED_WARNINGS=0
    SKIP_CLIPPY=false
    SKIP_TESTS=false
    RED= GREEN= YELLOW= BLUE= NC=
    if ! run_language_checks; then FAILED=1; fi
    printf "FAILED=%s\n" "$FAILED"
  ' language-checks "$LIB"

  [[ "$output" == *"cargo clippy failed"* ]]
  [[ "$output" == *"cargo test passed"* ]]
  [[ "$output" == *"FAILED=1"* ]]
  [ "$(cat "$calls")" = "$(printf 'fmt --check\nclippy --all-targets -- -D warnings\ntest --lib')" ]
}

@test "scope exclusions prevent unrelated language commands" {
  local bin="$BATS_TEST_TMPDIR/bin"
  local calls="$BATS_TEST_TMPDIR/calls"
  mkdir -p "$bin"
  cat >"$bin/cargo" <<'CARGO'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CARGO_CALLS"
CARGO
  chmod +x "$bin/cargo"

  run env PATH="$bin:$PATH" CARGO_CALLS="$calls" bash -c '
    source "$1"
    DETECTED_LANGUAGES=(rust)
    SCOPE=docs
    HAS_TOOLING=false
    FAILED=0
    MAX_ALLOWED_WARNINGS=0
    RED= GREEN= YELLOW= BLUE= NC=
    if ! run_language_checks; then FAILED=1; fi
    printf "FAILED=%s\n" "$FAILED"
  ' language-checks "$LIB"

  [[ "$output" == *"FAILED=0"* ]]
  [ ! -s "$calls" ]
}

@test "the quality gate fails closed if its language-check library is missing" {
  local repo="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$repo/scripts/lib"
  cp "$SCRIPT" "$repo/scripts/quality_gate.sh"

  run bash "$repo/scripts/quality_gate.sh" --help

  [ "$status" -eq 2 ]
  [[ "$output" == *"language-checks.sh is missing or unreadable"* ]]
}

@test "the shell gate runs the BATS suite from tests/" {
  # The gate must actually invoke the suite, with tests/ as its target — a
  # static assertion on the script's text cannot tell whether it ever runs.
  local repo="$BATS_TEST_TMPDIR/repo"
  local bin="$BATS_TEST_TMPDIR/bin"
  local calls="$BATS_TEST_TMPDIR/bats-calls"
  mkdir -p "$repo/tests" "$bin"
  cat >"$bin/bats" <<'BATS_STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$BATS_CALLS"
BATS_STUB
  chmod +x "$bin/bats"

  run env PATH="$bin:$PATH" BATS_CALLS="$calls" REPO_ROOT="$repo" bash -c '
    cd "$REPO_ROOT" || exit 1
    source "$1"
    DETECTED_LANGUAGES=(shell)
    SCOPE=all
    HAS_TOOLING=false
    HAS_AGENT=false
    SKIP_TESTS=false
    CHANGED_ONLY=false
    RED= GREEN= YELLOW= BLUE= NC=
    lint_if_changed() { shift 3; "$@"; }
    unset BATS_TEST_FILENAME
    if run_shell_checks; then
      echo "shell checks passed"
    else
      echo "shell checks failed"
      exit 1
    fi
  ' _ "$LIB"

  [ "$status" -eq 0 ]
  [ "$(cat "$calls")" = "tests/" ]
}

@test "the shell gate fails when its BATS test directory is missing" {
  local repo="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$repo"

  run env REPO_ROOT="$repo" bash -c '
    cd "$REPO_ROOT" || exit 1
    source "$1"
    DETECTED_LANGUAGES=(shell)
    SCOPE=all
    HAS_TOOLING=false
    HAS_AGENT=false
    SKIP_TESTS=false
    CHANGED_ONLY=false
    RED= GREEN= YELLOW= BLUE= NC=
    lint_if_changed() { shift 3; "$@"; }
    unset BATS_TEST_FILENAME
    if run_shell_checks; then
      echo "shell checks unexpectedly passed"
      exit 1
    fi
  ' _ "$LIB"

  [ "$status" -eq 0 ]
  [[ "$output" == *"tests/ directory missing"* ]]
}
