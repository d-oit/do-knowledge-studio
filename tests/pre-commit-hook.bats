#!/usr/bin/env bats
# tests/pre-commit-hook.bats — behavior tests for .githooks/pre-commit (#1143).
#
# - Docs-only commits run markdownlint + links only (no typecheck/tests).
# - Code commits delegate to quality_gate.sh --fast --changed.
# - Staged node_modules entries and root tmp-*/debug-* files are refused.
# - The staged count is the file count, not the string length (dead-husky bug).
#
# Each test builds a throwaway repo with the real hook and stub validators.

bats_require_minimum_version 1.5.0

setup() {
  export REPO="$BATS_TEST_TMPDIR/hook-repo"
  rm -rf "$REPO"
  mkdir -p "$REPO/.githooks" "$REPO/scripts" "$REPO/plans"
  cp "$BATS_TEST_DIRNAME/../.githooks/pre-commit" "$REPO/.githooks/pre-commit"
  chmod +x "$REPO/.githooks/pre-commit"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$REPO/scripts/validate-links.sh"
  chmod +x "$REPO/scripts/validate-links.sh"
  printf '#!/usr/bin/env bash\necho "QUALITY_GATE_CALLED $*" >> "$REPO/gate-calls.log"\nexit 0\n' > "$REPO/scripts/quality_gate.sh"
  chmod +x "$REPO/scripts/quality_gate.sh"
  printf '#!/usr/bin/env bash\necho "MARKDOWNLINT_CALLED $*" >> "$REPO/lint-calls.log"\nexit 0\n' > "$REPO/node-markdownlint"
  chmod +x "$REPO/node-markdownlint"
  (
    cd "$REPO" || exit 1
    git init -q -b main .
    git config user.email "hook-test@example.com"
    git config user.name "Hook Test"
    git config commit.gpgsign false
    git commit -q --allow-empty -m "init"
  )
}

run_hook() {
  run env -C "$REPO" PATH="$REPO:$PATH" bash "$REPO/.githooks/pre-commit"
}

@test "empty staging area passes without running checks" {
  run_hook
  [ "$status" -eq 0 ]
  [[ "$output" == *"No staged files"* ]]
  [ ! -f "$REPO/gate-calls.log" ]
}

@test "docs-only commit runs markdownlint and links, not the quality gate" {
  echo "# hello" > "$REPO/plans/note.md"
  git -C "$REPO" add plans/note.md
  # Stub markdownlint on PATH so the hook finds it.
  mkdir -p "$REPO/bin"
  printf '#!/usr/bin/env bash\necho "MARKDOWNLINT_CALLED $*" >> "$REPO/lint-calls.log"\nexit 0\n' > "$REPO/bin/markdownlint"
  chmod +x "$REPO/bin/markdownlint"

  run env -C "$REPO" PATH="$REPO/bin:$PATH" bash "$REPO/.githooks/pre-commit"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Docs-only commit"* ]]
  [ -f "$REPO/lint-calls.log" ]
  [ ! -f "$REPO/gate-calls.log" ]
}

@test "code commit delegates to the scoped quality gate" {
  printf 'export const x = 1\n' > "$REPO/src.ts"
  git -C "$REPO" add src.ts

  run_hook
  [ "$status" -eq 0 ]
  grep -q -- "--fast --changed" "$REPO/gate-calls.log"
}

@test "staged node_modules entry is refused" {
  mkdir -p "$REPO/node_modules"
  echo "x" > "$REPO/node_modules/evil.js"
  git -C "$REPO" add -f node_modules/evil.js

  run_hook
  [ "$status" -ne 0 ]
  [[ "$output" == *"node_modules"* ]]
  [ ! -f "$REPO/gate-calls.log" ]
}

@test "staged root tmp file is refused" {
  echo "x" > "$REPO/tmp-scratch.md"
  git -C "$REPO" add tmp-scratch.md

  run_hook
  [ "$status" -ne 0 ]
  [[ "$output" == *"placement rules"* ]]
}

@test "staged count is the file count, not the string length" {
  echo "# a" > "$REPO/plans/a.md"
  echo "# b" > "$REPO/plans/b.md"
  git -C "$REPO" add plans/a.md plans/b.md
  mkdir -p "$REPO/bin"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$REPO/bin/markdownlint"
  chmod +x "$REPO/bin/markdownlint"

  run env -C "$REPO" PATH="$REPO/bin:$PATH" bash "$REPO/.githooks/pre-commit"
  [ "$status" -eq 0 ]
  # Two short paths: the old ${#STAGED_FILES} bug would print a larger number.
  [[ "$output" == *"Checking 2 staged file(s)"* ]]
}
