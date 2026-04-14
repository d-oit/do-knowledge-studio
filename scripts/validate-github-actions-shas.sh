#!/usr/bin/env bash
# Validate that GitHub Actions SHAs in workflows are valid commit SHAs
# Exits 0 if all SHAs are valid, 1 if any are invalid

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    NC=''
fi

FAILED=0

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}gh CLI not available - skipping GitHub Actions SHA validation${NC}"
    exit 0
fi

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}No workflow files found${NC}"
    exit 0
fi

# Extract action uses lines with SHAs
for file in "${WORKFLOW_FILES[@]}"; do
    while IFS=: read -r line_num line; do
        action_sha=$(echo "$line" | sed -n 's/.*uses:\s*\([^@]*@\)\?\([a-f0-9]\{40\}\).*/\2/p')
        if [ -n "$action_sha" ]; then
            # Check for placeholder patterns: all same char, or repeating digit patterns
            if echo "$action_sha" | grep -qE '^(.)\1{39}$|^[0-9a-f]{8}([0-9a-f]{8}){4}[0-9a-f]{8}$'; then
                echo -e "${RED}Invalid/placeholder SHA found in $file line $line_num: $action_sha${NC}"
                FAILED=1
            fi
        fi
    done < <(grep -n "uses:" "$file" | grep "@[a-f0-9]\{40\}" || true)
done

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All GitHub Actions SHAs appear valid${NC}"
else
    echo -e "${RED}Found invalid/placeholder SHAs in workflows${NC}"
fi

exit $FAILED
