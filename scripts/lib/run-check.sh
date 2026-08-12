#!/usr/bin/env bash
#
# Shared verification helpers for scripts/*.sh.
#
# Source with:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/lib/run-check.sh"
#
# Provides:
#   - Color tokens: RED, GREEN, BLUE, YELLOW, NC
#   - FAILED: caller-owned failure flag, initialized to 0 here
#   - run_check <name> <cmd...>: runs a named check, reports ✓/✗, and sets
#     FAILED=1 on failure. Always returns 0 so `set -e` callers keep running
#     the remaining checks and decide the final exit code themselves.

if [[ -z "${RUN_CHECK_LOADED:-}" ]]; then
  RUN_CHECK_LOADED=1

  # Exported because they are consumed by the sourcing script (verify.sh).
  FAILED=0
  export FAILED
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  BLUE='\033[0;34m'
  YELLOW='\033[0;33m'
  NC='\033[0m'
  export RED GREEN BLUE YELLOW NC

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
fi
