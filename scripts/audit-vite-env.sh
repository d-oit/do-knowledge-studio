#!/usr/bin/env bash
# audit-env-secrets.sh — Audit environment variable secret exposure in the codebase.
# Reports any NEXT_PUBLIC_ or VITE_ references that may leak secrets into client bundles,
# and scans .env files for accidental secret declarations.
#
# For Next.js projects, NEXT_PUBLIC_* vars are inlined into the client bundle at build
# time and are therefore public. For Vite projects, VITE_* vars are the equivalent.
# Neither prefix should ever carry a secret.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

EXIT_CODE=0

# Preflight: ensure rg is available
if ! command -v rg >/dev/null 2>&1; then
  echo -e "${RED}ERROR: ripgrep (rg) is required but not installed.${NC}" >&2
  exit 1
fi

echo "=== Client-Bundle Secret Exposure Audit ==="
echo ""

# ── 1. NEXT_PUBLIC_ references in source (Next.js leak vector) ────────
echo "--- NEXT_PUBLIC_ references in source code ---"
NEXT_REFS=$(rg --no-heading -n 'process\.env\.NEXT_PUBLIC_' \
  -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' \
  -g '!node_modules' -g '!dist' -g '!*.d.ts' \
  "$REPO_ROOT/src" 2>/dev/null || true)

if [ -z "$NEXT_REFS" ]; then
  echo -e "${GREEN}No NEXT_PUBLIC_ env references found in source code.${NC}"
else
  echo "$NEXT_REFS"
  echo ""
  REF_COUNT=$(echo "$NEXT_REFS" | wc -l | tr -d ' ')
  echo -e "${YELLOW}Found ${REF_COUNT} NEXT_PUBLIC_ reference(s).${NC}"
fi

echo ""

# ── 2. VITE_ references in source (Vite leak vector) ─────────────────
echo "--- VITE_ references in source code ---"
VITE_REFS=$(rg --no-heading -n 'import\.meta\.env\.VITE_' \
  -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' \
  -g '!node_modules' -g '!dist' -g '!*.d.ts' \
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

# ── 3. .env files with secret-like declarations ──────────────────────
echo "--- .env files with potential secret declarations ---"
ENV_FILES=$(find "$REPO_ROOT" -maxdepth 3 -name '.env*' \
  -not -name '.env.example' -not -path '*/node_modules/*' 2>/dev/null || true)

if [ -z "$ENV_FILES" ]; then
  echo -e "${GREEN}No .env files found.${NC}"
else
  for f in $ENV_FILES; do
    # Check for NEXT_PUBLIC_ or VITE_ prefixed secrets
    SECRET_ENTRIES=$(grep -cE '^(NEXT_PUBLIC_|VITE_).*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)' "$f" 2>/dev/null || true)
    if [ "$SECRET_ENTRIES" -gt 0 ]; then
      echo -e "${RED}${f}: ${SECRET_ENTRIES} potential secret(s) with client-prefixed names:${NC}"
      grep -nE '^(NEXT_PUBLIC_|VITE_).*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)' "$f" | sed 's/=.*/=***/'
      EXIT_CODE=1
    else
      echo -e "${GREEN}${f}: No client-prefixed secrets found.${NC}"
    fi
  done
fi

echo ""

# ── 4. Any env var with KEY/SECRET/TOKEN in name (catch-all) ─────────
echo "--- Potential secrets in ANY env var (catch-all) ---"
ALL_SECRETS=$(rg --no-heading -n \
  '^(NEXT_PUBLIC_|VITE_|).*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)\s*=' \
  -g '.env*' -g '!.env.example' -g '!node_modules' \
  "$REPO_ROOT" 2>/dev/null || true)

if [ -z "$ALL_SECRETS" ]; then
  echo -e "${GREEN}No potential secrets found in .env files.${NC}"
else
  echo "$ALL_SECRETS"
  echo ""
  echo -e "${YELLOW}Review these entries: ensure no secrets have client-prefixed names.${NC}"
fi

echo ""
echo "=== Audit complete ==="
exit $EXIT_CODE
