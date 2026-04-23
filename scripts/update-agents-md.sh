#!/usr/bin/env bash
# Auto-update AGENTS.md skill table from .agents/skills/
# Delegates to scripts/agent-surface.py
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
cd "$REPO_ROOT"

echo "Updating AGENTS.md via agent-surface.py..."
./scripts/agent-surface.py generate-docs
