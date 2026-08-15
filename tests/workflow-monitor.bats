#!/usr/bin/env bash
# tests/workflow-monitor.bats — BATS tests for the shared workflow monitor helper.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/lib/workflow-monitor.sh"
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
