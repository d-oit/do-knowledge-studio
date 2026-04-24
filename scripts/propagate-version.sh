#!/usr/bin/env bash
# Propagate VERSION to all files that reference it.
# Single source of truth: VERSION file
# Exit 0 = success, Exit 1 = error
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Read version from single source of truth
if [ ! -f "VERSION" ]; then
    echo "Error: VERSION file not found"
    exit 1
fi

VERSION=$(cat VERSION | tr -d '[:space:]')

if [ -z "$VERSION" ]; then
    echo "Error: VERSION file is empty"
    exit 1
fi

echo "Propagating version $VERSION..."

# Files that contain version badges or references
# Pattern: version-0.X.Y in badges, Template version: X.Y.Z in text
FILES_TO_UPDATE=(
    "README.md"
    "agents-docs/MIGRATION.md"
    "package.json"
)

UPDATED=0

for file in "${FILES_TO_UPDATE[@]}"; do
    if [ ! -f "$file" ]; then
        echo "Warning: $file not found, skipping"
        continue
    fi

    # Update version badges: version-0.X.Y -> version-NEW_VERSION
    if grep -q "version-[0-9]" "$file" 2>/dev/null; then
        sed -i "s/version-[0-9]\+\.[0-9]\+\.[0-9]\+/version-${VERSION}/g" "$file"
        UPDATED=1
        echo "  Updated version badge in $file"
    fi

    # Update "Template version: X.Y.Z" text
    if grep -q "Template version:" "$file" 2>/dev/null; then
        sed -i "s/Template version: [0-9]\+\.[0-9]\+\.[0-9]\+/Template version: ${VERSION}/g" "$file"
        UPDATED=1
        echo "  Updated template version in $file"
    fi
done

# Update CHANGELOG.md - add unreleased section if missing
if [ -f "CHANGELOG.md" ]; then
    if ! grep -q "^## \[Unreleased\]" CHANGELOG.md 2>/dev/null; then
        sed -i "1a\\\\n## [Unreleased]\n" CHANGELOG.md
        echo "  Added [Unreleased] section to CHANGELOG.md"
        UPDATED=1
    fi
fi

if [ $UPDATED -eq 0 ]; then
    echo "  No updates needed"
else
    echo "Version $VERSION propagated successfully"
fi
