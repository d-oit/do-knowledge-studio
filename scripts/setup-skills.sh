#!/usr/bin/env bash
# Setup manifest-managed skill links and generated agent surfaces.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(dirname "$SCRIPT_DIR")}"
MANIFEST="$REPO_ROOT/.agents/manifest.json"
AGENTS_DIR="$REPO_ROOT/.agents/skills"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [ ! -d "$AGENTS_DIR" ]; then
  echo "No .agents/skills directory found — skipping."
  exit 0
fi

if [ ! -f "$MANIFEST" ]; then
  echo "No .agents/manifest.json found — skipping."
  exit 0
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "ERROR: Python is required to sync agent surfaces." >&2
  exit 1
fi

REPO_ROOT="$REPO_ROOT" "$PYTHON_BIN" "$SCRIPT_DIR/agent-surface.py" sync
"$PYTHON_BIN" "$SCRIPT_DIR/generate-skills-docs.py" --root "$REPO_ROOT"

echo "Skills setup complete."
