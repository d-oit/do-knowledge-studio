### LESSON-010: Git Worktree Cleanup and Registration

**Date**: 2026-04-05
**Component**: Scripts / Worktree Management
**Severity**: Medium

**Issue**: Scripts creating git worktrees leave orphaned directories and administrative data if they crash or are interrupted.

**Symptoms**:
- `git worktree list` shows many unused worktrees
- `fatal: '...' already exists` when running scripts multiple times
- Disk space consumption on long-running development machines

**Root Cause**:
1. **Missing Cleanup Traps**: Scripts didn't use `trap` to ensure cleanup on exit/error
2. **No Central Registration**: No shared array to track created worktrees for bulk cleanup

**Solution**:
```bash
# Register worktrees in a shared array
CREATED_WORKTREES=()
cleanup() {
    for wt in "${CREATED_WORKTREES[@]}"; do
        git worktree remove --force "$wt" 2>/dev/null || true
    done
}
trap cleanup EXIT ERR

# Add to registry when created
git worktree add "$path" "$branch"
CREATED_WORKTREES+=("$path")
```

**Prevention**:
- Use `scripts/lib/worktree-manager.sh` for all worktree operations
- Always register created worktrees in `CREATED_WORKTREES`
- Use the `trap cleanup EXIT ERR` pattern in all stateful scripts

**Files Modified**:
- `scripts/lib/worktree-manager.sh` - Implemented registration and cleanup logic
- `scripts/swarm-worktree-web-research.sh` - Updated to use manager

---
