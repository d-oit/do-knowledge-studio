#!/usr/bin/env bash
# tests/vercel-ignore-build.bats — BATS tests for scripts/vercel-ignore-build.sh
#
# Covers the Vercel "Ignored Build Step" contract: exit 1 builds, exit 0 skips.
# The suite runs against a throwaway git repo so the decisions are deterministic
# and independent of this repository's history.
#
# The two cases worth protecting hardest:
#   * a `scripts/` change MUST build (the precache manifest it generates is
#     served to clients), and
#   * an unknown state MUST build (Vercel clones with --depth=10).

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/vercel-ignore-build.sh"
  export WORK="$BATS_TEST_TMPDIR/repo"

  mkdir -p "$WORK/src" "$WORK/plans" "$WORK/scripts"
  cd "$WORK" || return 1
  git init -q .
  git config user.email "test@example.com"
  git config user.name "test"
  git config commit.gpgsign false

  printf 'export const a = 1\n' > src/app.ts
  printf 'notes\n' > plans/163-sweep.md
  printf '#!/usr/bin/env bash\n' > scripts/quality_gate.sh
  git add -A
  git commit -qm "base"
  export BASE_SHA
  BASE_SHA=$(git rev-parse HEAD)

  printf 'more notes\n' >> plans/163-sweep.md
  git add -A
  git commit -qm "docs only"
  export DOCS_SHA
  DOCS_SHA=$(git rev-parse HEAD)

  printf 'export const b = 2\n' >> src/app.ts
  git add -A
  git commit -qm "app change"
  export APP_SHA
  APP_SHA=$(git rev-parse HEAD)

  printf 'echo gate\n' >> scripts/quality_gate.sh
  git add -A
  git commit -qm "scripts change"
  export SCRIPTS_SHA
  SCRIPTS_SHA=$(git rev-parse HEAD)
}

@test "skips the build when only docs/plans files changed" {
  run env VERCEL_GIT_PREVIOUS_SHA="$BASE_SHA" VERCEL_GIT_COMMIT_SHA="$DOCS_SHA" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"ignoring the build"* ]]
  [[ "$output" == *"plans/163-sweep.md"* ]]
}

@test "builds when application files changed" {
  run env VERCEL_GIT_PREVIOUS_SHA="$DOCS_SHA" VERCEL_GIT_COMMIT_SHA="$APP_SHA" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"building"* ]]
  [[ "$output" == *"src/app.ts"* ]]
}

@test "builds when only scripts/ changed (the precache manifest is served output)" {
  run env VERCEL_GIT_PREVIOUS_SHA="$APP_SHA" VERCEL_GIT_COMMIT_SHA="$SCRIPTS_SHA" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"scripts/quality_gate.sh"* ]]
}

@test "builds when the previous commit is not in the shallow clone" {
  run env VERCEL_GIT_PREVIOUS_SHA="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
    VERCEL_GIT_COMMIT_SHA="$SCRIPTS_SHA" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not in this shallow clone"* ]]
}

@test "builds when Vercel provides no previous commit" {
  run env -u VERCEL_GIT_PREVIOUS_SHA VERCEL_GIT_COMMIT_SHA="$SCRIPTS_SHA" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no VERCEL_GIT_PREVIOUS_SHA"* ]]
}

@test "skips when nothing changed between the two commits" {
  run env VERCEL_GIT_PREVIOUS_SHA="$BASE_SHA" VERCEL_GIT_COMMIT_SHA="$BASE_SHA" bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no changed files"* ]]
}

@test "builds when the current commit is not in the shallow clone" {
  # git diff exits non-zero here; its output must not be read as "nothing changed".
  run env VERCEL_GIT_PREVIOUS_SHA="$BASE_SHA" \
    VERCEL_GIT_COMMIT_SHA="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" bash "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"failed"* ]]
}
