#!/usr/bin/env bats
# tests/check-lint-config-wiring.bats — the wiring check passes on the repo
# and fails on a fixture that drops the --config flag (LESSON-047).

bats_require_minimum_version 1.5.0

SCRIPT="$BATS_TEST_DIRNAME/../scripts/check-lint-config-wiring.mjs"

@test "passes on the wired repo call sites" {
  run node "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"passed"* ]]
}

@test "fails on a fixture that drops the --config flag" {
  local fixture="$BATS_TEST_TMPDIR/unwired.sh"
  cat > "$fixture" <<'EOF'
if ! OUTPUT=$(lint_if_changed "$md_file" "markdownlint" "markdownlint.toml" \
    "$MARKDOWNLINT_CMD" "$md_file" 2>&1); then
    exit 1
fi
EOF

  run node "$SCRIPT" "$fixture"
  [ "$status" -ne 0 ]
  [[ "$output" == *"no --config flag"* ]]
}

@test "allows the shellcheck auto-discovery exception" {
  local fixture="$BATS_TEST_TMPDIR/shell.sh"
  cat > "$fixture" <<'EOF'
if ! lint_if_changed "$script" "shellcheck" ".shellcheckrc" shellcheck -f quiet "$script"; then
    exit 1
fi
EOF

  run node "$SCRIPT" "$fixture"
  [ "$status" -eq 0 ]
}
