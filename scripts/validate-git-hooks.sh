#!/usr/bin/env bash
# Validates git hooks configuration.
# Checks that local hooks are installed and match the expected scripts.
# This is used by quality_gate.sh to ensure consistent hook behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Resolve the hooks dir via git so linked worktrees (where .git is a file,
# not a directory) validate against the common hooks directory.
if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &>/dev/null 2>&1; then
  GIT_HOOKS=$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null)
  if [[ "$GIT_HOOKS" != /* ]]; then
    GIT_HOOKS="$REPO_ROOT/$GIT_HOOKS"
  fi
  HOOK_DIR="$GIT_HOOKS"
else
  HOOK_DIR=".git/hooks"
fi
EXPECTED_HOOKS=("pre-commit" "commit-msg")

MISSING=0

for hook in "${EXPECTED_HOOKS[@]}"; do
    hook_path="${HOOK_DIR}/${hook}"
    if [ ! -f "$hook_path" ]; then
        echo "⚠ Missing hook: ${hook}"
        MISSING=1
    elif [ ! -x "$hook_path" ]; then
        echo "⚠ Hook not executable: ${hook}"
        MISSING=1
    fi
done

if [ "$MISSING" -eq 1 ]; then
    echo "Some git hooks are missing. Run ./scripts/install-hooks.sh to set them up."
    exit 1
fi

echo "✓ Git hooks are properly configured."
exit 0
