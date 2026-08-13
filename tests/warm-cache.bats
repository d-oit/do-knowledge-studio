#!/usr/bin/env bash
# tests/warm-cache.bats — BATS tests for the do-web-doc-resolver warm_cache CLI
#
# Covers: --help, --dry-run (no network), file loading with comments, and
# error handling. These tests avoid network access and resolver dependencies.

bats_require_minimum_version 1.5.0

setup() {
  export RESOLVER_DIR="$BATS_TEST_DIRNAME/../.agents/skills/do-web-doc-resolver"
}

@test "--help prints usage without resolver dependencies" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --help"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Warm the Web Doc Resolver cache"* ]]
  [[ "$output" == *"--dry-run"* ]]
}

@test "--dry-run lists items without resolving" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --dry-run 'topic one' 'topic two'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"would warm: topic one"* ]]
  [[ "$output" == *"would warm: topic two"* ]]
  [[ "$output" == *"2 item(s) would be warmed"* ]]
}

@test "reads items from a file, ignoring comments and blanks" {
  query_file="$BATS_TEST_TMPDIR/queries.txt"
  printf '# generated query list\n\nhttps://example.com\ntopic\n' > "$query_file"
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --dry-run --file '$query_file'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"would warm: https://example.com"* ]]
  [[ "$output" == *"would warm: topic"* ]]
  [[ "$output" != *"generated query list"* ]]
}

@test "combines positional items with --file items" {
  query_file="$BATS_TEST_TMPDIR/queries.txt"
  printf 'from-file\n' > "$query_file"
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --dry-run 'positional' --file '$query_file'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"would warm: positional"* ]]
  [[ "$output" == *"would warm: from-file"* ]]
  [[ "$output" == *"2 item(s) would be warmed"* ]]
}

@test "errors on missing file" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --file '$BATS_TEST_TMPDIR/nope.txt'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"file not found"* ]]
}

@test "errors when no items given" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache"
  [ "$status" -ne 0 ]
  [[ "$output" == *"no items given"* ]]
}
