#!/usr/bin/env bash
# Install git hooks for local development.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

HOOKS_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Not a git repository — skipping hook installation."
  exit 0
fi

# Pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/usr/bin/env bash
# Run quality checks before commit.
echo "Running pre-commit quality gate..."
./scripts/minimal_quality_gate.sh
HOOK
chmod +x "$HOOKS_DIR/pre-commit"

echo "Git hooks installed."
