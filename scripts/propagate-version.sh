#!/usr/bin/env bash
# scripts/propagate-version.sh — sync the VERSION file to derived version strings.
#
# The `VERSION` file at the repo root is the single source of truth. This
# script propagates it to the derived references documented in
# agents-docs/VERSION.md:
#
#   - agents-docs/VERSION.md   ("the current version is X.Y.Z" + table row)
#   - agents-docs/MIGRATION.md (badge + "Template version: X.Y.Z")
#   - README.md                (badge, if present)
#
# Usage: ./scripts/propagate-version.sh
# Env:   REPO_ROOT (defaults to the repo root) — used by the BATS suite for
#        hermetic testing against a temp workspace.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
VERSION_FILE="$REPO_ROOT/VERSION"

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "error: VERSION file not found at $VERSION_FILE" >&2
  exit 1
fi

version="$(tr -d '[:space:]' < "$VERSION_FILE")"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: invalid version '$version' in $VERSION_FILE (expected X.Y.Z)" >&2
  exit 1
fi

# Portable in-place sed: BSD sed (macOS) requires -i with a backup suffix.
# GNU sed (Linux) accepts both forms.
sed_inplace() {
  local file="$1" expression="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i -E "$expression" "$file"
  else
    sed -i '' -E "$expression" "$file"
  fi
}

# Pattern -> replacement pairs applied to each target file. The version
# regex matches the existing X.Y.Z string wherever it appears.
version_pattern='[0-9]+\.[0-9]+\.[0-9]+'
apply_version() {
  local file="$1"; shift
  local expression replacement
  while (($# >= 2)); do
    expression="$1"
    replacement="$2"
    sed_inplace "$file" "s/$expression/$replacement/"
    shift 2
  done
}

# agents-docs/VERSION.md — "current version" sentence + versioned-files table.
version_md="$REPO_ROOT/agents-docs/VERSION.md"
if [[ -f "$version_md" ]]; then
  apply_version "$version_md" \
    "the current version is \`$version_pattern\`" "the current version is \`$version\`" \
    "^\| \`VERSION\` \| \`$version_pattern\` \|" "| \`VERSION\` | \`$version\` |"
fi

# agents-docs/MIGRATION.md — badge + "Template version:" text.
migration_md="$REPO_ROOT/agents-docs/MIGRATION.md"
if [[ -f "$migration_md" ]]; then
  apply_version "$migration_md" \
    "version-$version_pattern-blue" "version-$version-blue" \
    "Template version: $version_pattern" "Template version: $version"
fi

# README.md — badge (only when a version badge exists).
readme="$REPO_ROOT/README.md"
if [[ -f "$readme" ]]; then
  apply_version "$readme" "version-$version_pattern-blue" "version-$version-blue"
fi

echo "propagated version $version"
