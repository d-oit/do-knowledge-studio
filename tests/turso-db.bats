#!/usr/bin/env bats

@test "turso-db skill structure exists" {
  [ -f ".agents/skills/turso-db/SKILL.md" ]
  [ -d ".agents/skills/turso-db/references" ]
  [ -d ".agents/skills/turso-db/sdks" ]
}

@test "turso-db skill metadata is valid" {
  grep "name: turso-db" .agents/skills/turso-db/SKILL.md
  grep "version: 0.5.3" .agents/skills/turso-db/SKILL.md
}

@test "turso-db is registered in skills README" {
  grep "turso-db" .agents/skills/README.md
}

@test "turso-db produces a valid connection snippet (smoke test)" {
  # This test validates that the skill content contains a common Turso connection pattern
  grep "@tursodatabase/database" .agents/skills/turso-db/SKILL.md
  grep "connect(" .agents/skills/turso-db/sdks/javascript.md
}
