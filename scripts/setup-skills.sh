#!/usr/bin/env bash
# Creates symlinks from CLI-specific folders -> .agents/skills/ (canonical source)
# Delegates to scripts/agent-surface.py
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
cd "$REPO_ROOT"

echo "Setting up skill symlinks via agent-surface.py..."
./scripts/agent-surface.py sync
