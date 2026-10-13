#!/usr/bin/env bats
# tests/check-stale-base-deletions.bats — BATS tests for stale-base detection.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/check-stale-base-deletions.mjs"
  export REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
  cd "$REPO" || return 1
  git init -q -b main .
  git config user.email "stale-base-guard@example.com"
  git config user.name "Stale Base Guard Test"
  git config commit.gpgsign false
  EXPECTED_GUARD_FAILURE_STATUS=1
  EXPECTED_SUCCESS_STATUS=0
  EXPECTED_INVALID_BASE_STATUS=2
  mkdir -p src
  printf 'base\n' > src/app.ts
  git add -A
  git commit -qm "common base"
  git checkout -q -b feature
}

@test "rejects a stale branch missing a file added to the target branch" {
  git checkout -q main
  printf 'added on main\n' > "main added.md"
  git add -A
  git commit -qm "add a target-branch file"

  git checkout -q feature
  printf 'feature work\n' >> src/app.ts
  git add -A
  git commit -qm "feature work on stale base"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_GUARD_FAILURE_STATUS" ]
  [[ "$output" == *"Stale base"* ]]
  [[ "$output" == *'"main added.md"'* ]]
}

@test "accepts a branch created from the current target tip" {
  git checkout -q main
  printf 'added on main\n' > "main added.md"
  git add -A
  git commit -qm "add a target-branch file"

  git checkout -q -b current-feature
  printf 'current feature work\n' >> src/app.ts
  git add -A
  git commit -qm "feature work on current base"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_SUCCESS_STATUS" ]
  [[ "$output" == *"No files added to main since merge base"* ]]
}

@test "ignores files added and removed from the target branch before its tip" {
  git checkout -q main
  printf 'temporary\n' > temporary.txt
  git add -A
  git commit -qm "add temporary file"
  rm temporary.txt
  git add -A
  git commit -qm "remove temporary file"

  git checkout -q feature
  printf 'feature work\n' >> src/app.ts
  git add -A
  git commit -qm "feature work"

  run node "$SCRIPT" main
  [ "$status" -eq "$EXPECTED_SUCCESS_STATUS" ]
}

@test "fails closed when the target ref cannot be compared" {
  run node "$SCRIPT" missing-target
  [ "$status" -eq "$EXPECTED_INVALID_BASE_STATUS" ]
  [[ "$output" == *"Unable to check stale-base deletions"* ]]
}
