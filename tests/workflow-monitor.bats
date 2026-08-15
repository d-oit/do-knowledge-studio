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
