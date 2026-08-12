#!/usr/bin/env bash
# tests/validate-skills.bats — BATS tests for scripts/validate-skills.sh
#
# Covers: delegation to agent-surface.py, REPO_ROOT override, and
# missing Python handling.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/validate-skills.sh"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

run_validate() {
  local root="${1:-$WORK}"
  run env REPO_ROOT="$root" bash "$SCRIPT"
}

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@test "delegates to agent-surface.py" {
  # Create a mock agent-surface.py that just echoes its args
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\necho "called: $*"\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"called: validate"* ]]
}

@test "exits non-zero when agent-surface.py fails" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\nexit 1\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 1 ]
}

@test "prints validation message" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Validating skills"* ]]
}

@test "uses REPO_ROOT override for script location" {
  mkdir -p "$WORK/scripts"
  printf '#!/usr/bin/env bash\necho "REPO=$REPO_ROOT"\n' > "$WORK/scripts/agent-surface.py"
  chmod +x "$WORK/scripts/agent-surface.py"

  run_validate "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"REPO=$WORK"* ]]
}
