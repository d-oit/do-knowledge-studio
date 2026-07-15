#!/usr/bin/env bash
# Setup skill symlinks for agent discovery.
# Creates .claude/skills -> .agents/skills symlink if it doesn't exist.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

CLAUDE_DIR="$REPO_ROOT/.claude"
AGENTS_DIR="$REPO_ROOT/.agents/skills"

if [ ! -d "$AGENTS_DIR" ]; then
  echo "No .agents/skills directory found — skipping."
  exit 0
fi

mkdir -p "$CLAUDE_DIR"

TARGET="$CLAUDE_DIR/skills"
if [ -L "$TARGET" ]; then
  echo "Symlink already exists: $TARGET"
elif [ -e "$TARGET" ]; then
  echo "Warning: $TARGET exists and is not a symlink. Skipping."
else
  ln -s "../agents/skills" "$TARGET"
  echo "Created symlink: $TARGET -> ../agents/skills"
fi

echo "Skills setup complete."
