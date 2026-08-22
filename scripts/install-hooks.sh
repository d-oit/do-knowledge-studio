#!/usr/bin/env bash
# Install git hooks for local development.
#
# Since Plan 131 G7 the hooks live in the committed `.githooks/` directory;
# this script only points `core.hooksPath` at it so installation survives
# clone rebuilds and devcontainer rebuilds (unlike writing into .git/hooks).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(dirname "$SCRIPT_DIR")}"
cd "$REPO_ROOT"

if [ ! -d "$REPO_ROOT/.githooks" ]; then
  echo "✖ .githooks/ directory missing — repository is malformed." >&2
  exit 1
fi

for hook in pre-commit commit-msg; do
  if [ ! -x "$REPO_ROOT/.githooks/$hook" ]; then
    echo "✖ .githooks/$hook is missing or not executable." >&2
    exit 1
  fi
done

if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &>/dev/null 2>&1; then
  git -C "$REPO_ROOT" config core.hooksPath .githooks
  echo "Git hooks active via core.hooksPath=.githooks"
else
  # Not a git checkout (e.g. Vercel archive build during `prepare`) — nothing
  # to configure, and hooks are irrelevant outside a repository.
  echo "Not a git repository — skipping hook activation."
fi
