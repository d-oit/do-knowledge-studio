#!/usr/bin/env bats
# tests/check-file-size.bats — repo file-size traversal must not follow symlinks.

bats_require_minimum_version 1.5.0

write_oversized_source() {
  awk 'BEGIN { for (i = 0; i < 501; i++) print "const value = " i }' > "$1"
}

@test "skips symlinks but still checks regular source files" {
  local fixture="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$fixture/scripts" "$fixture/src" "$fixture/outside"
  cp "$BATS_TEST_DIRNAME/../scripts/check-file-size.mjs" "$fixture/scripts/check-file-size.mjs"
  cp -r "$BATS_TEST_DIRNAME/../scripts/lib" "$fixture/scripts/lib"
  write_oversized_source "$fixture/outside/external.ts"
  ln -s "$fixture/outside" "$fixture/src/external-directory"
  ln -s "$fixture/outside/external.ts" "$fixture/src/external-file.ts"

  run bash -c 'cd "$1" && node scripts/check-file-size.mjs' _ "$fixture"
  [ "$status" -eq 0 ]
  [[ "$output" == *"File-size gate passed."* ]]

  write_oversized_source "$fixture/src/oversized.ts"
  run bash -c 'cd "$1" && node scripts/check-file-size.mjs' _ "$fixture"
  [ "$status" -ne 0 ]
  [[ "$output" == *"src/oversized.ts"* ]]
}
