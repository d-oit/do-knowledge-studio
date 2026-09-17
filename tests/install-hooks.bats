#!/usr/bin/env bash
# tests/install-hooks.bats — BATS tests for scripts/install-hooks.sh
#
# Since Plan 131 G7 the hooks live in the committed `.githooks/` directory and
# the script only points `core.hooksPath` at it — it no longer copies files
# into `.git/hooks`. Covers: malformed-repo guards, hook activation, idempotent
# re-runs, non-git workspaces, and the behaviour of the committed hooks.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/install-hooks.sh"
  export HOOKS_SRC="$BATS_TEST_DIRNAME/../.githooks"
  # Create isolated git repo per test
  export REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
  git -C "$REPO" init --quiet 2>/dev/null
  make_hooks_dir "$REPO"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Create an executable .githooks/ directory inside the given workspace.
make_hooks_dir() {
  local root="$1"
  mkdir -p "$root/.githooks"
  local hook
  for hook in pre-commit commit-msg; do
    printf '#!/usr/bin/env bash\nexit 0\n' > "$root/.githooks/$hook"
    chmod +x "$root/.githooks/$hook"
  done
}

# Write a commit message file and return its path.
make_commit_msg() {
  local content="$1"
  local msgfile="$BATS_TEST_TMPDIR/commit-msg-input"
  printf '%s\n' "$content" > "$msgfile"
  echo "$msgfile"
}

# Run install-hooks against a workspace.
run_install() {
  local root="${1:-$REPO}"
  run env REPO_ROOT="$root" bash "$SCRIPT"
}

# ---------------------------------------------------------------------------
# Activation
# ---------------------------------------------------------------------------

@test "activates hooks via core.hooksPath" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ "$(git -C "$REPO" config core.hooksPath)" = ".githooks" ]
  [[ "$output" == *"core.hooksPath"* ]]
}

@test "does not copy hook files into .git/hooks" {
  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ ! -e "$REPO/.git/hooks/pre-commit" ]
  [ ! -e "$REPO/.git/hooks/commit-msg" ]
}

@test "is idempotent — re-running does not fail" {
  run_install "$REPO"
  [ "$status" -eq 0 ]

  run_install "$REPO"
  [ "$status" -eq 0 ]
  [ "$(git -C "$REPO" config core.hooksPath)" = ".githooks" ]
}

@test "skips activation when not a git repository" {
  local notgit="$BATS_TEST_TMPDIR/notgit"
  mkdir -p "$notgit"
  make_hooks_dir "$notgit"

  run_install "$notgit"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skipping"* ]]
}

# ---------------------------------------------------------------------------
# Malformed-repository guards
# ---------------------------------------------------------------------------

@test "fails when the .githooks directory is missing" {
  rm -rf "$REPO/.githooks"

  run_install "$REPO"
  [ "$status" -ne 0 ]
  [[ "$output" == *"repository is malformed"* ]]
}

@test "fails when the pre-commit hook is missing" {
  rm "$REPO/.githooks/pre-commit"

  run_install "$REPO"
  [ "$status" -ne 0 ]
  [[ "$output" == *".githooks/pre-commit"* ]]
}

@test "fails when the commit-msg hook is missing" {
  rm "$REPO/.githooks/commit-msg"

  run_install "$REPO"
  [ "$status" -ne 0 ]
  [[ "$output" == *".githooks/commit-msg"* ]]
}

@test "fails when a hook is not executable" {
  chmod -x "$REPO/.githooks/pre-commit"

  run_install "$REPO"
  [ "$status" -ne 0 ]
  [[ "$output" == *"not executable"* ]]
}

# ---------------------------------------------------------------------------
# Committed hooks
# ---------------------------------------------------------------------------

@test "committed hooks are executable" {
  [ -x "$HOOKS_SRC/pre-commit" ]
  [ -x "$HOOKS_SRC/commit-msg" ]
}

@test "committed pre-commit hook runs minimal_quality_gate.sh" {
  grep -q "minimal_quality_gate.sh" "$HOOKS_SRC/pre-commit"
}

@test "committed commit-msg hook accepts a conventional message" {
  local msgfile
  msgfile="$(make_commit_msg 'feat(studio): add a thing')"

  run bash "$HOOKS_SRC/commit-msg" "$msgfile"
  [ "$status" -eq 0 ]
}

@test "committed commit-msg hook rejects a non-conventional message" {
  local msgfile
  msgfile="$(make_commit_msg 'added a thing')"

  run bash "$HOOKS_SRC/commit-msg" "$msgfile"
  [ "$status" -ne 0 ]
  [[ "$output" == *"conventional commits"* ]]
}

@test "committed commit-msg hook accepts a 120-character header" {
  local msgfile
  msgfile="$(make_commit_msg "feat: $(printf 'x%.0s' {1..114})")"

  run bash "$HOOKS_SRC/commit-msg" "$msgfile"
  [ "$status" -eq 0 ]
}

@test "committed commit-msg hook rejects a header longer than 120 characters" {
  local msgfile
  msgfile="$(make_commit_msg "feat: $(printf 'x%.0s' {1..115})")"

  run bash "$HOOKS_SRC/commit-msg" "$msgfile"
  [ "$status" -ne 0 ]
  [[ "$output" == *"too long"* ]]
}
