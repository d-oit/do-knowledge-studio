#!/usr/bin/env bash
# verify-deps.sh — Verify dependency changes don't break the build.
# Run after merging dependabot PRs or manual dependency bumps.
# Exit 0 = all clear, Exit 1 = issues found.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0
ERR_LOG=$(mktemp)
trap 'rm -f "$ERR_LOG"' EXIT

echo "=== Dependency Verification ==="
echo ""

# 1. Check lockfile is in sync
echo -n "1. Lockfile sync... "
if pnpm install --frozen-lockfile >"$ERR_LOG" 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — lockfile out of date${NC}"
  echo "   Run: pnpm install"
  tail -5 "$ERR_LOG"
  FAILED=1
fi

# 2. TypeScript compilation
echo -n "2. Typecheck... "
if pnpm run typecheck >"$ERR_LOG" 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — typecheck errors (possible breaking API change)${NC}"
  grep -E 'error TS' "$ERR_LOG" | head -5
  FAILED=1
fi

# 3. Lint
echo -n "3. Lint... "
if pnpm run lint >"$ERR_LOG" 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — lint errors${NC}"
  tail -10 "$ERR_LOG"
  FAILED=1
fi

# 4. Tests
echo -n "4. Tests... "
if pnpm run test >"$ERR_LOG" 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — test failures${NC}"
  grep -E 'FAIL|Error' "$ERR_LOG" | head -5
  FAILED=1
fi

# 5. Production build (the Vercel gate)
echo -n "5. Build (Vercel gate)... "
if pnpm run build >"$ERR_LOG" 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — build failed (Vercel deployment will fail)${NC}"
  grep -iE 'error' "$ERR_LOG" | grep -v '^$' | head -5
  FAILED=1
fi

# 6. Check for major version bumps in recent lockfile changes
echo ""
echo "6. Major version bump detection..."
if git diff --name-only HEAD~1 2>/dev/null | grep -q 'pnpm-lock.yaml\|package.json'; then
  echo -e "   ${YELLOW}Dependency files changed in last commit — review above results carefully.${NC}"
  if git diff HEAD~1 -- package.json 2>/dev/null | grep -qE '^\+.*"typescript": "\^[6-9]'; then
    echo -e "   ${YELLOW}! TypeScript major bump detected — check tsconfig for deprecated options.${NC}"
  fi
  if git diff HEAD~1 -- package.json 2>/dev/null | grep -qE '^\+.*"react-resizable-panels": "\^[4-9]'; then
    echo -e "   ${YELLOW}! react-resizable-panels major bump — check for renamed exports.${NC}"
  fi
else
  echo -e "   ${GREEN}No dependency changes in last commit.${NC}"
fi

echo ""
if [ $FAILED -ne 0 ]; then
  echo -e "${RED}=== VERIFICATION FAILED ===${NC}"
  echo "Fix the issues above before pushing to main."
  exit 1
fi

echo -e "${GREEN}=== ALL CHECKS PASSED ===${NC}"
echo "Safe to push. Vercel deployment should succeed."