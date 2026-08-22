#!/usr/bin/env bash
# Validates git hooks configuration (Plan 131 G7).
#
# Hooks are committed under .githooks/ and activated via core.hooksPath.
# This validator resolves the *effective* hooks directory the same way git
# does — core.hooksPath if set, else the committed .githooks/ fallback — so
# CI can verify hook contents on a fresh checkout instead of skipping.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HOOK_DIR=""

if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &>/dev/null 2>&1; then
  CONFIGURED=$(git -C "$REPO_ROOT" config --get core.hooksPath 2>/dev/null || true)
  if [ -n "$CONFIGURED" ]; then
    case "$CONFIGURED" in
      /*) HOOK_DIR="$CONFIGURED" ;;
      *)  HOOK_DIR="$REPO_ROOT/$CONFIGURED" ;;
    esac
  fi
fi

# Fall back to the committed hooks directory: on a fresh clone or in CI no
# local config exists yet, but the hooks themselves are version-controlled
# and will be activated by scripts/install-hooks.sh (run via `prepare`).
if [ -z "$HOOK_DIR" ] && [ -d "$REPO_ROOT/.githooks" ]; then
  HOOK_DIR="$REPO_ROOT/.githooks"
fi

if [ -z "$HOOK_DIR" ]; then
  # Last resort: legacy per-clone location.
  if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &>/dev/null 2>&1; then
    GIT_HOOKS=$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null)
    if [[ "$GIT_HOOKS" != /* ]]; then
      GIT_HOOKS="$REPO_ROOT/$GIT_HOOKS"
    fi
    HOOK_DIR="$GIT_HOOKS"
  else
    HOOK_DIR=".git/hooks"
  fi
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

echo "✓ Git hooks are properly configured (${HOOK_DIR})."
exit 0
