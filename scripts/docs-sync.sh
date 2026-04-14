#!/usr/bin/env bash
# Lightweight docs sync via git hooks - minimal tokens
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
LAST_COMMIT="${1:-HEAD~1}"
CURRENT="${2:-HEAD}"

echo "Syncing docs $LAST_COMMIT → $CURRENT"

git diff --name-only "$LAST_COMMIT" "$CURRENT" -- '*.md' 2>/dev/null | while read -r file; do
  [ -f "$REPO_ROOT/$file" ] && echo "Updated: $file"
done

count=$(git diff --name-only "$LAST_COMMIT" "$CURRENT" -- '*.md' 2>/dev/null | wc -l)
echo "Done. $count files."