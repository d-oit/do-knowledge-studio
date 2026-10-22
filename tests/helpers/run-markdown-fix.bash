#!/usr/bin/env bash
# Exercises the scoped Markdown rewrite called by Phase 5 of self-fix-loop.sh.
# The fixture proves repository Markdown changes while ignored output and
# vendored skill files remain untouched.
set -euo pipefail

REPO_ROOT="${1:?usage: run-markdown-fix.bash <repo-root>}"
cd "$REPO_ROOT"

# shellcheck source=scripts/lib/markdown-files.sh
source "$REPO_ROOT/scripts/lib/markdown-files.sh"

# The same repository-owned Markdown rewrite the fix phase uses.
trim_markdown_trailing_whitespace
