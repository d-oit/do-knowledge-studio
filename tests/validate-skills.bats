#!/usr/bin/env bats
# Sample BATS tests for validate-skills.sh
# Template users: Add your own tests in this directory

@test "validate-skills.sh exists and is executable" {
    [ -x "./scripts/validate-skills.sh" ]
}

@test "validate-skills.sh runs without errors on valid repository" {
    run ./scripts/validate-skills.sh
    [ "$status" -eq 0 ]
}

@test "validate-skills.sh detects broken symlinks" {
    # Create a broken symlink in .claude/skills/
    ln -sf /nonexistent/path .claude/skills/test-broken-symlink 2>/dev/null || true
    
    run ./scripts/validate-skills.sh
    
    # Clean up
    rm -f .claude/skills/test-broken-symlink
    
    # Should detect the broken symlink
    [ "$status" -ne 0 ] || [ "$output" != "" ]
}

@test "All skill directories have SKILL.md" {
    for skill_dir in .agents/skills/*/; do
        [ -f "$skill_dir/SKILL.md" ]
    done
}

@test "All SKILL.md files have required frontmatter" {
    for skill_file in .agents/skills/*/SKILL.md; do
        # Check for name field
        grep -q "^name:" "$skill_file"
        
        # Check for description field
        grep -q "^description:" "$skill_file"
        
        # Check for frontmatter markers
        head -1 "$skill_file" | grep -q "^---$"
    done
}

@test "No skill exceeds 250 lines (SKILL.md)" {
    for skill_file in .agents/skills/*/SKILL.md; do
        line_count=$(wc -l < "$skill_file")
        [ "$line_count" -le 250 ]
    done
}
