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

# agent-surface.py imports PyYAML. Use the system module when it is importable;
# otherwise provision a cached virtual environment and put it first on PATH so the
# validator's own `#!/usr/bin/env python3` shebang resolves to an interpreter that
# has the dependency. The validator is still executed directly, so the delegation
# contract (and the BATS suite that encodes it) is unchanged.
if ! "$PYTHON_BIN" -c 'import yaml' >/dev/null 2>&1; then
  mkdir -p "$VALIDATOR_CACHE_DIR"
  if [ ! -x "$VALIDATOR_VENV_DIR/bin/python" ]; then
    "$PYTHON_BIN" -m venv "$VALIDATOR_VENV_DIR"
  fi
  if ! "$VALIDATOR_VENV_DIR/bin/python" -c 'import yaml' >/dev/null 2>&1; then
    "$VALIDATOR_VENV_DIR/bin/python" -m pip install --disable-pip-version-check "PyYAML==$PY_YAML_VERSION"
  fi
  PATH="$VALIDATOR_VENV_DIR/bin:$PATH"
  export PATH
fi

echo "Validating skills via agent-surface.py..."
./scripts/agent-surface.py validate
