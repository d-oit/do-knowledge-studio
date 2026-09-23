#!/usr/bin/env bash
# tests/quality-gate-scope.bats — BATS tests for `quality_gate.sh --changed`.
#
# Covers the base-ref resolution and change-set detection introduced in
# plans/147: the gate must diff from the merge base of the branch (not from its
# tip), must fall back to the commit that just landed when the tip *is* the
# default branch, and must run the full gate when it cannot determine a base at
# all rather than reporting success for unchecked work.
#
# Each test runs the gate in a throwaway git repository that holds a copy of the
# script, its lint cache library, and stub validators, so only scope detection is
# exercised. The gate skips its own BATS suite when BATS_TEST_FILENAME is set.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/quality_gate.sh"
  export LIB_DIR="$BATS_TEST_DIRNAME/../scripts/lib"
}

# Build a repository with the gate script, its lint cache library, stub
# validators, and one base commit on `trunk`. Stubs keep the always-on
# validators (git hooks, skills, links) from reaching into the real checkout.
make_repo() {
  local dir="$1"
  local stub

  mkdir -p "$dir/scripts/lib"
  cp "$SCRIPT" "$dir/scripts/quality_gate.sh"
  cp "$LIB_DIR/lint_cache.sh" "$dir/scripts/lib/lint_cache.sh"
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

# Run the gate inside a prepared repository, with extra env assignments.
run_gate() {
  local dir="$1"
  shift
  run env SKIP_TESTS=true "$@" bash "$dir/scripts/quality_gate.sh" --changed
}

@test "checks the whole branch, not just its tip" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    git checkout -q -b feature
    printf '#!/usr/bin/env bash\necho helper\n' >scripts/helper.sh
    printf '#!/usr/bin/env bats\n' >tests/helper.bats
    git add -A
    git commit -qm "fix(tooling): add helper"
    printf 'notes\n' >plans/note.md
    git add -A
    git commit -qm "docs: trailing note"
  )

  run_gate "$repo" QUALITY_GATE_BASE_REF=trunk
  [ "$status" -eq 0 ]
  [[ "$output" == *"Base: trunk"* ]]
  # The tip only touches plans/, so a tip-only diff would skip the shell section.
  [[ "$output" == *"Running Shell script checks"* ]]
}

@test "checks the commit that landed when the tip is the default branch" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    printf '#!/usr/bin/env bash\necho landed\n' >scripts/landed.sh
    printf '#!/usr/bin/env bats\n' >tests/landed.bats
    git add -A
    git commit -qm "fix(tooling): land helper on trunk"
  )

  run_gate "$repo" QUALITY_GATE_BASE_REF=trunk
  [ "$status" -eq 0 ]
  [[ "$output" == *"Base: trunk"* ]]
  [[ "$output" == *"Running Shell script checks"* ]]
}

@test "honours an explicit base ref override" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    git checkout -q -b feature
    printf '#!/usr/bin/env bash\necho helper\n' >scripts/helper.sh
    printf '#!/usr/bin/env bats\n' >tests/helper.bats
    git add -A
    git commit -qm "fix(tooling): add helper"
    printf 'notes\n' >plans/note.md
    git add -A
    git commit -qm "docs: trailing note"
  )

  # Diffing from the tip only sees plans/, so the shell section must not run.
  run_gate "$repo" QUALITY_GATE_BASE_REF=HEAD~1
  [ "$status" -eq 0 ]
  [[ "$output" == *"Base: HEAD~1"* ]]
  [[ "$output" != *"Running Shell script checks"* ]]
}

@test "runs the full gate when no base ref resolves" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    git checkout -q -b feature
    printf 'export const widget = 1\n' >src/widget.ts
    git add -A
    git commit -qm "feat: widget"
  )

  # The repository's only branch is `trunk`, so none of the candidates exist.
  run env -u QUALITY_GATE_BASE_REF -u GITHUB_BASE_REF SKIP_TESTS=true \
    bash "$repo/scripts/quality_gate.sh" --changed
  [ "$status" -eq 0 ]
  [[ "$output" == *"No base ref found"* ]]
  [[ "$output" == *"Running quality gate (Scope: all)"* ]]
  [[ "$output" != *"No changes detected."* ]]
}

@test "keeps an explicit scope when the base cannot be resolved" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    git checkout -q -b feature
    printf 'export const widget = 1\n' >src/widget.ts
    git add -A
    git commit -qm "feat: widget"
  )

  run env -u QUALITY_GATE_BASE_REF -u GITHUB_BASE_REF SKIP_TESTS=true \
    bash "$repo/scripts/quality_gate.sh" --changed --scope frontend
  [ "$status" -eq 0 ]
  [[ "$output" == *"No base ref found"* ]]
  # Widening to `all` would ignore the scope the caller asked for.
  [[ "$output" == *"Running quality gate (Scope: frontend)"* ]]
  [[ "$output" != *"Running quality gate (Scope: all)"* ]]
}

@test "flags new shell scripts without BATS coverage from anywhere on the branch" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"
  (
    cd "$repo" || exit 1
    git checkout -q -b feature
    printf '#!/usr/bin/env bash\necho uncovered\n' >scripts/uncovered.sh
    git add -A
    git commit -qm "fix(tooling): add uncovered script"
    printf 'notes\n' >plans/note.md
    git add -A
    git commit -qm "docs: trailing note"
  )

  run_gate "$repo" QUALITY_GATE_BASE_REF=trunk
  [ "$status" -eq 2 ]
  [[ "$output" == *"new shell scripts missing BATS coverage"* ]]
  [[ "$output" == *"scripts/uncovered.sh"* ]]
}

@test "reports no changes only when there is nothing to diff" {
  local repo="$BATS_TEST_TMPDIR/repo"
  make_repo "$repo"

  # A single-commit repository whose tip is the base: no parent to fall back to.
  run_gate "$repo" QUALITY_GATE_BASE_REF=trunk
  [ "$status" -eq 0 ]
  [[ "$output" == *"No changes detected."* ]]
}
