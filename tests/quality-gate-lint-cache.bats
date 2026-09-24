#!/usr/bin/env bash
# tests/quality-gate-lint-cache.bats — the gate must stay truthful without its lint cache.
#
# `quality_gate.sh` sources `scripts/lib/lint_cache.sh` to skip unchanged files.
# When that library is absent the sourcing block used to leave `lint_if_changed`
# undefined, so every call failed as `command not found` and the gate reported
# "<linter> failed: <file>" for every file — a false failure whose cause was
# invisible (the shellcheck call discards stderr). The gate now falls back to
# running the linter directly and warns once (plans/147 §4.1).
#
# The linters themselves are stubs on PATH, so the tests are independent of
# whether shellcheck/markdownlint are installed and of their versions.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/quality_gate.sh"
  export LIB_DIR="$BATS_TEST_DIRNAME/../scripts/lib"
}

# Build a repository with the gate script, stub validators, and one base commit
# on `trunk` — deliberately without scripts/lib/lint_cache.sh.
make_repo() {
  local dir="$1"
  local stub

  mkdir -p "$dir/scripts/lib"
  cp "$SCRIPT" "$dir/scripts/quality_gate.sh"
  for stub in validate-git-hooks validate-skills validate-links \
    validate-github-actions-shas validate-package-manager; do
    printf '#!/usr/bin/env bash\nexit 0\n' >"$dir/scripts/$stub.sh"
    chmod +x "$dir/scripts/$stub.sh"
  done

  (
    cd "$dir" || exit 1
    git init -q -b trunk .
    git config user.email "quality-gate-test@example.com"
    git config user.name "Quality Gate Test"
    git config commit.gpgsign false
    mkdir -p src plans tests
    printf 'export const base = 1\n' >src/base.ts
    git add -A
    git commit -qm "base commit"
  )
}

# Put a stub linter on PATH. `exit_code` 0 fakes a clean file, 1 a finding.
stub_linter() {
  local dir="$1"
  local name="$2"
  local exit_code="$3"

  mkdir -p "$dir"
  printf '#!/usr/bin/env bash\nexit %s\n' "$exit_code" >"$dir/$name"
  chmod +x "$dir/$name"
}

# A commit that touches a shell script, so `--changed` selects the shell scope.
add_shell_change() {
  local dir="$1"

  (
    cd "$dir" || exit 1
    printf '#!/usr/bin/env bash\necho helper\n' >scripts/helper.sh
    printf '#!/usr/bin/env bats\n' >tests/helper.bats
    git add -A
    git commit -qm "fix(tooling): add helper"
  )
}

@test "warns and lints directly when the lint cache library is missing" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  add_shell_change "$repo"
  stub_linter "$bins" shellcheck 0

  run env PATH="$bins:$PATH" SKIP_TESTS=true QUALITY_GATE_BASE_REF=HEAD~1 \
    bash "$repo/scripts/quality_gate.sh" --changed

  [ "$status" -eq 0 ]
  [[ "$output" == *"lint_cache.sh is missing"* ]]
  [[ "$output" == *"Running Shell script checks"* ]]
  # The defect: every file reported as a lint failure because the helper was
  # undefined rather than because the linter objected.
  [[ "$output" != *"shellcheck failed"* ]]
  [[ "$output" == *"shellcheck passed"* ]]
}

@test "still fails on a real lint finding when the lint cache library is missing" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  add_shell_change "$repo"
  stub_linter "$bins" shellcheck 1

  run env PATH="$bins:$PATH" SKIP_TESTS=true QUALITY_GATE_BASE_REF=HEAD~1 \
    bash "$repo/scripts/quality_gate.sh" --changed

  # Fail-soft must not become fail-open: a finding still fails the gate.
  [ "$status" -eq 2 ]
  [[ "$output" == *"shellcheck failed"* ]]
  [[ "$output" == *"scripts/helper.sh"* ]]
}

@test "stays quiet when the lint cache library is present" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  cp "$LIB_DIR/lint_cache.sh" "$repo/scripts/lib/lint_cache.sh"
  add_shell_change "$repo"
  stub_linter "$bins" shellcheck 0

  run env PATH="$bins:$PATH" SKIP_TESTS=true QUALITY_GATE_BASE_REF=HEAD~1 \
    bash "$repo/scripts/quality_gate.sh" --changed

  [ "$status" -eq 0 ]
  [[ "$output" != *"lint_cache.sh is missing"* ]]
  [[ "$output" == *"shellcheck passed"* ]]
}
