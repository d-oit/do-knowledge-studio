#!/usr/bin/env bash
# Shared check parsing and polling for the GitHub workflow skill scripts.

if [[ -z "${WORKFLOW_MONITOR_LOADED:-}" ]]; then
  WORKFLOW_MONITOR_LOADED=1
  readonly MONITOR_PROGRESS_LOG_INTERVAL=4

  # Print three boolean tokens: pending, failure, warning.
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

  # Combine PR check output with the caller's workflow-run state helper.
  # Prints four boolean tokens: pending, failure, warning, workflow failure.
  monitor_collect_check_state() {
    local checks_output="$1"
    local warning_policy="$2"
    local has_pending has_failure has_warning
    read -r has_pending has_failure has_warning < <(monitor_parse_checks "$checks_output" "$warning_policy")

    local folded_pending folded_failure
    read -r folded_pending folded_failure < <(monitor_fold_workflow_runs "$has_pending" "$has_failure")
    has_pending="$folded_pending"
    has_failure="$folded_failure"

    local workflow_failure=false
    if [[ "$has_failure" == true ]]; then
      workflow_failure=true
    fi
    printf '%s %s %s %s' "$has_pending" "$has_failure" "$has_warning" "$workflow_failure"
  }

  monitor_log_progress() {
    local progress_mode="$1"
    local has_pending="$2"
    local elapsed="$3"
    local attempts="$4"

    if [[ "$progress_mode" == "checks" && "$has_pending" == true ]]; then
      log "Checks still running... (${elapsed}s elapsed)"
    elif [[ "$progress_mode" == "attempts" ]] && [[ $((attempts % MONITOR_PROGRESS_LOG_INTERVAL)) -eq 1 ]]; then
      log "Monitoring... (${elapsed}s elapsed)"
    fi
  }

  monitor_handle_terminal_issue() {
    local issue_message="$1"
    local record_message="$2"
    local non_strict_message="$3"
    local failure_code="$4"
    local strict_validation="$5"
    local record_failures="$6"

    if [[ "$strict_validation" == true ]]; then
      error "CHECKS FAILED - $issue_message"
      if [[ "$record_failures" == true ]]; then
        CHECKS_FAILED+=("$record_message")
      fi
      return "$failure_code"
    fi

    warn "Checks have $non_strict_message (non-strict mode)"
    return 0
  }

  monitor_report_final_verdict() {
    local final_checks="$1"
    local workflow_failure_detected="$2"
    local warning_detected="$3"
    local warning_policy="$4"
    local strict_validation="$5"
    local failure_code="$6"
    local record_failures="$7"
    local show_final_analysis="$8"
    local base_branch="${9:-main}"

    if [[ "$show_final_analysis" == true ]]; then
      log ""
      log "Analyzing check results..."
      log "Checking base branch $base_branch for pre-existing issues..."
    fi

    local failure_detected="$workflow_failure_detected"
    if grep -qiE "(fail|error|✗|×)" <<< "$final_checks"; then
      failure_detected=true
    fi
    if [[ "$failure_detected" == true ]]; then
      if ! monitor_handle_terminal_issue "Failures detected" "Check failures" "failures" "$failure_code" "$strict_validation" "$record_failures"; then
        return "$failure_code"
      fi
    fi

    local warning_detected_in_final=false
    if grep -qiE "(warning|warn:|deprecated)" <<< "$final_checks"; then
      warning_detected_in_final=true
    fi
    if [[ "$warning_policy" == 1 ]] && [[ "$warning_detected" == true || "$warning_detected_in_final" == true ]]; then
      if ! monitor_handle_terminal_issue "Warnings detected (strict mode)" "Warnings" "warnings" "$failure_code" "$strict_validation" "$record_failures"; then
        return "$failure_code"
      fi
    fi

    if [[ "$show_final_analysis" == true ]]; then
      success "All checks passed!"
    else
      success "ALL CHECKS PASSED"
    fi
    return 0
  }

  # Poll a PR until checks settle and return the configured terminal verdict.
  #
  # Arguments: PR, timeout-code, failure-code, warning-policy, strict-mode,
  # poll-interval, timeout-seconds, progress-mode, final-report, record-failures,
  # base-branch.
  monitor_poll_until_terminal() {
    local pr_number="$1"
    local timeout_code="$2"
    local failure_code="$3"
    local warning_policy="$4"
    local strict_validation="$5"
    local poll_interval="$6"
    local timeout_seconds="$7"
    local progress_mode="$8"
    local show_final_analysis="$9"
    local record_failures="${10}"
    local base_branch="${11:-main}"
    local start_time
    start_time=$(date +%s)
    local attempts=0
    local workflow_failure_detected=false
    local warning_detected=false

    while true; do
      local current_time
      current_time=$(date +%s)
      local elapsed=$((current_time - start_time))

      if [[ $elapsed -gt $timeout_seconds ]]; then
        error "Timeout after ${timeout_seconds}s"
        return "$timeout_code"
      fi

      attempts=$((attempts + 1))

      local checks_output
      checks_output=$(gh pr checks "$pr_number" 2>&1 || true)
      local pr_state
      pr_state=$(gh pr view "$pr_number" --json state --jq '.state' 2>/dev/null || echo "OPEN")

      if [[ "$pr_state" == "MERGED" ]]; then
        success "PR already merged!"
        return 0
      fi
      if [[ "$pr_state" == "CLOSED" ]]; then
        error "PR was closed"
        return "$failure_code"
      fi

      local has_pending has_failure has_warning workflow_failure
      read -r has_pending has_failure has_warning workflow_failure < <(monitor_collect_check_state "$checks_output" "$warning_policy")
      if [[ "$has_warning" == true ]]; then
        warning_detected=true
      fi
      if [[ "$workflow_failure" == true ]]; then
        workflow_failure_detected=true
      fi

      monitor_log_progress "$progress_mode" "$has_pending" "$elapsed" "$attempts"

      if [[ "$has_pending" == true ]]; then
        sleep "$poll_interval"
        continue
      fi

      break
    done

    local final_checks
    final_checks=$(gh pr checks "$pr_number" 2>&1 || true)
    monitor_report_final_verdict \
      "$final_checks" "$workflow_failure_detected" "$warning_detected" \
      "$warning_policy" "$strict_validation" "$failure_code" \
      "$record_failures" "$show_final_analysis" "$base_branch"
  }
fi
