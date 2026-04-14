#!/usr/bin/env bash
# Validates SKILL.md format using shared validation library.
# Checks: frontmatter start, name/description fields, line count.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/skill-validation.sh
source "$REPO_ROOT/scripts/lib/skill-validation.sh"

echo "=== Validating SKILL.md Format ==="
ERRORS=0

for skill_dir in "$SKILLS_SRC"/*/; do
    if [[ -d "$skill_dir" ]]; then
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == _* ]] && continue

        if validate_skill_file "${skill_dir}SKILL.md"; then
            lines=$(wc -l < "${skill_dir}SKILL.md" | tr -d ' ')
            echo -e "  ${GREEN}[OK]${NC} $skill_name: Valid ($lines lines)"
        else
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo "All SKILL.md files passed validation"
    exit 0
else
    echo "Found $ERRORS skill(s) with errors"
    exit 1
fi
