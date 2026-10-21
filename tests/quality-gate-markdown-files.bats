#!/usr/bin/env bash
# tests/quality-gate-markdown-files.bats — BATS tests for the Markdown file
# enumeration in `quality_gate.sh`.
#
# The gate used to enumerate Markdown with `find` plus a hand-maintained
# denylist of excluded directories. Every ignored output directory the
# repository gained later was a hole in that list: running the e2e suite left
# `playwright-report/` and `test-results/` behind, each holding generated
# Markdown, and the next gate run linted Playwright's own artifacts and
# failed on them (plans/180).
#
# Enumeration now asks git, which already knows what the repository ignores.
# These tests pin the two properties that matter:
#
#   * ignored build output is never linted, and
#   * a genuine Markdown finding — in a tracked file *or* in an untracked one —
#     still fails the gate.
#
# The linter is stubbed so the tests do not depend on markdownlint being
# installed or on its version.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/quality_gate.sh"
  export LIB_DIR="$BATS_TEST_DIRNAME/../scripts/lib"
}

# Build a repository with the gate script, its lint cache library, and stub
# validators, so only the Markdown enumeration is exercised.
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
    # The output directories the e2e suite writes, ignored as they are in the
    # real repository.
    printf 'playwright-report/\ntest-results/\ncoverage/\n' >.gitignore
    mkdir -p src plans tests
    printf 'export const base = 1\n' >src/base.ts
    printf '# Plan\n\nBody.\n' >plans/plan.md
    git add -A
    git commit -qm "base commit"
  )
}

# Put a stub linter on PATH. `exit_code` 0 fakes a clean file, 1 a finding.
# The stub records the paths it was asked to lint, so a test can assert on
# the file list itself rather than on whatever the gate echoes.
stub_linter() {
  local dir="$1"
  local name="$2"
  local exit_code="$3"

  mkdir -p "$dir"
  cat >"$dir/$name" <<STUB
#!/usr/bin/env bash
printf '%s\n' "\$@" >> "$dir/$name.seen"
exit $exit_code
STUB
  chmod +x "$dir/$name"
}

# Write generated Markdown into an ignored output directory.
write_ignored_artifacts() {
  local dir="$1"

  mkdir -p "$dir/playwright-report/data" "$dir/test-results/run"
  printf '# Generated\n\nno trailing newline' >"$dir/playwright-report/data/report.md"
  printf '# Context\n\nno trailing newline' >"$dir/test-results/run/error-context.md"
}

run_gate() {
  local repo="$1"
  shift
  run env SKIP_TESTS=true "$@" bash "$repo/scripts/quality_gate.sh"
}

@test "does not lint Markdown inside ignored output directories" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  write_ignored_artifacts "$repo"
  stub_linter "$bins" markdownlint 0

  run_gate "$repo" PATH="$bins:$PATH"

  [ "$status" -eq 0 ]
  [[ "$output" == *"markdownlint passed"* ]]
  # The generated artifacts must never reach the linter.
  [ -f "$bins/markdownlint.seen" ]
  run grep -q "playwright-report" "$bins/markdownlint.seen"
  [ "$status" -ne 0 ]
  run grep -q "test-results" "$bins/markdownlint.seen"
  [ "$status" -ne 0 ]
}

@test "fails on a genuine finding in a tracked Markdown file" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  stub_linter "$bins" markdownlint 1

  run_gate "$repo" PATH="$bins:$PATH"

  # Enumeration must not become fail-open: a finding still fails the gate.
  [ "$status" -eq 2 ]
  [[ "$output" == *"markdownlint failed"* ]]
  [[ "$output" == *"plans/plan.md"* ]]
}

@test "fails on a finding in an untracked Markdown file" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  stub_linter "$bins" markdownlint 1
  (
    cd "$repo" || exit 1
    printf '# Draft\n' >plans/draft.md
  )

  run_gate "$repo" PATH="$bins:$PATH"

  # A file written but not yet committed is still work in progress, and the
  # gate must check it rather than skip it.
  [ "$status" -eq 2 ]
  [[ "$output" == *"markdownlint failed"* ]]
  [[ "$output" == *"plans/draft.md"* ]]
}

@test "ignores vendor agent and skill library Markdown" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  stub_linter "$bins" markdownlint 1
  (
    cd "$repo" || exit 1
    mkdir -p .agents/skills/example
    printf '# Vendored skill\n' >.agents/skills/example/SKILL.md
    git add -A
    git commit -qm "chore: add vendored skill"
  )

  run_gate "$repo" PATH="$bins:$PATH"

  # The vendored prose is not this project's prose; the gate has always
  # excluded it and must keep doing so.
  [ -f "$bins/markdownlint.seen" ]
  run grep -q "\.agents/skills/example/SKILL.md" "$bins/markdownlint.seen"
  [ "$status" -ne 0 ]
}

@test "still reports a finding when an ignored artifact sits beside a broken file" {
  local repo="$BATS_TEST_TMPDIR/repo"
  local bins="$BATS_TEST_TMPDIR/bin"
  make_repo "$repo"
  write_ignored_artifacts "$repo"
  stub_linter "$bins" markdownlint 1

  run_gate "$repo" PATH="$bins:$PATH"

  # The ignored artifacts must not be linted, but the real file must still
  # fail: the exclusion may not swallow the whole run.
  [ "$status" -eq 2 ]
  [[ "$output" == *"markdownlint failed"* ]]
  [[ "$output" == *"plans/plan.md"* ]]
  run grep -q "playwright-report" "$bins/markdownlint.seen"
  [ "$status" -ne 0 ]
  run grep -q "test-results" "$bins/markdownlint.seen"
  [ "$status" -ne 0 ]
}
