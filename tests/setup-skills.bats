#!/usr/bin/env bash
# tests/setup-skills.bats — BATS tests for scripts/setup-skills.sh
#
# Covers: symlink creation from manifest, idempotent re-runs, missing dirs,
# and symlink_strategy=none skipping.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="$BATS_TEST_DIRNAME/../scripts/setup-skills.sh"
  # Create isolated workspace per test
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK/.agents/skills"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Write a minimal manifest.json into the workspace.
# $1 = workspace root, $2 = JSON content (optional, defaults to a basic manifest)
write_manifest() {
  local root="${1:-$WORK}"
  local content="${2:-}"
  if [ -z "$content" ]; then
    content='{
      "version": "1.0.0",
      "canonical_skills": ".agents/skills",
      "tools": {
        "cursor": {
          "directory": ".cursor",
          "skills_directory": ".cursor/skills",
          "symlink_strategy": "relative-directory"
        },
        "windsurf": {
          "directory": ".windsurf",
          "skills_directory": ".windsurf/skills",
          "symlink_strategy": "relative-directory"
        }
      }
    }'
  fi
  printf '%s\n' "$content" > "$root/.agents/manifest.json"
}

# Run setup-skills against a workspace. Uses REPO_ROOT override so the
# script operates on our temp workspace instead of the real repo.
run_setup() {
  local root="${1:-$WORK}"
  run env REPO_ROOT="$root" bash "$SCRIPT"
}

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@test "creates symlinks for tools declared in manifest" {
  write_manifest "$WORK"
  run_setup "$WORK"
  [ "$status" -eq 0 ]

  # Both skills directories should be symlinks
  [ -L "$WORK/.cursor/skills" ]
  [ -L "$WORK/.windsurf/skills" ]

  # Verify symlink targets (relative to .cursor/)
  local target
  target=$(readlink "$WORK/.cursor/skills")
  [ "$target" = "../.agents/skills" ]
  target=$(readlink "$WORK/.windsurf/skills")
  [ "$target" = "../.agents/skills" ]
}

@test "uses canonical_skills from manifest for relative symlink targets" {
  mkdir -p "$WORK/shared/skills"
  local manifest='{
    "version": "1.0.0",
    "canonical_skills": "shared/skills",
    "tools": {
      "cursor": {
        "directory": ".cursor",
        "skills_directory": ".cursor/skills",
        "symlink_strategy": "relative-directory"
      }
    }
  }'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  [ "$(readlink "$WORK/.cursor/skills")" = "../shared/skills" ]
}


@test "creates relative per-skill links when declared" {
  mkdir -p "$WORK/.agents/skills/example"
  cat > "$WORK/.agents/skills/example/SKILL.md" <<'EOF'
---
name: example
description: Fixture skill used to verify per-skill link synchronization.
---
# Example
EOF
  local manifest='{
    "version": "1.0.0",
    "canonical_skills": ".agents/skills",
    "tools": {
      "claude": {
        "directory": ".claude",
        "skills_directory": ".claude/skills",
        "symlink_strategy": "relative-entries"
      }
    }
  }'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  [ -L "$WORK/.claude/skills/example" ]
  [ "$(readlink "$WORK/.claude/skills/example")" = "../../.agents/skills/example" ]
}
@test "creates parent directories for tool directories" {
  write_manifest "$WORK"
  run_setup "$WORK"
  [ "$status" -eq 0 ]

  # .cursor/ and .windsurf/ should exist as directories
  [ -d "$WORK/.cursor" ]
  [ -d "$WORK/.windsurf" ]
}

@test "regenerates skill reference tables after setup" {
  write_manifest "$WORK"
  run_setup "$WORK"
  [ "$status" -eq 0 ]

  # The generator should have refreshed both reference tables
  [ -f "$WORK/agents-docs/AVAILABLE_SKILLS.md" ]
  [ -f "$WORK/.agents/skills/README.md" ]
}

@test "fails clearly when python is unavailable" {
  write_manifest "$WORK"
  local restricted="$BATS_TEST_TMPDIR/restricted"
  mkdir -p "$restricted"
  ln -s "$(command -v dirname)" "$restricted/dirname"
  run env REPO_ROOT="$WORK" PATH="$restricted" "$(command -v bash)" "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Python is required to sync agent surfaces"* ]]
}

@test "fails closed for unsupported symlink strategies" {
  local manifest='{
    "version": "1.0.0",
    "tools": {
      "cursor": {
        "directory": ".cursor",
        "skills_directory": ".cursor/skills",
        "symlink_strategy": "directory"
      }
    }
  }'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unsupported symlink_strategy"* ]]
}

@test "is idempotent — re-running does not fail or change symlinks" {
  write_manifest "$WORK"
  run_setup "$WORK"
  [ "$status" -eq 0 ]

  run_setup "$WORK"
  [ "$status" -eq 0 ]

  # Symlink should still exist and point to same target
  [ -L "$WORK/.cursor/skills" ]
  local target
  target=$(readlink "$WORK/.cursor/skills")
  [ "$target" = "../.agents/skills" ]
}

@test "skips tools with symlink_strategy=none" {
  local manifest='{
    "version": "1.0.0",
    "tools": {
      "none-tool": {
        "directory": ".none-tool",
        "skills_directory": ".none-tool/skills",
        "symlink_strategy": "none"
      }
    }
  }'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -eq 0 ]

  # .none-tool/skills should NOT exist
  [ ! -e "$WORK/.none-tool/skills" ]
}

@test "skips when manifest.json is missing" {
  # Remove manifest
  rm -f "$WORK/.agents/manifest.json"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skipping"* ]]
}

@test "skips when .agents/skills directory is missing" {
  rm -rf "$WORK/.agents/skills"
  write_manifest "$WORK"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"skipping"* ]]
}

@test "handles empty tools object" {
  local manifest='{"version": "1.0.0", "tools": {}}'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Skills setup complete"* ]]
}

@test "skips entries with missing directory or skills_directory fields" {
  local manifest='{
    "version": "1.0.0",
    "tools": {
      "incomplete": {
        "directory": ".incomplete"
      }
    }
  }'
  write_manifest "$WORK" "$manifest"
  run_setup "$WORK"
  [ "$status" -eq 0 ]
  # Should not crash; incomplete entry is skipped
  [[ "$output" == *"Skills setup complete"* ]]
  [ ! -e "$WORK/.incomplete/skills" ]
}
