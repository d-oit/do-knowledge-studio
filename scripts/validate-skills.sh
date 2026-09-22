#!/usr/bin/env bash
# Validates all CLI skill symlinks and SKILL.md files.
# Delegates to scripts/agent-surface.py
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)}"
cd "$REPO_ROOT"

PYTHON_BIN="${PYTHON_BIN:-python3}"
PY_YAML_VERSION="6.0.3"
VALIDATOR_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/do-knowledge-studio"
VALIDATOR_VENV_DIR="$VALIDATOR_CACHE_DIR/agent-surface"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "ERROR: Python is required to validate skills." >&2
  exit 1
fi

VALIDATOR_PYTHON="$PYTHON_BIN"
if ! "$VALIDATOR_PYTHON" -c 'import yaml' >/dev/null 2>&1; then
  mkdir -p "$VALIDATOR_CACHE_DIR"
  if [ ! -x "$VALIDATOR_VENV_DIR/bin/python" ]; then
    "$PYTHON_BIN" -m venv "$VALIDATOR_VENV_DIR"
  fi
  VALIDATOR_PYTHON="$VALIDATOR_VENV_DIR/bin/python"
  if ! "$VALIDATOR_PYTHON" -c 'import yaml' >/dev/null 2>&1; then
    "$VALIDATOR_PYTHON" -m pip install --disable-pip-version-check "PyYAML==$PY_YAML_VERSION"
  fi
fi

echo "Validating skills via agent-surface.py..."
"$VALIDATOR_PYTHON" ./scripts/agent-surface.py validate
