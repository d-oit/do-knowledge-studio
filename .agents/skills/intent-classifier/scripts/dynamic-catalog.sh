#!/bin/bash
# Dynamic Skill Catalog Updater
# Scans .agents/skills/ and regenerates the skill catalog

# Get repository root for portable paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../" && pwd)"

SKILLS_DIR="${1:-$REPO_ROOT/.agents/skills}"
CATALOG_FILE="$REPO_ROOT/.agents/skills/intent-classifier/references/skill-catalog.md"

# Check if skills directory exists
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo "Error: Skills directory not found: $SKILLS_DIR"
    exit 1
fi

# Generate header
cat > "$CATALOG_FILE" << 'HEADER'
# Skill Catalog

> Auto-generated from `.agents/skills/` directory.
HEADER

# Add timestamp
{
    echo ">> Last updated: $(date +%Y-%m-%d)"
    echo ""
    echo "## Available Skills"
    echo ""
    echo "| Skill | Description | Key Triggers |"
    echo "|-------|-------------|--------------|"
} >> "$CATALOG_FILE"

# Process each skill
for skill_path in "$SKILLS_DIR"/*/; do
    if [[ -f "$skill_path/SKILL.md" ]]; then
        skill_name=$(basename "$skill_path")
        
        # Extract description from frontmatter
        description=$(awk '/^---$/{p=!p;next} p && /^description:/{gsub(/^description: /,""); print; exit}' "$skill_path/SKILL.md" 2>/dev/null || echo "No description available")
        
        # Extract keywords (first 5 words from description, excluding common words)
        triggers=$(echo "$description" | tr '[:upper:]' '[:lower:]' | \
            grep -oE '\b[a-z]+\b' | \
            grep -vE '^(use|when|the|and|or|for|to|with|a|an|this|that|these|those|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|can|shall|must|need|want|ask)$' | \
            head -5 | \
            tr '\n' ',' | \
            sed 's/,$//')
        
        # Truncate description for table
        short_desc="${description:0:100}"
        if [[ ${#description} -gt 100 ]]; then
            short_desc="${short_desc}..."
        fi
        
        echo "| $skill_name | $short_desc | $triggers |" >> "$CATALOG_FILE"
    fi
done

{
    echo ""
    echo "## Update Catalog"
    echo ""
    echo "To regenerate this catalog:"
    echo '```bash'
    echo "./scripts/dynamic-catalog.sh"
    echo '```'
} >> "$CATALOG_FILE"

echo "Skill catalog updated: $CATALOG_FILE"
echo "Total skills indexed: $(grep -c '^| [a-z-]* |' "$CATALOG_FILE" || echo 0)"
