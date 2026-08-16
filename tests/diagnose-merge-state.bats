#!/usr/bin/env bats
#
# Regression tests for scripts/diagnose-merge-state.sh.
#
# The script only talks to GitHub through the `gh` CLI, so these tests mock
# `gh` with the shared helper (tests/helpers/mock-gh.bash). Every invocation
# is recorded in a per-test call log so tests can assert the exact API
# lifecycle (POST / PATCH / DELETE / no-op).
#
# Run with: bats tests/diagnose-merge-state.bats
# (quality_gate.sh and scripts/verify.sh run the whole tests/ directory.)

bats_require_minimum_version 1.5.0  # run ! needs >= 1.5

SCRIPT="$BATS_TEST_DIRNAME/../scripts/diagnose-merge-state.sh"

load helpers/mock-gh

setup() {
  mock_gh_setup

  export GH_REPO="d-oit/do-knowledge-studio"
  export PR_NUMBER="42"
  export BASE_REF="main"
  export HEAD_REPO=""
  export GH_TOKEN="test-token"
}

@test "blocked + in-progress checks posts comment naming them" {
  export MOCK_IN_PROGRESS='["Analyze (actions)"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  # run ! fails the test if grep matches (status 0), i.e. PATCH present.
  run ! grep -q '^PATCH$' "$MOCK_LOG"
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
  # run ! fails the test if grep matches (status 0), i.e. POST present.
  run ! grep -q '^POST$' "$MOCK_LOG"
  grep -q 'blocked-pr-diagnoser' "$MOCK_BODY_FILE"
}

@test "blocked + all green + rules API failure falls back to empty required" {
  export MOCK_RULES_FAIL="1"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  # The rules call must actually happen (not short-circuited) for the
  # fallback to be the path under test.
  grep -q 'rules/branches' "$MOCK_LOG"
  grep -q "All checks are green" "$MOCK_BODY_FILE"
  grep -q 'required: \[\]' "$MOCK_BODY_FILE"
  grep -q 'plans/098' "$MOCK_BODY_FILE"
}

@test "clean state deletes the stale comment" {
  export MOCK_MERGEABLE="clean"
  export MOCK_COMMENT_ID="987"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^DELETE$' "$MOCK_LOG"
  # run ! fails the test if grep matches (status 0), i.e. POST present.
  run ! grep -q '^POST$' "$MOCK_LOG"
  # run ! fails the test if grep matches (status 0), i.e. PATCH present.
  run ! grep -q '^PATCH$' "$MOCK_LOG"
}

@test "clean state with no comment makes no write calls" {
  export MOCK_MERGEABLE="clean"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  # run ! fails the test if any write marker is present.
  run ! grep -qE '^(POST|PATCH|DELETE)$' "$MOCK_LOG"
}

@test "unstable state deletes the stale comment" {
  export MOCK_MERGEABLE="unstable"
  export MOCK_COMMENT_ID="987"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^DELETE$' "$MOCK_LOG"
  # run ! fails the test if grep matches (status 0), i.e. POST present.
  run ! grep -q '^POST$' "$MOCK_LOG"
  # run ! fails the test if grep matches (status 0), i.e. PATCH present.
  run ! grep -q '^PATCH$' "$MOCK_LOG"
}

@test "unstable state with no comment makes no write calls" {
  export MOCK_MERGEABLE="unstable"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  # run ! fails the test if any write marker is present.
  run ! grep -qE '^(POST|PATCH|DELETE)$' "$MOCK_LOG"
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

@test "blocked + all green + unresolved review threads names them as the blocker" {
  export MOCK_THREADS="1 0"
  export MOCK_REQUIRED='["Codacy Static Code Analysis"]'

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  grep -q "unresolved review thread" "$MOCK_BODY_FILE"
  grep -q 'required_review_thread_resolution' "$MOCK_BODY_FILE"
  grep -q 'Codacy Static Code Analysis' "$MOCK_BODY_FILE"
  # The thread is the blocker — the staleness note must NOT be posted.
  run ! grep -q 'All checks are green' "$MOCK_BODY_FILE"
}

@test "blocked + all green + outdated unresolved threads are called out" {
  export MOCK_THREADS="3 2"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q '^POST$' "$MOCK_LOG"
  grep -q "unresolved review thread" "$MOCK_BODY_FILE"
  grep -q '2 of them outdated' "$MOCK_BODY_FILE"
  grep -q 'outdated threads still count' "$MOCK_BODY_FILE"
  grep -q 'LESSON-032' "$MOCK_BODY_FILE"
  # The staleness note must NOT be posted.
  run ! grep -q 'All checks are green' "$MOCK_BODY_FILE"
}

@test "blocked + all green still queries review threads before posting" {
  # Default MOCK_THREADS=0: the GraphQL call must happen (log evidence)
  # before the staleness note is posted.
  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q 'reviewThreads' "$MOCK_LOG"
  grep -q '^POST$' "$MOCK_LOG"
  grep -q 'All checks are green' "$MOCK_BODY_FILE"
}

@test "blocked + review-threads query failure falls back to staleness note" {
  export MOCK_THREADS_FAIL="1"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q 'reviewThreads' "$MOCK_LOG"
  grep -q '^POST$' "$MOCK_LOG"
  grep -q 'All checks are green' "$MOCK_BODY_FILE"
}

@test "failing checks take precedence over review threads" {
  export MOCK_FAILED='["Unit Tests"]'
  export MOCK_THREADS="1 0"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q 'Failing check(s) blocking merge' "$MOCK_BODY_FILE"
  run ! grep -q 'unresolved review thread' "$MOCK_BODY_FILE"
}

@test "in-progress checks take precedence over review threads" {
  export MOCK_IN_PROGRESS='["Unit Tests"]'
  export MOCK_THREADS="1 0"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  grep -q 'Check run(s) still in progress' "$MOCK_BODY_FILE"
  run ! grep -q 'unresolved review thread' "$MOCK_BODY_FILE"
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
