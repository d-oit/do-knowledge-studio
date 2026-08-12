#!/usr/bin/env bash
# Full verification — lint, typecheck, test, build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
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
# Match the CI yaml-lint workflow exactly: inline -d config with a 120-char
# line limit (the repo's .yamllint.yml is more lenient at 254).
run_check "YAML Lint (CI parity)" yamllint -d \
  '{extends: default, rules: {line-length: {max: 120}, indentation: {spaces: 2}}}' \
  .github/
# BATS regression tests for shell scripts (tests/*.bats). quality_gate.sh
# runs the same suite automatically when tests/ exists.
if command -v bats &> /dev/null; then
  run_check "Shell Tests (BATS)" bats tests/
else
  echo -e "${YELLOW}⚠ bats not installed - skipping shell tests${NC}"
fi
run_check "Typecheck" pnpm run typecheck
run_check "Tests" pnpm run test
run_check "Build" pnpm run build

if [ "$FAILED" -ne 0 ]; then
  echo -e "${RED}Verification failed.${NC}"
  exit 1
fi

echo -e "${GREEN}All checks passed.${NC}"
