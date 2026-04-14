#!/usr/bin/env bash
set -euo pipefail

# Check if GitHub CLI and jq are installed
if ! command -v gh &> /dev/null || ! command -v jq &> /dev/null; then
    echo "Error: GitHub CLI (gh) and jq are required."
    echo "Install gh: https://cli.github.com/"
    echo "Install jq: https://stedolan.github.io/jq/"
    exit 1
fi

# Check if running in CI mode
CI_MODE="${1:-}"

if [ "$CI_MODE" == "--ci" ]; then
    echo "Running in CI mode - skipping interactive prompts"
    # In CI, we don't delete existing labels to avoid race conditions
    # Labels should be managed separately or initialized once
    echo "Skipping label deletion in CI mode."
else
    # Interactive mode - prompt for confirmation
    read -r -p "Delete ALL existing labels? (y/N) " confirm

    # More robust confirmation check
    if [[ "$confirm" == "y" ]] || [[ "$confirm" == "Y" ]] || [[ "$confirm" == "yes" ]] || [[ "$confirm" == "YES" ]]; then
        echo "Deleting all existing labels..."

        # Get all label names and delete them
        label_names=$(gh label list --json name --jq '.[].name')

        if [[ -n "$label_names" ]]; then
            echo "$label_names" | while IFS= read -r label; do
                if [[ -n "$label" ]]; then
                    echo "Deleting label: $label"
                    gh label delete "$label" --yes || echo "Failed to delete: $label"
                fi
            done
            echo "Label deletion completed."
        else
            echo "No labels found to delete."
        fi
    else
        echo "Skipping label deletion."
    fi
fi

# Create new labels (use --force to avoid errors if label already exists)
echo "Creating labels..."

gh label create "bug" --color d73a4a --description "Something isn't working" --force
gh label create "feature" --color a2eeef --description "New feature request" --force
gh label create "documentation" --color 0075ca --description "Improvements or additions to documentation" --force
gh label create "question" --color d876e3 --description "Further information is requested" --force
gh label create "discussion" --color 8b949e --description "Open-ended conversation or design discussion" --force
gh label create "security" --color b60205 --description "Security-related issue" --force
gh label create "priority: high" --color b60205 --description "Critical, needs immediate attention" --force
gh label create "priority: medium" --color fbca04 --description "Important but not urgent" --force
gh label create "priority: low" --color 0e8a16 --description "Low urgency, can wait" --force
gh label create "blocked" --color e4e669 --description "Cannot proceed due to dependency/blocker" --force
gh label create "status: in progress" --color 1d76db --description "Currently being worked on" --force
gh label create "status: needs review" --color dbab09 --description "Waiting for review" --force
gh label create "status: needs triage" --color e4e669 --description "Needs categorization or investigation" --force
gh label create "status: duplicate" --color cccccc --description "Duplicate of another issue/PR" --force
gh label create "status: wontfix" --color ffffff --description "Not planned to be fixed or implemented" --force
gh label create "refactor" --color 0366d6 --description "Code improvements without behavior change" --force
gh label create "performance" --color 5319e7 --description "Performance-related improvement" --force
gh label create "tests" --color f4c542 --description "Related to automated/manual tests" --force
gh label create "chore" --color fef2c0 --description "Maintenance task, tooling update, cleanup" --force
gh label create "deps" --color cfd3d7 --description "Dependency updates or changes" --force

echo "Label creation completed!"
