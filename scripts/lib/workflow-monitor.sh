#!/usr/bin/env bash
# Shared check-output parsing for the GitHub workflow skill scripts.
#
# The caller supplies whether warning markers should be surfaced. The helper
# prints three boolean tokens: pending, failure, warning.

if [[ -z "${WORKFLOW_MONITOR_LOADED:-}" ]]; then
  WORKFLOW_MONITOR_LOADED=1

monitor_parse_checks() {
  local checks_output="${1:-}"
  local fail_on_warning="${2:-1}"
  local has_pending=false
  local has_failure=false
  local has_warning=false

  if grep -qiE "(pending|queued|in progress|running)" <<< "$checks_output"; then
    has_pending=true
  fi
  if grep -qiE "(fail|error|✗|×)" <<< "$checks_output"; then
    has_failure=true
  fi
  if [[ "$fail_on_warning" == 1 ]] && grep -qiE "(warning|warn:|deprecated)" <<< "$checks_output"; then
    has_warning=true
  fi

  printf '%s %s %s' "$has_pending" "$has_failure" "$has_warning"
}

fi
