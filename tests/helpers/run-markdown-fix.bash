#!/usr/bin/env bash
# Runs the markdown branch of scripts/self-fix-loop.sh exactly as that script
# runs it, so the BATS test exercises the real rewrite rather than a copy of
# it. Sourced with the repository root as the only argument.
set -euo pipefail

REPO_ROOT="${1:?usage: run-markdown-fix.sh <repo-root>}"
cd "$REPO_ROOT"

# shellcheck source=scripts/lib/markdown-files.sh
source "$REPO_ROOT/scripts/lib/markdown-files.sh"

# The same call scripts/self-fix-loop.sh makes.
trim_markdown_trailing_whitespace
