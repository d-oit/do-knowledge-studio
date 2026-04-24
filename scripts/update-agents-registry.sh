#!/usr/bin/env bash
# Auto-update AGENTS.md by scanning .claude/agents/ and .opencode/agents/ directories
# Run manually or set up as a file watcher
# Usage: ./scripts/update-agents-registry.sh
# Note: OpenCode agents live in .opencode/agents/ (real files, not symlinks)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

REGISTRY_FILE="$REPO_ROOT/agents-docs/AGENTS.md"
TEMP_FILE="$REPO_ROOT/agents-docs/.agents_registry_temp.md"

# Trap to clean up temp files on exit or error
trap 'rm -f "$TEMP_FILE"' EXIT ERR

echo "Scanning for agent definitions..."

# Start registry file
cat > "$TEMP_FILE" << 'HEADER'
# Agents Registry

> Auto-generated registry of all sub-agents in this repository.
> Last updated: TIMESTAMP

This file provides a centralized discovery mechanism for all available sub-agents.
Agents are organized by CLI tool and purpose.

---

## Quick Reference

| Agent | CLI | Purpose | Tools |
|-------|-----|---------|-------|
HEADER

# Function to extract agent info from YAML frontmatter
extract_agent_info() {
    local file="$1"
    local cli_type="$2"
    
    # Extract frontmatter (between first and second ---)
    local frontmatter
    frontmatter=$(sed -n '/^---$/,/^---$/p' "$file" | sed '1d;$d')

    # Extract name from frontmatter
    local name
    name=$(echo "$frontmatter" | grep "^name:" | head -1 | sed 's/^name: *//' | tr -d '"' || echo "")
    
    # Extract description from frontmatter
    local description
    description=$(echo "$frontmatter" | grep "^description:" | head -1 | sed 's/^description: *//' | tr -d '"' | cut -c1-60 || echo "No description")
    
    # Extract tools from frontmatter
    local tools
    tools=$(echo "$frontmatter" | grep "^tools:" | head -1 | sed 's/^tools: *//' | tr -d '"' || echo "Inherited")

    if [ -n "$name" ]; then
        # Clean up description - remove "Invoke when..." for brevity
        description=$(echo "$description" | sed 's/\. Invoke when.*//g' | sed 's/Invoke when.*//g')
        echo "| \`$name\` | $cli_type | $description | $tools |"
    fi
}

# Scan .claude/agents/ directory
if [ -d "$REPO_ROOT/.claude/agents" ]; then
    echo "  Found .claude/agents/"
    
    for agent_file in "$REPO_ROOT/.claude/agents"/*.md; do
        [ -f "$agent_file" ] || continue
        agent_name=$(basename "$agent_file" .md)
        extract_agent_info "$agent_file" "Claude Code" >> "$TEMP_FILE"
    done
fi

# Scan .opencode/agents/ directory
if [ -d "$REPO_ROOT/.opencode/agents" ]; then
    echo "  Found .opencode/agents/"

    for agent_file in "$REPO_ROOT/.opencode/agents"/*.md; do
        [ -f "$agent_file" ] || continue
        # Skip symlinks to .agents/skills
        [ -L "$agent_file" ] && continue
        # shellcheck disable=SC2034
        agent_name=$(basename "$agent_file" .md)
        extract_agent_info "$agent_file" "OpenCode" >> "$TEMP_FILE"
    done
fi

# Add skills section
cat >> "$TEMP_FILE" << 'SKILLS_HEADER'

---

## Available Skills

Skills are reusable knowledge modules with progressive disclosure.
See [`agents-docs/AVAILABLE_SKILLS.md`](agents-docs/AVAILABLE_SKILLS.md) for authoring guide.

| Skill | Location | Description |
|-------|----------|-------------|
SKILLS_HEADER

# Scan .agents/skills/ directory (canonical source)
if [ -d "$REPO_ROOT/.agents/skills" ]; then
    echo "  Found .agents/skills/"
    
    for skill_dir in "$REPO_ROOT/.agents/skills"/*/; do
        [ -d "$skill_dir" ] || continue
        skill_name=$(basename "$skill_dir")
        
        # Skip if no SKILL.md exists
        [ -f "$skill_dir/SKILL.md" ] || continue
        
        # Extract description from frontmatter (handling block scalars like >- or |)
        description=$(sed -n '/^description:/,/^[a-z-]*:/p' "$skill_dir/SKILL.md" | sed '1s/^description: *//;$d' | tr -d '\n' | sed 's/^[>-]* *//;s/  */ /g' | cut -c1-60 || echo "No description")
        
        # Extract name from frontmatter if available
        skill_display_name=$(grep "^name:" "$skill_dir/SKILL.md" | head -1 | sed 's/^name: *//' | tr -d '"' || echo "$skill_name")
        
        echo "| \`${skill_display_name}\` | \`.agents/skills/$skill_name\` | $description |" >> "$TEMP_FILE"
    done
