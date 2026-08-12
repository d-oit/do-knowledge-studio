#!/usr/bin/env bats
#
# Regression tests for scripts/diagnose-merge-state.sh.
#
# The script only talks to GitHub through the `gh` CLI, so these tests mock
# `gh` with an exported bash function whose responses are driven by MOCK_*
# env vars. Every invocation is recorded in a per-test call log so tests can
# assert the exact API lifecycle (POST / PATCH / DELETE / no-op).
#
# Run with: bats tests/diagnose-merge-state.bats
# (quality_gate.sh and scripts/verify.sh run the whole tests/ directory.)

SCRIPT="$BATS_TEST_DIRNAME/../scripts/diagnose-merge-state.sh"

# Mock gh. Dispatches on the joined argument string, mirroring the exact
# invocations the script makes:
#   gh api <url> --jq <expr>          -> reads
#   gh api -X DELETE <url>            -> delete
#   gh api -X PATCH <url> -f body=..  -> update in place
#   gh api <url> -f body=..           -> create
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

  if [[ "$joined" == *"/check-runs"* ]]; then
    # The in-progress query selects on .status; the failed query on .conclusion.
    if [[ "$joined" == *"IN("* ]]; then
      printf '%s\n' "${MOCK_FAILED:-[]}"
    else
      printf '%s\n' "${MOCK_IN_PROGRESS:-[]}"
    fi
    return 0
  fi

  if [[ "$joined" == *"required_status_checks"* ]]; then
    printf '%s\n' "${MOCK_REQUIRED:-[]}"
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

setup() {
  MOCK_LOG="$BATS_TEST_TMPDIR/calls.log"
  MOCK_BODY_FILE="$BATS_TEST_TMPDIR/body.txt"
  export MOCK_LOG MOCK_BODY_FILE
  : >"$MOCK_LOG"

  export GH_REPO="d-oit/do-knowledge-studio"
  export PR_NUMBER="42"
  export BASE_REF="main"
  export HEAD_REPO=""
  export GH_TOKEN="test-token"

  # Defaults — override per test.
  export MOCK_MERGEABLE="blocked"
  export MOCK_SHA="abc123"
  export MOCK_IN_PROGRESS="[]"
  export MOCK_FAILED="[]"
  export MOCK_REQUIRED="[]"
  export MOCK_COMMENT_ID="null"
}

@test "blocked + in-progress checks posts comment naming them" {
  export MOCK_IN_PROGRESS='["Analyze (actions)"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  ! grep -q '^PATCH$' "$MOCK_LOG"
  grep -q "Check run(s) still in progress" "$MOCK_BODY_FILE"
  grep -q 'Analyze (actions)' "$MOCK_BODY_FILE"
  grep -q 'blocked-pr-diagnoser' "$MOCK_BODY_FILE"
}

@test "blocked + failing checks posts comment naming them" {
  export MOCK_FAILED='["Unit Tests"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  grep -q "Failing check(s) blocking merge" "$MOCK_BODY_FILE"
  grep -q 'Unit Tests' "$MOCK_BODY_FILE"
  grep -q 'blocked-pr-diagnoser' "$MOCK_BODY_FILE"
}

@test "blocked + all green posts staleness note with required checks" {
  export MOCK_REQUIRED='["Codacy Static Code Analysis"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  grep -q "All checks are green" "$MOCK_BODY_FILE"
  grep -q 'Codacy Static Code Analysis' "$MOCK_BODY_FILE"
  grep -q 'plans/098' "$MOCK_BODY_FILE"
}

@test "blocked + existing comment patches in place, never duplicates" {
  export MOCK_COMMENT_ID="987"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^PATCH$' "$MOCK_LOG"
  ! grep -q '^POST$' "$MOCK_LOG"
  grep -q 'blocked-pr-diagnoser' "$MOCK_BODY_FILE"
}

@test "clean state deletes the stale comment" {
  export MOCK_MERGEABLE="clean"
  export MOCK_COMMENT_ID="987"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^DELETE$' "$MOCK_LOG"
  ! grep -q '^POST$' "$MOCK_LOG"
  ! grep -q '^PATCH$' "$MOCK_LOG"
}

@test "clean state with no comment makes no write calls" {
  export MOCK_MERGEABLE="clean"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  ! grep -qE '^(POST|PATCH|DELETE)$' "$MOCK_LOG"
}

@test "unknown state is diagnosed (treated like blocked)" {
  export MOCK_MERGEABLE="unknown"
  export MOCK_IN_PROGRESS='["Shell Script Security Analysis"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  grep -q "Check run(s) still in progress" "$MOCK_BODY_FILE"
  grep -q 'Shell Script Security Analysis' "$MOCK_BODY_FILE"
}

@test "fork PR exits before any gh call" {
  export HEAD_REPO="fork-user/do-knowledge-studio"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  [ ! -s "$MOCK_LOG" ]
}

@test "missing required env fails loudly" {
  run env -u GH_REPO "$SCRIPT"

  [ "$status" -ne 0 ]
  combined="${output}${stderr:-}"
  grep -q 'GH_REPO' <<<"$combined"
}
