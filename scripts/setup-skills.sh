#!/usr/bin/env bash
# Setup skill symlinks for agent discovery.
# Reads manifest.json and creates symlinks for all declared tools.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

MANIFEST="$REPO_ROOT/.agents/manifest.json"
AGENTS_DIR="$REPO_ROOT/.agents/skills"

if [ ! -d "$AGENTS_DIR" ]; then
  echo "No .agents/skills directory found — skipping."
  exit 0
fi

if [ ! -f "$MANIFEST" ]; then
  echo "No .agents/manifest.json found — skipping."
  exit 0
fi

# Parse manifest with node (available in Node.js projects)
TOOLS=$(node -e "
const fs = require('fs');
const manifestPath = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tools = manifest.tools || {};
for (const [name, config] of Object.entries(tools)) {
  if (config.symlink_strategy === 'none') continue;
  console.log(name + '|' + (config.directory || '') + '|' + (config.skills_directory || ''));
}
" -- "$MANIFEST")

while IFS='|' read -r tool_name tool_dir skills_dir; do
  if [ -z "$tool_name" ] || [ -z "$tool_dir" ] || [ -z "$skills_dir" ]; then
    continue
  fi

  FULL_TOOL_DIR="$REPO_ROOT/$tool_dir"
  FULL_SKILLS_DIR="$REPO_ROOT/$skills_dir"
  CANONICAL_SKILLS="$REPO_ROOT/$AGENTS_DIR"

  # Create tool directory if it doesn't exist
  mkdir -p "$FULL_TOOL_DIR"

  # Create symlink for skills
  if [ -L "$FULL_SKILLS_DIR" ]; then
    echo "Symlink already exists: $FULL_SKILLS_DIR"
  elif [ -e "$FULL_SKILLS_DIR" ]; then
    echo "Warning: $FULL_SKILLS_DIR exists and is not a symlink. Skipping."
  else
    ln -s "../agents/skills" "$FULL_SKILLS_DIR"
    echo "Created symlink: $FULL_SKILLS_DIR -> ../agents/skills"
  fi
done <<< "$TOOLS"

echo "Skills setup complete."
