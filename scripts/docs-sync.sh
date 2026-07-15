#!/usr/bin/env bash
# Sync documentation — ensure AGENTS.md and agents-docs/ are up to date.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "Checking documentation consistency..."

# Verify AGENTS.md exists
if [ ! -f "AGENTS.md" ]; then
  echo "Warning: AGENTS.md not found."
fi

# Verify agents-docs/ exists
if [ ! -d "agents-docs" ]; then
  echo "Warning: agents-docs/ directory not found."
fi

# Verify skills are set up
if [ -d ".agents/skills" ]; then
  SKILL_COUNT=$(find .agents/skills -name "SKILL.md" | wc -l)
  echo "Found ${SKILL_COUNT} skills."
fi

echo "Documentation check complete."
