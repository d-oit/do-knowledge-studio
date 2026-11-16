#!/usr/bin/env bats
# tests/agent-guard.bats — sample PreToolUse payloads for scripts/agent-guard.sh (#1144).

bats_require_minimum_version 1.5.0

setup() {
  export GUARD="$BATS_TEST_DIRNAME/../scripts/agent-guard.sh"
}

guard() {
  run bash "$GUARD" <<<"$1"
}

@test "blocks edits to biome.json" {
  guard '{"tool_name":"Edit","tool_input":{"file_path":"biome.json"}}'
  [ "$status" -ne 0 ]
  [[ "$output" == *"biome.json"* ]]
}

@test "blocks new eslint-disable suppressions" {
  guard '{"tool_name":"Edit","tool_input":{"file_path":"src/a.ts","new_string":"// eslint-disable-next-line no-explicit-any"}}'
  [ "$status" -ne 0 ]
  [[ "$output" == *"suppression"* ]]
}

@test "blocks gh release create" {
  guard '{"tool_name":"Bash","tool_input":{"command":"gh release create v1.2.3 --notes-file plans/notes.md"}}'
  [ "$status" -ne 0 ]
  [[ "$output" == *"release"* ]]
}

@test "blocks gh pr merge --admin" {
  guard '{"tool_name":"Bash","tool_input":{"command":"gh pr merge 12 --squash --admin"}}'
  [ "$status" -ne 0 ]
  [[ "$output" == *"--admin"* ]]
}

@test "blocks pushing to main" {
  guard '{"tool_name":"Bash","tool_input":{"command":"git push origin feat/x:main"}}'
  [ "$status" -ne 0 ]
}

@test "blocks npm installs" {
  guard '{"tool_name":"Bash","tool_input":{"command":"npm install left-pad"}}'
  [ "$status" -ne 0 ]
}

@test "blocks root tmp files" {
  guard '{"tool_name":"Write","tool_input":{"file_path":"tmp-scratch.md"}}'
  [ "$status" -ne 0 ]
  [[ "$output" == *"placement"* ]]
}

@test "allows reading biome.json" {
  guard '{"tool_name":"Read","tool_input":{"file_path":"biome.json"}}'
  [ "$status" -eq 0 ]
}

@test "allows normal gh pr merge" {
  guard '{"tool_name":"Bash","tool_input":{"command":"gh pr merge 12 --auto --squash --delete-branch"}}'
  [ "$status" -eq 0 ]
}

@test "allows pnpm installs" {
  guard '{"tool_name":"Bash","tool_input":{"command":"pnpm install"}}'
  [ "$status" -eq 0 ]
}

@test "allows nested plans files with tmp prefix" {
  guard '{"tool_name":"Write","tool_input":{"file_path":"plans/tmp-analysis.md"}}'
  [ "$status" -eq 0 ]
}

@test "human override bypasses the guard" {
  run env DKS_AGENT_GUARD_OFF=1 bash "$GUARD" <<< '{"tool_name":"Bash","tool_input":{"command":"gh release create v9"}}'
  [ "$status" -eq 0 ]
}
