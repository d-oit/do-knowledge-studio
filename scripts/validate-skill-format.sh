#!/usr/bin/env bash
# DEPRECATED: Use scripts/validate-skills.sh instead.
# This script is kept for backward compatibility and now delegates to validate-skills.sh.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$REPO_ROOT/scripts/validate-skills.sh" "$@"
