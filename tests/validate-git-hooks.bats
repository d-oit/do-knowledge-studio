#!/usr/bin/env bats
# Deterministic checks for the committed hook contents required by quality_gate.sh.

bats_require_minimum_version 1.5.0

setup() {
  export REPO="$BATS_TEST_TMPDIR/repo"
  export VALIDATOR="$BATS_TEST_DIRNAME/../scripts/validate-git-hooks.sh"
  mkdir -p "$REPO/.githooks"
  git -C "$REPO" init --quiet
  write_valid_hooks
  git -C "$REPO" config core.hooksPath .githooks
}

write_valid_hooks() {
  cat > "$REPO/.githooks/pre-commit" <<'HOOK'
#!/usr/bin/env bash
./scripts/minimal_quality_gate.sh
HOOK
  cat > "$REPO/.githooks/commit-msg" <<'HOOK'
#!/usr/bin/env bash
if [ "$HEADER_LEN" -gt 120 ]; then exit 1; fi
if ! echo "$HEADER" | grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|ux)'; then exit 1; fi
HOOK
  chmod +x "$REPO/.githooks/pre-commit" "$REPO/.githooks/commit-msg"
}

run_validator() {
  run env REPO_ROOT="$REPO" bash "$VALIDATOR"
}

@test "accepts committed hooks that contain the required gate checks" {
  run_validator
  [ "$status" -eq 0 ]
  [[ "$output" == *"properly configured"* ]]
}

@test "rejects a committed pre-commit hook that omits the quality gate" {
  printf '#!/usr/bin/env bash\nexit 0\n' > "$REPO/.githooks/pre-commit"
  chmod +x "$REPO/.githooks/pre-commit"

  run_validator
  [ "$status" -ne 0 ]
  [[ "$output" == *"does not run the minimal quality gate"* ]]
}

@test "rejects a committed commit-msg hook that omits required validation" {
  printf '#!/usr/bin/env bash\nexit 0\n' > "$REPO/.githooks/commit-msg"
  chmod +x "$REPO/.githooks/commit-msg"

  run_validator
  [ "$status" -ne 0 ]
  [[ "$output" == *"missing required commit-message validation"* ]]
}
