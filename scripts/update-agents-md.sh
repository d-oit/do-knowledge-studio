#!/usr/bin/env bash
# Auto-update AGENTS.md skill table from .agents/skills/
# Preserves all other content (header, sections, reference docs)
# Run manually or via git hook when skills change
# Usage: ./scripts/update-agents-md.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

AGENTS_FILE="$REPO_ROOT/AGENTS.md"
TEMP_FILE="$REPO_ROOT/.agents_md_temp.md"
temp_table="$REPO_ROOT/.temp_table.md"  # Define before trap

# Trap to clean up temp files on exit or error
trap 'rm -f "$TEMP_FILE" "$temp_table"' EXIT ERR

# Check if AGENTS.md exists
if [ ! -f "$AGENTS_FILE" ]; then
    echo "Error: AGENTS.md not found at $AGENTS_FILE"
    exit 1
fi

echo "Updating AGENTS.md skill table..."

# Find the line number of "### Available Skills"
SKILLS_SECTION_LINE=$(grep -n "^### Available Skills" "$AGENTS_FILE" | head -1 | cut -d: -f1)

if [ -z "$SKILLS_SECTION_LINE" ]; then
    echo "Error: Could not find '### Available Skills' section in AGENTS.md"
    exit 1
fi

# Find the line number of "### Context Discipline" (end of skills table)
NEXT_SECTION_LINE=$(grep -n "^### Context Discipline" "$AGENTS_FILE" | head -1 | cut -d: -f1)

if [ -z "$NEXT_SECTION_LINE" ]; then
    echo "Error: Could not find '### Context Discipline' section in AGENTS.md"
    exit 1
fi

# Extract everything before the table (including the header)
head -n "$SKILLS_SECTION_LINE" "$AGENTS_FILE" > "$TEMP_FILE"

# Add table header
cat >> "$TEMP_FILE" << 'TABLE_HEADER'

| Skill | Description | Category |
|-------|-------------|----------|
TABLE_HEADER

# Generate skill rows by scanning .agents/skills/
if [ -d "$REPO_ROOT/.agents/skills" ]; then
    # Get list of skill directories (excluding files like README.md and skill-rules.json)
    for skill_dir in "$REPO_ROOT/.agents/skills"/*/; do
        [ -d "$skill_dir" ] || continue
        
        skill_name=$(basename "$skill_dir")
        
        # Skip non-skill items (files, etc.)
        [ -f "$skill_dir/SKILL.md" ] || continue
        
        # Extract description from frontmatter (handling block scalars)
        description=$(sed -n '/^description:/,/^[a-z-]*:/p' "$skill_dir/SKILL.md" 2>/dev/null | \
            sed '1s/^description: *//;$d' | \
            tr '\n' ' ' | \
            sed 's/  */ /g;s/^[>-] *//' | \
            cut -c1-60 || echo "No description")
        
        # Extract category from AGENTS.md if it exists, otherwise default to "General"
        # Look for this skill in the existing table to preserve its category
        category=$(grep "| \`${skill_name}\` |" "$AGENTS_FILE" 2>/dev/null | \
            sed 's/.*| \([^|]*\) |$/\1/' | \
            tr -d ' ' || echo "")
        
        # If no category found, try to infer from skill name or use "General"
        if [ -z "$category" ]; then
            case "$skill_name" in
                *security*|*privacy*|*audit*) category="Security" ;;
                *test*|*quality*|*check*) category="Quality" ;;
                *doc*|*readme*) category="Documentation" ;;
                *api*) category="API Development" ;;
                *coordination*|*parallel*|*goap*|*decomposition*) category="Coordination" ;;
                *db*|*database*|*devops*|*cicd*|*pipeline*) category="DevOps" ;;
                *ui*|*ux*) category="UI/UX" ;;
                *skill*) category="Meta" ;;
                *search*|*web*) category="Research" ;;
                *migration*|*refactor*) category="Migration" ;;
                *intent*|*classifier*) category="Coordination" ;;
                *accessibility*) category="Accessibility" ;;
                *shell*|*script*) category="Code Quality" ;;
                *) category="General" ;;
            esac
        fi
        
        # Clean up description
        description=${description%% }
        
        echo "| \`${skill_name}\` | ${description} | ${category} |" >> "$TEMP_FILE"
    done
fi

# Sort the table rows (excluding header) alphabetically by skill name
head -n $((SKILLS_SECTION_LINE + 3)) "$TEMP_FILE" > "$temp_table"
tail -n +$((SKILLS_SECTION_LINE + 4)) "$TEMP_FILE" | sort >> "$temp_table"
mv "$temp_table" "$TEMP_FILE"

# Add empty line before next section
echo "" >> "$TEMP_FILE"

# Append everything after the table (from "### Context Discipline" onwards)
tail -n +"$NEXT_SECTION_LINE" "$AGENTS_FILE" >> "$TEMP_FILE"

# Replace original file
mv "$TEMP_FILE" "$AGENTS_FILE"

# Count skills
SKILL_COUNT=$(find "$REPO_ROOT/.agents/skills" -mindepth 1 -maxdepth 1 -type d | wc -l)

echo ""
echo "✓ AGENTS.md updated successfully"
echo "  Skills in table: $SKILL_COUNT"
echo ""
echo "To commit changes:"
echo "  git add AGENTS.md"
echo "  git commit -m 'docs: update skill table'"
