#!/usr/bin/env bash
# Validates all CLI skill symlinks and SKILL.md files.
# Delegates to scripts/agent-surface.py
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
cd "$REPO_ROOT"

echo "Validating skills via agent-surface.py..."
./scripts/agent-surface.py validate
