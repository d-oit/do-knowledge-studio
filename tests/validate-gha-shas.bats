#!/usr/bin/env bats
#
# Regression tests for scripts/validate-github-actions-shas.sh.
#
# The script is pure file-parsing (no external CLIs), so tests point it at
# throwaway workflow dirs via the WORKFLOWS_DIR env override.

SCRIPT="$BATS_TEST_DIRNAME/../scripts/validate-github-actions-shas.sh"

VALID_SHA="3d3c42e5aac5ba805825da76410c181273ba90b1"

make_workflow() {
  local dir="$1"
  local content="$2"
  mkdir -p "$dir"
  printf '%s\n' "$content" >"$dir/test.yml"
}

@test "accepts actions pinned to full commit SHAs" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@$VALID_SHA  # v7.0.1"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"properly pinned"* ]]
}

@test "rejects unpinned version tags" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@v4"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"Unpinned action"* ]]
}

@test "rejects all-same-char placeholder SHAs" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"placeholder"* ]]
}

@test "rejects repeating 8-char block placeholder SHAs" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@0123456701234567012345670123456701234567"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"placeholder"* ]]
}

@test "ignores docker:// images and local ./ actions" {
  make_workflow "$BATS_TEST_TMPDIR/wf" "- uses: docker://alpine:3.18
- uses: ./local-action"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"properly pinned"* ]]
}

@test "rejects placeholder SHAs even with inline comments" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # placeholder"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"placeholder"* ]]
}

@test "accepts pinned SHA with inline comment attached directly" {
  make_workflow "$BATS_TEST_TMPDIR/wf" \
    "- uses: actions/checkout@$VALID_SHA#v7.0.1"

  run env WORKFLOWS_DIR="$BATS_TEST_TMPDIR/wf" "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"properly pinned"* ]]
}

@test "validates the real repo workflows are all pinned" {
  run "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"properly pinned"* ]]
}
