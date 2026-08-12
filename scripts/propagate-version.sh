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

# agents-docs/VERSION.md — "current version" sentence + versioned-files table.
version_md="$REPO_ROOT/agents-docs/VERSION.md"
if [[ -f "$version_md" ]]; then
  sed -i -E "s/the current version is \`[0-9]+\.[0-9]+\.[0-9]+\`/the current version is \`$version\`/" "$version_md"
  sed -i -E "s/^\| \`VERSION\` \| \`[0-9]+\.[0-9]+\.[0-9]+\` \|/| \`VERSION\` | \`$version\` |/" "$version_md"
fi

# agents-docs/MIGRATION.md — badge + "Template version:" text.
migration_md="$REPO_ROOT/agents-docs/MIGRATION.md"
if [[ -f "$migration_md" ]]; then
  sed -i -E "s/version-[0-9]+\.[0-9]+\.[0-9]+-blue/version-$version-blue/" "$migration_md"
  sed -i -E "s/Template version: [0-9]+\.[0-9]+\.[0-9]+/Template version: $version/" "$migration_md"
fi

# README.md — badge (only when a version badge exists).
readme="$REPO_ROOT/README.md"
if [[ -f "$readme" ]]; then
  sed -i -E "s/version-[0-9]+\.[0-9]+\.[0-9]+-blue/version-$version-blue/" "$readme"
fi

echo "propagated version $version"