fi

# Add footer
cat >> "$TEMP_FILE" << 'FOOTER'

---

## Adding New Agents

1. Create agent file in `.claude/agents/<agent-name>.md` (Claude Code) or `.opencode/agents/<agent-name>.md` (OpenCode)
2. Include YAML frontmatter with `name`, `description`, and `tools`
3. Run `./scripts/update-agents-registry.sh` to update this registry

### Agent File Template

```markdown
---
name: agent-name
description: What this agent does. Invoke when [specific scenarios].
tools: Read, Grep, Glob, Bash
---

# Agent Name

System prompt for the agent...
```

## Adding New Skills

1. Create skill folder in `.agents/skills/<skill-name>/`
2. Add `SKILL.md` with frontmatter (≤250 lines)
3. Run `./scripts/setup-skills.sh` to create symlinks
4. Run `./scripts/update-agents-registry.sh` to update this registry

### Skill File Template

```markdown
---
name: skill-name
description: What this skill does. Use when [specific scenarios].
---

# Skill Name

Skill instructions...
```

---

## File Watcher Setup

### VS Code

Add to `.vscode/settings.json`:

```json
{
  "files.watcherExclude": {
    "**/.git/**": true
  },
  "files.watcherInclude": [
    ".claude/agents/**/*.md",
    ".opencode/agents/**/*.md",
    ".agents/skills/**/SKILL.md"
  ]
}
```

Then use a task to run the update script on file changes.

### npm-based Watcher

```bash
npm install -g chokidar-cli

# Watch for changes and update registry
chokidar ".claude/agents/*.md" ".opencode/agents/*.md" ".agents/skills/*/SKILL.md" \
  -c "./scripts/update-agents-registry.sh && git add AGENTS.md"
```

### Git Hook (Post-Merge)

Add to `.git/hooks/post-merge`:

```bash
#!/bin/bash
./scripts/update-agents-registry.sh
git add AGENTS.md
```

---

*This file is auto-generated. Do not edit manually.*
*Run `./scripts/update-agents-registry.sh` to regenerate.*
FOOTER

# Update timestamp and move to final location
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
sed -i "s/TIMESTAMP/$TIMESTAMP/" "$TEMP_FILE"
mv "$TEMP_FILE" "$REGISTRY_FILE"

echo ""
echo "✓ agents-docs/AGENTS.md updated successfully"
echo "  Timestamp: $TIMESTAMP"
echo ""
echo "Agents found:"
echo "  - Claude Code: $(find .claude/agents -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "  - OpenCode: $(find .opencode/agents -name '*.md' ! -type l 2>/dev/null | wc -l | tr -d ' ')"
echo "  - Skills: $(find .agents/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "To commit changes:"
echo "  git add agents-docs/AGENTS.md"
echo "  git commit -m 'docs: update agents registry'"
