#!/usr/bin/env bash
# Minimal quality gate — fast checks for quick iteration.
# Runs lint, typecheck, and tests (no build).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0

run_check() {
  local name="$1"
  shift
  echo -e "${BLUE}Running ${name}...${NC}"
  if "$@"; then
    echo -e "${GREEN}✓ ${name} passed${NC}"
  else
    echo -e "${RED}✗ ${name} failed${NC}"
    FAILED=1
  fi
  echo ""
}

run_check "Lint" pnpm run lint
run_check "Typecheck" pnpm run typecheck
run_check "Tests" pnpm run test

if [ "$FAILED" -ne 0 ]; then
  echo -e "${RED}Quality gate failed.${NC}"
  exit 1
fi

echo -e "${GREEN}Minimal quality gate passed.${NC}"
