#!/usr/bin/env bats
# tests/check-workflow-hygiene.bats — BATS tests for the workflow hygiene gate.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/check-workflow-hygiene.mjs"
  export WORKFLOWS="$BATS_TEST_TMPDIR/workflows"
  mkdir -p "$WORKFLOWS"
}

write_workflow() {
  local name="$1"
  shift
  printf '%s\n' "$@" > "$WORKFLOWS/$name"
}

@test "passes a clean pull_request workflow with concurrency and permissions" {
  write_workflow clean.yml \
    'name: Clean' \
    'on:' \
    '  pull_request:' \
    'permissions:' \
    '  contents: read' \
    'concurrency:' \
    '  group: ${{ github.workflow }}-${{ github.ref }}' \
    '  cancel-in-progress: true' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - run: echo ok'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 workflow(s) clean"* ]]
}

@test "fails a push workflow without a concurrency group" {
  write_workflow no-concurrency.yml \
    'name: No Concurrency' \
    'on:' \
    '  push:' \
    'permissions:' \
    '  contents: read' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - run: echo ok'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 1 ]
  [[ "$output" == *"declares no concurrency group"* ]]
}

@test "fails a workflow without top-level permissions" {
  write_workflow no-permissions.yml \
    'name: No Permissions' \
    'on:' \
    '  workflow_dispatch:' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - run: echo ok'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 1 ]
  [[ "$output" == *"missing top-level permissions"* ]]
}

@test "fails an unannotated continue-on-error" {
  write_workflow unannotated.yml \
    'name: Unannotated' \
    'on:' \
    '  workflow_dispatch:' \
    'permissions:' \
    '  contents: read' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - uses: actions/checkout@v4' \
    '        continue-on-error: true'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 1 ]
  [[ "$output" == *"allow-continue-on-error"* ]]
}

@test "accepts an annotated continue-on-error" {
  write_workflow annotated.yml \
    'name: Annotated' \
    'on:' \
    '  workflow_dispatch:' \
    'permissions:' \
    '  contents: read' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - uses: actions/checkout@v4' \
    '        # allow-continue-on-error: SARIF upload is best-effort' \
    '        continue-on-error: true'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 0 ]
}

@test "fails a concurrency block without a group" {
  write_workflow no-group.yml \
    'name: No Group' \
    'on:' \
    '  pull_request:' \
    'permissions:' \
    '  contents: read' \
    'concurrency:' \
    '  cancel-in-progress: true' \
    'jobs:' \
    '  build:' \
    '    runs-on: ubuntu-latest' \
    '    steps:' \
    '      - run: echo ok'

  run node "$SCRIPT" "$WORKFLOWS"
  [ "$status" -eq 1 ]
  [[ "$output" == *"concurrency block has no group"* ]]
}
