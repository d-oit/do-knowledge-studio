#!/usr/bin/env bash
#
# Reusable mocked `gh` CLI for BATS tests (tests/*.bats).
#
# Source it from a test file with:  load helpers/mock-gh
#
# Provides:
#   - gh():          a mock dispatcher that records every invocation to
#                    $MOCK_LOG and answers from MOCK_* env vars.
#   - mock_gh_setup(): per-test defaults; call it from your setup().
#
# The mock answers the GitHub endpoints that scripts use through the gh CLI:
#   - pull mergeable_state and head.sha
#   - commits/{sha}/check-runs (distinguishes the in-progress vs failed
#     queries by their jq expression)
#   - rules/branches required checks (can be made to fail via MOCK_RULES_FAIL)
#   - issue comments: lookup / POST / PATCH / DELETE
#
# Write calls are recorded as single-word markers (POST/PATCH/DELETE) in
# $MOCK_LOG so tests can assert the exact API lifecycle. Bodies passed with
# `-f body=...` are written verbatim to $MOCK_BODY_FILE for content asserts.
#
# Unknown invocations fail loudly (exit 1) so script changes surface as test
# failures instead of silent misbehavior.

gh() {
  local joined="$*"
  echo "CALL: $joined" >>"$MOCK_LOG"

  if [[ "$joined" == *"-X DELETE"* ]]; then
    echo "DELETE" >>"$MOCK_LOG"
    return 0
  fi

  if [[ "$joined" == *"-X PATCH"* ]]; then
    echo "PATCH" >>"$MOCK_LOG"
    local arg
    for arg in "$@"; do
      if [[ "$arg" == body=* ]]; then
        printf '%s' "${arg#body=}" >"$MOCK_BODY_FILE"
      fi
    done
    return 0
  fi

  # POST (create) — has -f body= but no -X flag.
  if [[ "$joined" == *"/comments"* ]] && [[ "$joined" == *"-f body="* ]]; then
    echo "POST" >>"$MOCK_LOG"
    local arg
    for arg in "$@"; do
      if [[ "$arg" == body=* ]]; then
        printf '%s' "${arg#body=}" >"$MOCK_BODY_FILE"
      fi
    done
    return 0
  fi

  if [[ "$joined" == *"mergeable_state"* ]]; then
    printf '%s\n' "${MOCK_MERGEABLE:-blocked}"
    return 0
  fi

  if [[ "$joined" == *"head.sha"* ]]; then
    printf '%s\n' "${MOCK_SHA:-abc123}"
    return 0
  fi

  # rules/branches may be made to fail (exit 1) — the calling script's
  # `|| echo '[]'` fallback is then exercised.
  if [[ "$joined" == *"rules/branches"* ]]; then
    if [[ "${MOCK_RULES_FAIL:-0}" == "1" ]]; then
      return 1
    fi
    printf '%s\n' "${MOCK_REQUIRED:-[]}"
    return 0
  fi

  if [[ "$joined" == *"/check-runs"* ]]; then
    # The in-progress query selects on .status; the failed query on .conclusion.
    if [[ "$joined" == *"IN("* ]]; then
      printf '%s\n' "${MOCK_FAILED:-[]}"
    else
      printf '%s\n' "${MOCK_IN_PROGRESS:-[]}"
    fi
    return 0
  fi

  # GraphQL review-thread query — the diagnoser checks unresolved threads
  # before declaring staleness (LESSON-026/030). Returns the post-jq pair
  # "total outdated" (outdated threads still count, LESSON-032).
  # MOCK_THREADS_FAIL=1 exercises the script's `|| echo "0 0"` fallback.
  if [[ "$joined" == *"graphql"* ]] && [[ "$joined" == *"reviewThreads"* ]]; then
    if [[ "${MOCK_THREADS_FAIL:-0}" == "1" ]]; then
      return 1
    fi
    printf '%s\n' "${MOCK_THREADS:-0 0}"
    return 0
  fi

  # Existing-comment lookup: gh api <url>/comments --jq '...[0].id'
  if [[ "$joined" == *"/comments"* ]]; then
    printf '%s\n' "${MOCK_COMMENT_ID:-null}"
    return 0
  fi

  echo "UNHANDLED: $joined" >&2
  return 1
}
export -f gh

mock_gh_setup() {
  MOCK_LOG="$BATS_TEST_TMPDIR/calls.log"
  MOCK_BODY_FILE="$BATS_TEST_TMPDIR/body.txt"
  export MOCK_LOG MOCK_BODY_FILE
  : >"$MOCK_LOG"

  # Defaults — override per test.
  export MOCK_MERGEABLE="blocked"
  export MOCK_SHA="abc123"
  export MOCK_IN_PROGRESS="[]"
  export MOCK_FAILED="[]"
  export MOCK_REQUIRED="[]"
  export MOCK_RULES_FAIL="0"
  export MOCK_THREADS="0 0"
  export MOCK_THREADS_FAIL="0"
  export MOCK_COMMENT_ID="null"
}
