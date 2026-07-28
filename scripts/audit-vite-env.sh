#!/usr/bin/env bash
# audit-vite-env.sh — Audit VITE_ environment variable usage in the codebase.
# Reports any import.meta.env.VITE_* references and warns if they lack defaults,
# since VITE_ env vars are baked into the client bundle at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== VITE_ Environment Variable Audit ==="
echo ""

# 1. Find all VITE_ references in source files
echo "--- VITE_ references in source code ---"
VITE_REFS=$(rg --no-heading -n 'import\.meta\.env\.VITE_' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --glob='!node_modules' --glob='!dist' --glob='!*.d.ts' \
  "$REPO_ROOT/src" 2>/dev/null || true)

if [ -z "$VITE_REFS" ]; then
  echo -e "${GREEN}No VITE_ env references found in source code.${NC}"
else
  echo "$VITE_REFS"
  echo ""
  REF_COUNT=$(echo "$VITE_REFS" | wc -l | tr -d ' ')
  echo -e "${YELLOW}Found ${REF_COUNT} VITE_ reference(s).${NC}"
fi

echo ""

# 2. Find VITE_ references without defaults (risky — will be undefined at runtime if not set)
echo "--- VITE_ references without fallback defaults ---"
NO_DEFAULT=$(rg --no-heading -n 'import\.meta\.env\.VITE_[A-Z_]+(?!\s*\?\?)' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --glob='!node_modules' --glob='!dist' --glob='!*.d.ts' \
  "$REPO_ROOT/src" 2>/dev/null || true)

if [ -z "$NO_DEFAULT" ]; then
  echo -e "${GREEN}All VITE_ references have fallback defaults, or none exist.${NC}"
else
  echo -e "${RED}The following VITE_ references lack fallback defaults:${NC}"
  echo "$NO_DEFAULT"
  echo ""
  echo -e "${YELLOW}These will be undefined if the env var is not set at build time.${NC}"
fi

echo ""

# 3. Check .env files for VITE_ declarations
echo "--- .env files with VITE_ declarations ---"
ENV_FILES=$(find "$REPO_ROOT" -maxdepth 2 -name '.env*' -not -name '.env.example' -not -path '*/node_modules/*' 2>/dev/null || true)

if [ -z "$ENV_FILES" ]; then
  echo -e "${GREEN}No .env files found.${NC}"
else
  for f in $ENV_FILES; do
    VITE_ENTRIES=$(grep -c '^VITE_' "$f" 2>/dev/null || true)
    if [ "$VITE_ENTRIES" -gt 0 ]; then
      echo -e "${YELLOW}${f}:${NC} ${VITE_ENTRIES} VITE_ declaration(s)"
      grep '^VITE_' "$f" | sed 's/=.*/=***/'  # mask values
    else
      echo -e "${GREEN}${f}: No VITE_ declarations.${NC}"
    fi
  done
fi

echo ""

# 4. Check for secrets accidentally prefixed with VITE_
echo "--- Potential secrets in VITE_ env ---"
SECRETS=$(rg --no-heading -n '^VITE_.*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)' \
  --glob='.env*' --glob='!.env.example' \
  "$REPO_ROOT" 2>/dev/null || true)

if [ -z "$SECRETS" ]; then
  echo -e "${GREEN}No potential secrets found in VITE_ env declarations.${NC}"
else
  echo -e "${RED}WARNING: Potential secrets found with VITE_ prefix:${NC}"
  echo "$SECRETS"
  echo ""
  echo -e "${RED}VITE_ env vars are embedded in the client bundle and are NOT secret.${NC}"
  echo -e "${RED}Remove VITE_ prefix or use a server-side proxy for sensitive values.${NC}"
fi

echo ""
echo "=== Audit complete ==="
