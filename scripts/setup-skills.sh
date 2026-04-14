#!/usr/bin/env bash
# Creates symlinks from CLI-specific folders -> .agents/skills/ (canonical source)
# Run once after cloning: ./scripts/setup-skills.sh
# Note: OpenCode reads skills directly from .agents/skills/ - no symlinks needed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
SKILLS_SRC="$REPO_ROOT/.agents/skills"

# CLI folders that should contain symlinks to canonical skills
# (OpenCode reads directly from .agents/skills/ - not included here)
# (Qwen CLI also reads directly from .agents/skills/ - directory created for consistency)
CLI_SKILL_DIRS=(
  ".claude/skills"
  ".gemini/skills"
  ".qwen/skills"
)

if [ ! -d "$SKILLS_SRC" ]; then
  echo "No skills found at .agents/skills/ - nothing to symlink."
  exit 0
fi

echo "Setting up skill symlinks from .agents/skills/..."

for cli_dir in "${CLI_SKILL_DIRS[@]}"; do
  target_dir="$REPO_ROOT/$cli_dir"
  mkdir -p "$target_dir"

  for skill_path in "$SKILLS_SRC"/*/; do
    [ -d "$skill_path" ] || continue
    skill_name="$(basename "$skill_path")"
    link="$target_dir/$skill_name"
    # Relative path from CLI dir back to .agents/skills
    rel="$(realpath --relative-to="$target_dir" "$skill_path")"

    if [ -L "$link" ]; then
      echo "  skip (exists): $cli_dir/$skill_name"
    elif [ -d "$link" ]; then
      echo "  WARN: real dir exists at $cli_dir/$skill_name - skipping"
    else
      ln -s "$rel" "$link"
      echo "  linked: $cli_dir/$skill_name -> $rel"
    fi
  done
done

echo ""
echo "Skill symlinks created. Run scripts/validate-skills.sh to verify."