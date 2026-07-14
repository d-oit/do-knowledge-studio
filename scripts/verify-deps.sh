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

echo "=== Dependency Verification ==="
echo ""

# 1. Check lockfile is in sync
echo -n "1. Lockfile sync... "
if pnpm install --frozen-lockfile 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — lockfile out of date, run: pnpm install${NC}"
  FAILED=1
fi

# 2. TypeScript compilation
echo -n "2. Typecheck... "
if pnpm run typecheck 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — typecheck errors (possible breaking API change)${NC}"
  FAILED=1
fi

# 3. Lint
echo -n "3. Lint... "
if pnpm run lint 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — lint errors${NC}"
  FAILED=1
fi

# 4. Tests
echo -n "4. Tests... "
if pnpm run test 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — test failures${NC}"
  FAILED=1
fi

# 5. Production build (the Vercel gate)
echo -n "5. Build (Vercel gate)... "
if pnpm run build 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL — build failed (Vercel deployment will fail)${NC}"
  FAILED=1
fi

# 6. Check for major version bumps in recent lockfile changes
echo ""
echo "6. Major version bump detection..."
if git diff --name-only HEAD~1 2>/dev/null | grep -q 'pnpm-lock.yaml\|package.json'; then
  echo -e "   ${YELLOW}Dependency files changed in last commit — review above results carefully.${NC}"
  # Check for known breaking patterns
  if git diff HEAD~1 -- package.json 2>/dev/null | grep -qE '^\+.*"typescript": "^[6-9]'; then
    echo -e "   ${YELLOW}⚠ TypeScript major bump detected — check tsconfig for deprecated options.${NC}"
  fi
  if git diff HEAD~1 -- package.json 2>/dev/null | grep -qE '^\+.*"react-resizable-panels": "\^[4-9]'; then
    echo -e "   ${YELLOW}⚠ react-resizable-panels major bump — check for renamed exports (PanelGroup→Group, PanelResizeHandle→Separator).${NC}"
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