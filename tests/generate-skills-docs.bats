#!/usr/bin/env bash
# tests/generate-skills-docs.bats — BATS tests for scripts/generate-skills-docs.py
#
# Covers: AVAILABLE_SKILLS.md + .agents/skills/README.md regeneration from
# frontmatter, category grouping, markdown-cell escaping, and the --root /
# missing-skills-dir error paths.

bats_require_minimum_version 1.5.0

setup() {
  export SCRIPT="scripts/generate-skills-docs.py"
  export WORK="$BATS_TEST_TMPDIR/workspace"
  mkdir -p "$WORK/.agents/skills/triz-analysis" "$WORK/.agents/skills/web-search-researcher"
  cat > "$WORK/.agents/skills/triz-analysis/SKILL.md" <<'EOF'
---
name: triz-analysis
description: Run a systematic TRIZ contradiction audit against a codebase.
category: analysis
---
EOF
  cat > "$WORK/.agents/skills/web-search-researcher/SKILL.md" <<'EOF'
---
name: web-search-researcher
description: Research topics using web search to find accurate, current information.
---
EOF
}

@test "regenerates AVAILABLE_SKILLS.md with category sections" {
  run python3 "$SCRIPT" --root "$WORK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Generated "*"AVAILABLE_SKILLS.md"* ]]
  grep -q '^## Analysis$' "$WORK/agents-docs/AVAILABLE_SKILLS.md"
  grep -q '`triz-analysis`' "$WORK/agents-docs/AVAILABLE_SKILLS.md"
  grep -q '^## General$' "$WORK/agents-docs/AVAILABLE_SKILLS.md"
  grep -q '`web-search-researcher`' "$WORK/agents-docs/AVAILABLE_SKILLS.md"
}

@test "regenerates .agents/skills/README.md flat table" {
  run python3 "$SCRIPT" --root "$WORK"
  [ "$status" -eq 0 ]
  grep -q '^| Skill | Description |$' "$WORK/.agents/skills/README.md"
  grep -q '| \[`triz-analysis/`\](triz-analysis/) |' "$WORK/.agents/skills/README.md"
  grep -q '| \[`web-search-researcher/`\](web-search-researcher/) |' "$WORK/.agents/skills/README.md"
}

@test "sorts skills alphabetically in the README table" {
  run python3 "$SCRIPT" --root "$WORK"
  [ "$status" -eq 0 ]
  readme="$WORK/.agents/skills/README.md"
  triz_line=$(grep -n 'triz-analysis/' "$readme" | head -1 | cut -d: -f1)
  web_line=$(grep -n 'web-search-researcher/' "$readme" | head -1 | cut -d: -f1)
  [ -n "$triz_line" ] && [ -n "$web_line" ]
  [ "$triz_line" -lt "$web_line" ]
}

@test "escapes pipes in descriptions" {
  cat > "$WORK/.agents/skills/web-search-researcher/SKILL.md" <<'EOF'
---
name: web-search-researcher
description: Use for X | Y tasks.
---
EOF
  run python3 "$SCRIPT" --root "$WORK"
  [ "$status" -eq 0 ]
  grep -q 'X \\| Y' "$WORK/.agents/skills/README.md"
  grep -q 'X \\| Y' "$WORK/agents-docs/AVAILABLE_SKILLS.md"
}

@test "handles folded multi-line descriptions" {
  cat > "$WORK/.agents/skills/web-search-researcher/SKILL.md" <<'EOF'
---
name: web-search-researcher
description: >-
  Research topics using web search to find accurate,
  current information from authoritative sources.
---
EOF
  run python3 "$SCRIPT" --root "$WORK"
  [ "$status" -eq 0 ]
  grep -q 'Research topics using web search to find accurate, current information from authoritative sources.' \
    "$WORK/.agents/skills/README.md"
}

@test "fails when skills directory is missing" {
  run python3 "$SCRIPT" --root "$BATS_TEST_TMPDIR/empty"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Skills directory not found"* ]]
}
