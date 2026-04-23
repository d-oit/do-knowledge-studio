#!/usr/bin/env bash
# Rehearse GitHub Actions locally using 'act'
# See: https://github.com/nektos/act

set -e
set -u

# Get repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Colors for output
if [[ -t 1 ]]; then
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    BLUE=''
    YELLOW=''
    NC=''
fi

if ! command -v act &> /dev/null; then
    echo -e "${YELLOW}Error: 'act' is not installed.${NC}"
    echo "Install it via:"
    echo "  brew install act (macOS)"
    echo "  choco install act-cli (Windows)"
    echo "  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash (Linux)"
    exit 1
fi

usage() {
    echo "Usage: $0 [job_name] [--list]"
    echo ""
    echo "Examples:"
    echo "  $0 quality-gate     # Run the quality-gate job"
    echo "  $0 test             # Run the test job"
    echo "  $0 --list           # List all available jobs"
}

if [[ $# -eq 0 ]]; then
    echo -e "${BLUE}Running all default jobs...${NC}"
    act
elif [[ "$1" == "--list" ]]; then
    act --list
else
    echo -e "${BLUE}Running job: $1...${NC}"
    act -j "$1"
fi
