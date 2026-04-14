#!/usr/bin/env bash
# lib/worktree-manager.sh - Git worktree management functions
# Source this file from scripts that need worktree operations.
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/lib/worktree-manager.sh"

readonly WORKTREE_BASE="${WORKTREE_BASE:-.worktrees}"

# Track created worktrees for cleanup trap
CREATED_WORKTREES=()

# Cleanup trap function - call from trap in main script
cleanup_worktrees() {
    for wt in "${CREATED_WORKTREES[@]}"; do
        if git worktree list --porcelain 2>/dev/null | grep -q "worktree ${wt}"; then
            git worktree remove --force "$wt" 2>/dev/null || true
        fi
    done
}

setup_worktree() {
    local branch_name="$1"
    local worktree_path="${WORKTREE_BASE}/${branch_name}"

    mkdir -p "$WORKTREE_BASE"

    if git worktree list | grep -q "${worktree_path}"; then
        git worktree remove "$worktree_path" --force 2>/dev/null || true
    fi

    if git branch --list "$branch_name" | grep -q "$branch_name"; then
        git worktree add "$worktree_path" "$branch_name"
    else
        git worktree add -b "$branch_name" "$worktree_path" main
    fi

    CREATED_WORKTREES+=("$worktree_path")
    echo "$worktree_path"
}

cleanup_worktree() {
    local worktree_path="$1"
    if git worktree list | grep -q "${worktree_path}"; then
        git worktree remove "$worktree_path" --force 2>/dev/null || {
            rm -rf "$worktree_path"
            git worktree prune
        }
    fi
}
