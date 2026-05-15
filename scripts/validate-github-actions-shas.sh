#!/usr/bin/env bash
# Validate that GitHub Actions in workflows are pinned to full commit SHAs
# Exits 0 if all actions are pinned to valid SHAs, 1 otherwise

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || { echo "Failed to find repo root"; kill -INT $$; }

# Colors
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED="\033[0;31m"
    GREEN="\033[0;32m"
    NC="\033[0m"
else
    RED=""
    GREEN=""
    NC=""
fi

FAILED=0

# Find all workflow files
mapfile -t WORKFLOW_FILES < <(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}No workflow files found${NC}"
    kill -INT $$
fi

# Extract and validate action uses lines
for file in "${WORKFLOW_FILES[@]}"; do
    while IFS=: read -r line_num line; do
        # Extract the action reference after "uses:"
        # Handles cases like: uses: actions/checkout@v4
        # We want to ignore docker:// and local paths (./)
        action_ref=$(echo "$line" | sed -n "s/^[[:space:]]*-*[[:space:]]*uses:[[:space:]]*\([^[:space:]]*\).*/\1/p")

        # Skip empty, local actions, or docker images
        if [[ -z "$action_ref" ]] || [[ "$action_ref" == ./* ]] || [[ "$action_ref" == docker://* ]]; then
            continue
        fi

        # Check if it contains a 40-character SHA after @
        if [[ "$action_ref" =~ @([a-f0-9]{40})$ ]] || [[ "$action_ref" =~ @([a-f0-9]{40})[[:space:]]*#.* ]]; then
            # Extract just the SHA for placeholder check
            action_sha=$(echo "$action_ref" | sed -n "s/.*@\([a-f0-9]\{40\}\).*/\1/p")

            # Check for placeholder patterns: all same char, or repeating digit patterns
            if echo "$action_sha" | grep -qE "^(.)\1{39}$|^[0-9a-f]{8}([0-9a-f]{8}){4}[0-9a-f]{8}$"; then
                echo -e "${RED}Invalid/placeholder SHA found in $file line $line_num: $action_sha${NC}"
                FAILED=1
            fi
        else
            echo -e "${RED}Unpinned action found in $file line $line_num: $action_ref${NC}"
            echo "   All actions must be pinned to a full-length commit SHA (e.g. action@sha # v1)."
            FAILED=1
        fi
    done < <(grep -n "uses:" "$file" || true)
done

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All GitHub Actions references are properly pinned to SHAs${NC}"
else
    echo -e "${RED}Found unpinned or invalid action references in workflows${NC}"
fi

if [ $FAILED -ne 0 ]; then
    kill -INT $$
fi
