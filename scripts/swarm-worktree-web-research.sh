#!/usr/bin/env bash
# Swarm Worktree Web Research Workflow - Orchestration Script
# Modularized and hardened against security vulnerabilities.

set -euo pipefail

# Detect repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/swarm-worktree/main.sh
source "${REPO_ROOT}/swarm-worktree/main.sh"

# Forward arguments to main orchestration
main "$@"
