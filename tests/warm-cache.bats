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

@test "dedupes repeated items" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --dry-run 'topic' 'topic' 'topic'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 item(s) would be warmed"* ]]
}

@test "rejects unknown profile values" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache --dry-run --profile bogus 'topic'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"invalid choice"* ]]
}

@test "errors when no items given" {
  run bash -c "cd '$RESOLVER_DIR' && python3 -m scripts.warm_cache"
  [ "$status" -ne 0 ]
  [[ "$output" == *"no items given"* ]]
}

# ---------------------------------------------------------------------------
# Failure reporting (commit beb796e): resolve() returns semantic failures as
# {"source": "none", "content": "Failed"} — the CLI must report them honestly
# instead of claiming the item was warmed. _resolve_item is monkeypatched so
# these tests need no network access or resolver dependencies.
# ---------------------------------------------------------------------------

@test "reports semantic failures instead of claiming items were warmed" {
  run bash -c "cd '$RESOLVER_DIR' && python3 - <<'PY'
import sys
import scripts.warm_cache as wc

def fake_resolve(item, max_chars, profile):
    if item == 'ok':
        return {'source': 'http', 'content': 'fine'}
    return {'source': 'none', 'content': 'Failed', 'error': 'timeout'}

wc._resolve_item = fake_resolve
sys.argv = ['warm_cache', 'ok', 'bad']
sys.exit(wc.main())
PY"
  [ "$status" -eq 1 ]
  [[ "$output" == *"warmed: ok"* ]]
  [[ "$output" == *"error: could not warm 'bad': timeout"* ]]
  [[ "$output" == *"warmed 1/2 item(s) (1 failed)"* ]]
}

@test "uses 'unknown reason' when a semantic failure has no error detail" {
  run bash -c "cd '$RESOLVER_DIR' && python3 - <<'PY'
import sys
import scripts.warm_cache as wc

wc._resolve_item = lambda item, max_chars, profile: {'source': 'none', 'content': 'Failed'}
sys.argv = ['warm_cache', 'bad']
sys.exit(wc.main())
PY"
  [ "$status" -eq 1 ]
  [[ "$output" == *"error: could not warm 'bad': unknown reason"* ]]
  [[ "$output" == *"warmed 0/1 item(s) (1 failed)"* ]]
}

@test "reports per-item exceptions and keeps warming remaining items" {
  run bash -c "cd '$RESOLVER_DIR' && python3 - <<'PY'
import sys
import scripts.warm_cache as wc

def fake_resolve(item, max_chars, profile):
    if item == 'bad':
        raise RuntimeError('boom')
    return {'source': 'http', 'content': 'fine'}

wc._resolve_item = fake_resolve
sys.argv = ['warm_cache', 'ok', 'bad']
sys.exit(wc.main())
PY"
  [ "$status" -eq 1 ]
  [[ "$output" == *"error: failed to resolve 'bad': boom"* ]]
  [[ "$output" == *"warmed: ok"* ]]
  [[ "$output" == *"warmed 1/2 item(s) (1 failed)"* ]]
}

@test "exits with status 0 when every item warms successfully" {
  run bash -c "cd '$RESOLVER_DIR' && python3 - <<'PY'
import sys
import scripts.warm_cache as wc

wc._resolve_item = lambda item, max_chars, profile: {'source': 'http', 'content': 'fine'}
sys.argv = ['warm_cache', 'a', 'b']
sys.exit(wc.main())
PY"
  [ "$status" -eq 0 ]
  [[ "$output" == *"warmed: a"* ]]
  [[ "$output" == *"warmed: b"* ]]
  [[ "$output" == *"warmed 2 item(s)"* ]]
}

@test "exits when resolver dependencies are missing" {
  run bash -c "cd '$RESOLVER_DIR' && python3 - <<'PY'
import sys
import scripts.warm_cache as wc

wc._resolve_item = lambda item, max_chars, profile: (_ for _ in ()).throw(ImportError('no module named requests'))
sys.argv = ['warm_cache', 'a']
sys.exit(wc.main())
PY"
  [ "$status" -eq 1 ]
  [[ "$output" == *"error: resolver dependencies missing"* ]]
  [[ "$output" == *"pip install -r"* ]]
}
