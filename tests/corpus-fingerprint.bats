#!/usr/bin/env bats
# tests/corpus-fingerprint.bats — corpus-fingerprint.mjs prints a stable hash
# of a JSON corpus export and fails on invalid input or --expect mismatch.

bats_require_minimum_version 1.5.0

SCRIPT="$BATS_TEST_DIRNAME/../scripts/corpus-fingerprint.mjs"

write_corpus() {
  printf '%s' "$1" > "$2"
}

@test "same content with different key order and whitespace has the same hash" {
  local a="$BATS_TEST_TMPDIR/a.json"
  local b="$BATS_TEST_TMPDIR/b.json"
  write_corpus '{"version":1,"entities":[{"id":"e1","title":"A"},{"id":"e2","title":"B"}]}' "$a"
  write_corpus '{ "entities" : [ { "title" : "A" , "id" : "e1" } , { "id" : "e2" , "title" : "B" } ] , "version" : 1 }' "$b"

  run node "$SCRIPT" "$a"
  [ "$status" -eq 0 ]
  local hash_a="${output%% *}"

  run node "$SCRIPT" "$b"
  [ "$status" -eq 0 ]
  local hash_b="${output%% *}"

  [ "$hash_a" = "$hash_b" ]
}

@test "ignores exportedAt when fingerprinting the same corpus" {
  local a="$BATS_TEST_TMPDIR/a.json"
  local b="$BATS_TEST_TMPDIR/b.json"
  write_corpus '{"version":1,"exportedAt":"2026-11-17T10:00:00.000Z","entities":[{"id":"e1"}],"claims":[]}' "$a"
  write_corpus '{"version":1,"exportedAt":"2026-11-17T10:01:00.000Z","entities":[{"id":"e1"}],"claims":[]}' "$b"

  run node "$SCRIPT" "$a"
  [ "$status" -eq 0 ]
  local hash_a="${output%% *}"

  run node "$SCRIPT" "$b"
  [ "$status" -eq 0 ]
  local hash_b="${output%% *}"

  [ "$hash_a" = "$hash_b" ]
}

@test "changed content changes the hash" {
  local a="$BATS_TEST_TMPDIR/a.json"
  local b="$BATS_TEST_TMPDIR/b.json"
  write_corpus '{"entities":[{"id":"e1"}]}' "$a"
  write_corpus '{"entities":[{"id":"e1"},{"id":"e2"}]}' "$b"

  run node "$SCRIPT" "$a"
  [ "$status" -eq 0 ]
  local hash_a="${output%% *}"

  run node "$SCRIPT" "$b"
  [ "$status" -eq 0 ]
  local hash_b="${output%% *}"

  [ "$hash_a" != "$hash_b" ]
}

@test "--expect exits 0 on match and 1 on mismatch" {
  local a="$BATS_TEST_TMPDIR/a.json"
  write_corpus '{"version":1}' "$a"

  run node "$SCRIPT" "$a"
  [ "$status" -eq 0 ]
  local digest="${output%% *}"

  run node "$SCRIPT" --expect "$digest" "$a"
  [ "$status" -eq 0 ]
  [[ "$output" == *"match"* ]]

  run node "$SCRIPT" --expect "0000000000000000000000000000000000000000000000000000000000000000" "$a"
  [ "$status" -ne 0 ]
  [[ "$output" == *"mismatch"* ]]
}

@test "fails on invalid JSON and on a missing file" {
  local bad="$BATS_TEST_TMPDIR/bad.json"
  write_corpus '{"entities":[' "$bad"

  run node "$SCRIPT" "$bad"
  [ "$status" -ne 0 ]

  run node "$SCRIPT" "$BATS_TEST_TMPDIR/does-not-exist.json"
  [ "$status" -ne 0 ]
}

@test "reads from stdin with --stdin" {
  run bash -c "printf '{\"b\":2,\"a\":1}' | node \"$SCRIPT\" --stdin"
  [ "$status" -eq 0 ]
  [[ "$output" == *"stdin" ]]

  run bash -c "printf '{\"a\":1,\"b\":2}' | node \"$SCRIPT\" --stdin"
  [ "$status" -eq 0 ]
  local hash_b="${output%% *}"

  run bash -c "printf '{\"b\":2,\"a\":1}' | node \"$SCRIPT\" --stdin"
  [ "$status" -eq 0 ]
  local hash_a="${output%% *}"

  [ "$hash_a" = "$hash_b" ]
}
