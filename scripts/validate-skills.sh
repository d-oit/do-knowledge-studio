#!/usr/bin/env bash
# Validates all skill directories and SKILL.md files.
#
# Delegates to the deep validator (scripts/agent-surface.py) when it exists, and
# falls back to a lightweight structural check otherwise so the quality gate can
# still run even when the Python toolchain is not vendored.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Delegate to the canonical deep validator when it is present.
if [ -f "$REPO_ROOT/scripts/agent-surface.py" ]; then
    echo "Validating skills via agent-surface.py..."
    exec "$REPO_ROOT/scripts/agent-surface.py" validate
fi

# Fallback: structural validation of every skill directory.
SKILLS_DIR="$REPO_ROOT/.agents/skills"
if [ ! -d "$SKILLS_DIR" ]; then
    echo "⚠ Skills directory not found: $SKILLS_DIR"
    exit 0
fi

FAILED=0
COUNT=0

for skill_dir in "$SKILLS_DIR"/*/; do
    [ -d "$skill_dir" ] || continue
    name="$(basename "$skill_dir")"

    # Skip backup/consolidated folders prefixed with an underscore.
    case "$name" in _*) continue ;; esac

    skill_file="$skill_dir/SKILL.md"
    if [ ! -f "$skill_file" ]; then
        echo "✗ $name: missing SKILL.md"
        FAILED=1
        continue
    fi

    COUNT=$((COUNT + 1))

    # SKILL.md must open with YAML frontmatter and declare a name.
    if ! head -5 "$skill_file" | grep -q '^---$'; then
        echo "✗ $name: SKILL.md is missing YAML frontmatter"
        FAILED=1
        continue
    fi

    if ! grep -qE '^name:[[:space:]]*[^[:space:]]+' "$skill_file"; then
        echo "✗ $name: SKILL.md frontmatter is missing a name field"
        FAILED=1
    fi
done

echo ""
echo "⚠ Deep skill validation skipped (scripts/agent-surface.py not found)."
echo "  Checked $COUNT skill(s) for SKILL.md presence and frontmatter."

if [ "$FAILED" -ne 0 ]; then
    echo "✗ Skill structure validation failed."
    exit 2
fi

echo "✓ Skill structure validation passed."
exit 0
