#!/usr/bin/env bash
# tests/workflow-monitor.bats — BATS tests for the shared workflow monitor helper.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/lib/workflow-monitor.sh"
  export GH_SCRIPT="$BATS_TEST_DIRNAME/../.agents/skills/github-workflow/run.sh"
  export GGH_SCRIPT="$BATS_TEST_DIRNAME/../.agents/skills/git-github-workflow/run.sh"
}

# ---------------------------------------------------------------------------
# Skill-script sync guards (plan 124 follow-up): both skill scripts must
# consume the shared library rather than drifting into private copies.
# ---------------------------------------------------------------------------

@test "skill scripts source the shared monitor library" {
  for script in "$GH_SCRIPT" "$GGH_SCRIPT"; do
    grep -q 'source "$REPO_ROOT/scripts/lib/workflow-monitor.sh"' "$script"
  done
}

@test "skill scripts do not redefine shared monitor functions" {
  for script in "$GH_SCRIPT" "$GGH_SCRIPT"; do
    for fn in monitor_parse_checks monitor_collect_check_state monitor_log_progress monitor_handle_terminal_issue monitor_report_final_verdict monitor_poll_until_terminal; do
      if grep -qE "^[[:space:]]*${fn}\(\)" "$script"; then
        echo "$script redefines shared function $fn" >&2
        return 1
      fi
    done
  done
}

@test "every monitor function referenced by skill scripts is defined in the lib or locally" {
  for script in "$GH_SCRIPT" "$GGH_SCRIPT"; do
    local defined
    defined="$(grep -hoE '^[[:space:]]*monitor_[a-z_]+\(' "$SCRIPT" "$script" | sed -E 's/^[[:space:]]*//; s/\($//' | sort -u)"
    while read -r fn; do
      if ! grep -qx "$fn" <<< "$defined"; then
        echo "$script references undefined monitor function $fn" >&2
        return 1
      fi
    done < <(grep -oE '\bmonitor_[a-z_]+' "$script" | sort -u)
  done
}

@test "parses pending, failure, and warning markers" {
  run bash -c 'source "$1"; monitor_parse_checks "$2" 1' _ "$SCRIPT" "queued: check\nerror: failed\nwarning: deprecated"
  [ "$status" -eq 0 ]
  [ "$output" = "true true true" ]
}

@test "does not report warnings when warning failures are disabled" {
  run bash -c 'source "$1"; monitor_parse_checks "$2" 0' _ "$SCRIPT" "warning: deprecated"
  [ "$status" -eq 0 ]
  [ "$output" = "false false false" ]
}

@test "returns false flags for successful checks" {
  run bash -c 'source "$1"; monitor_parse_checks "$2" 1' _ "$SCRIPT" "success: passed"
  [ "$status" -eq 0 ]
  [ "$output" = "false false false" ]
}

@test "fails when workflow-run folding reports failure" {
  run bash -c '
    source "$1"
    log() { :; }
    error() { :; }
    success() { :; }
    warn() { :; }
    gh() {
      if [[ "$1" == "pr" && "$2" == "view" ]]; then
        printf "OPEN"
      else
        printf "success"
      fi
    }
    monitor_fold_workflow_runs() {
      printf "false true"
    }
    expected_failure_code=4
    timeout_code=7
    monitor_poll_until_terminal 1 "$timeout_code" "$expected_failure_code" 1 true 0 10 checks false false main
  ' _ "$SCRIPT"
  [ "$status" -eq 4 ]
}
