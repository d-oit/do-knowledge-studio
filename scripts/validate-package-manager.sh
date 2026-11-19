#!/usr/bin/env bash
# Validate that the correct package manager (pnpm) is being used
# Exits 0 if valid, 1 otherwise

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    NC="\033[0m"
else
    RED=""
    GREEN=""
    NC=""
fi

FAILED=0

echo "Validating package manager configuration..."

# 1. Ensure package-lock.json does not exist
if [ -f "package-lock.json" ]; then
    echo -e "${RED}✗ package-lock.json found!${NC}"
    echo "   The project is standardized on pnpm. Please remove package-lock.json."
    FAILED=1
else
    echo -e "${GREEN}✓ package-lock.json is absent${NC}"
fi

# 2. Ensure pnpm settings live in pnpm-workspace.yaml (pnpm 12 dropped the
#    package.json `pnpm` field; engine-strict moved there in plans/202).
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo -e "${RED}✗ pnpm-workspace.yaml is missing!${NC}"
    echo "   Workspace settings (engine-strict, overrides) live in pnpm-workspace.yaml."
    FAILED=1
else
    echo -e "${GREEN}✓ pnpm-workspace.yaml is present${NC}"
    if ! grep -q "engineStrict: true" pnpm-workspace.yaml; then
        echo -e "${RED}✗ pnpm-workspace.yaml missing 'engineStrict: true'${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✓ pnpm-workspace.yaml enforces engineStrict${NC}"
    fi
fi

# 3. Ensure no legacy settings remain in the wrong place
if [ -f ".npmrc" ] && grep -q "engine-strict" .npmrc; then
    echo -e "${RED}✗ .npmrc still carries engine-strict; it moved to pnpm-workspace.yaml (plans/202)${NC}"
    FAILED=1
fi

# 3. Ensure package.json has packageManager field
if [ -f "package.json" ]; then
    if ! grep -q "\"packageManager\":" package.json; then
        echo -e "${RED}✗ package.json is missing 'packageManager' field${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✓ package.json has 'packageManager' field${NC}"
    fi
fi

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Package manager validation passed.${NC}"
    exit 0
else
    echo -e "${RED}Package manager validation failed.${NC}"
    exit 1
fi
