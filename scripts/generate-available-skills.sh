#!/usr/bin/env bash
# generate-available-skills.sh - Auto-generate AVAILABLE_AVAILABLE_SKILLS.md from skill definitions
#
# Usage: ./scripts/generate-available-skills.sh
#
# Reads frontmatter from .agents/skills/*/SKILL.md and regenerates
# agents-docs/AVAILABLE_AVAILABLE_SKILLS.md. Run after adding/updating skills.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.agents/skills"
OUTPUT_FILE="$REPO_ROOT/agents-docs/AVAILABLE_AVAILABLE_SKILLS.md"

# Collect skills by category
declare -A CATEGORIES
declare -A SKILL_DESCRIPTIONS
declare -A SKILL_CATEGORIES

for skill_path in "$SKILLS_DIR"/*/; do
    [ -d "$skill_path" ] || continue
    skill_name="$(basename "$skill_path")"

    # Skip internal folders
    [[ "$skill_name" == _* ]] && continue

    skill_file="$skill_path/SKILL.md"
    [ -f "$skill_file" ] || continue

    # Extract description (handle YAML multiline strings: >, >-, |)
    description=$(awk '/^description:/{
        sub(/^description: */, "")
        sub(/^["'"'"']/, "")
        sub(/["'"'"']$/, "")
        if ($0 ~ /^>[-|]?$/) {
            # Multiline - read subsequent lines starting with space
            desc = ""
            while (getline > 0 && $0 ~ /^  /) {
                line = $0
                sub(/^  /, "", line)
                desc = (desc == "" ? line : desc " " line)
            }
            print desc
        } else {
            print
        }
        exit
    }' "$skill_file" || echo "No description available")

    # Extract category (handle YAML multiline strings)
    category=$(awk '/^category:/{
        sub(/^category: */, "")
        sub(/^["'"'"']/, "")
        sub(/["'"'"']$/, "")
        print
        exit
    }' "$skill_file")
    [ -z "$category" ] && category="general"

    # Capitalize category for display
    category_display=$(echo "$category" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')

    CATEGORIES["$category"]=1
    SKILL_DESCRIPTIONS["$skill_name"]="$description"
    SKILL_CATEGORIES["$skill_name"]="$category"
done

# Generate output
{
    echo "# Available Skills Reference"
    echo ""
    echo "> Auto-generated from skill definitions in \`.agents/skills/\`"
    echo "> Do not edit manually. Run \`./scripts/generate-available-skills.sh\` to regenerate."
    echo ""

    # Sort categories and output
    for category in $(echo "${!CATEGORIES[@]}" | tr ' ' '\n' | sort); do
        category_display=$(echo "$category" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
        echo "## $category_display"
        echo ""
        echo "| Skill | Description |"
        echo "|-------|-------------|"

        for skill_name in $(echo "${!SKILL_CATEGORIES[@]}" | tr ' ' '\n' | sort); do
            if [[ "${SKILL_CATEGORIES[$skill_name]}" == "$category" ]]; then
                echo "| \`$skill_name\` | ${SKILL_DESCRIPTIONS[$skill_name]} |"
            fi
        done
        echo ""
    done

    echo "## Usage"
    echo ""
    echo "Skills are triggered automatically based on context or loaded explicitly."
    echo "See \`agents-docs/AVAILABLE_SKILLS.md\` for loading skills manually."
    echo ""
    echo "## See Also"
    echo ""
    echo "- \`agents-docs/AVAILABLE_SKILLS.md\` - Skill authoring guide"
    echo "- \`.agents/skills/skill-rules.json\` - Skill validation rules"
} > "$OUTPUT_FILE"

echo "Generated $OUTPUT_FILE with ${#SKILL_DESCRIPTIONS[@]} skills"
