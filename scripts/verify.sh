#!/usr/bin/env bash
# Full verification — lint, typecheck, test, build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# shellcheck source-path=scripts
# shellcheck source=lib/run-check.sh
source "$SCRIPT_DIR/lib/run-check.sh"

# Lint the BATS suite (and helpers) with the bats dialect — catches bats
# gotchas such as SC2314 (`!` does not fail a bats test) before CI does.
mapfile -t BATS_FILES < <(find tests -name '*.bats' -o -name '*.bash' \
  2>/dev/null || true)
if [ "${#BATS_FILES[@]}" -gt 0 ]; then
  run_check "Shell Lint (BATS)" shellcheck --shell=bats -S warning "${BATS_FILES[@]}"
fi

run_check "Lint" pnpm run lint
# Match the CI yaml-lint workflow exactly: inline -d config with a 120-char
# line limit (the repo's .yamllint.yml is more lenient at 254).
run_check "YAML Lint (CI parity)" yamllint -d \
  '{extends: default, rules: {line-length: {max: 120}, indentation: {spaces: 2}}}' \
  .github/
# BATS regression tests for shell scripts (tests/*.bats). CI installs bats
# (see ci-and-labels.yml / cleanup.yml); locally we warn when it is absent.
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
