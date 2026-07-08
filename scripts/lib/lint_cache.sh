#!/usr/bin/env bash

# File-hash cache for linters to skip unchanged files.
# Stored in .git/lint-cache/

# Ensure REPO_ROOT is set
if [ -z "${REPO_ROOT:-}" ]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# Define CACHE_DIR - relative to .git
# We use git rev-parse to find the real .git dir (handles worktrees/submodules)
if command -v git &> /dev/null && git -C "$REPO_ROOT" rev-parse --git-dir &> /dev/null; then
    GIT_DIR=$(git -C "$REPO_ROOT" rev-parse --git-dir)
    # If GIT_DIR is relative, make it absolute relative to REPO_ROOT
    if [[ "$GIT_DIR" != /* ]]; then
        GIT_DIR="$REPO_ROOT/$GIT_DIR"
    fi
    CACHE_DIR="$GIT_DIR/lint-cache"
else
    # Fallback if not in a git repo (unlikely for a pre-commit hook)
    CACHE_DIR="$REPO_ROOT/.lint-cache"
fi

mkdir -p "$CACHE_DIR"

# Helper for portable sha256
_get_hash_internal() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "none"
        return
    fi
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        # Fallback to just timestamp + size if no shasum tool
        # shellcheck disable=SC2012
        ls -l "$file" | awk '{print $5 "_" $6 "_" $7 "_" $8}'
    fi
}

lint_if_changed() {
    local file="$1"
    local tool_id="$2"
    local config_file="$3"
    shift 3
    # The remaining arguments are the command to run

    # Compute hashes
    local file_hash
    file_hash=$(_get_hash_internal "$file")

    local config_hash="none"
    if [ -n "$config_file" ]; then
        # Check if config_file is absolute or relative to REPO_ROOT
        if [ -f "$config_file" ]; then
            config_hash=$(_get_hash_internal "$config_file")
        elif [ -f "$REPO_ROOT/$config_file" ]; then
            config_hash=$(_get_hash_internal "$REPO_ROOT/$config_file")
        fi
    fi

    local cache_value="${file_hash}:${config_hash}"

    # Use a safe filename for the cache key
    # Replace characters that might be problematic in filenames
    local safe_file
    safe_file=$(echo "$file" | tr '/. ' '___')
    local cache_key="$CACHE_DIR/${tool_id}_${safe_file}"

    # Check cache
    if [[ -f "$cache_key" ]] && [[ "$(cat "$cache_key")" == "$cache_value" ]]; then
        return 0  # Unchanged, skip
    fi

    # Run the command
    if "$@"; then
        echo "$cache_value" > "$cache_key"
        return 0
    else
        # If it failed, we don't update the cache, so it runs again next time
        # Also remove existing cache entry to be safe
        rm -f "$cache_key"
        return 1
    fi
}
