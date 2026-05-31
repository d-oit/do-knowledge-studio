#!/usr/bin/env bash
# Audit script to detect VITE_ environment variable references that could expose secrets.
# Run as part of CI or pre-commit checks to ensure no API keys leak into the client bundle.
set -euo pipefail

echo "=== VITE_ Environment Variable Audit ==="
echo ""

EXIT_CODE=0

# Check for VITE_ references in source code (excluding node_modules, dist, tests, and .env files)
echo "Scanning source code for import.meta.env.VITE_ references..."
VITE_REFS=$(grep -r "import\.meta\.env\.VITE_" src/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir="__tests__" \
  --exclude-dir="node_modules" \
  2>/dev/null || true)

if [ -n "$VITE_REFS" ]; then
  echo "WARNING: Found VITE_ environment variable references in source code:"
  echo "$VITE_REFS"
  echo ""
  echo "VITE_ prefixed variables are exposed to the client bundle."
  echo "Ensure these are user-provided keys, not developer secrets."
  EXIT_CODE=1
else
  echo "OK: No import.meta.env.VITE_ references found in source code."
fi

echo ""

# Check for hardcoded API key patterns
echo "Scanning for hardcoded API key patterns..."
HARDCODED_KEYS=$(grep -rE "(sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9]{20,})" src/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir="__tests__" \
  --exclude-dir="node_modules" \
  2>/dev/null || true)

if [ -n "$HARDCODED_KEYS" ]; then
  echo "WARNING: Found potential hardcoded API keys:"
  echo "$HARDCODED_KEYS"
  echo ""
  echo "API keys must never be hardcoded in source files."
  EXIT_CODE=1
else
  echo "OK: No hardcoded API key patterns found."
fi

echo ""

# Check .env.example documentation
if [ -f .env.example ]; then
  VITE_EXAMPLE=$(grep "^VITE_" .env.example 2>/dev/null || true)
  if [ -n "$VITE_EXAMPLE" ]; then
    echo "INFO: VITE_ variables found in .env.example:"
    echo "$VITE_EXAMPLE"
    echo ""
    echo "Ensure .env.example documents that these are client-visible."
  fi

  # Check for warning comments
  VITE_WARNING=$(grep -c "exposed to the client" .env.example 2>/dev/null || true)
  if [ "$VITE_WARNING" -eq 0 ] && [ -n "$VITE_EXAMPLE" ]; then
    echo "WARNING: .env.example has VITE_ variables but no exposure warning."
    EXIT_CODE=1
  fi
fi

echo ""

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "=== Audit Passed ==="
else
  echo "=== Audit Failed ==="
  echo "Review the warnings above and ensure VITE_ variables are not leaking secrets."
fi

exit "$EXIT_CODE"
