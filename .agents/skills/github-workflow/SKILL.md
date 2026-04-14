---
name: github-workflow
description: Complete GitHub workflow automation - push, create branch/PR, monitor Actions with pre-existing issue detection, auto-merge/rebase when checks pass. Handles the full git→GitHub→merge lifecycle.
---

# GitHub Workflow Skill

Complete GitHub workflow automation: **push → branch → PR → monitor → merge**

## Overview

Orchestrates the full GitHub workflow lifecycle with intelligent monitoring:
1. **PUSH** - Push to remote (create branch if needed)
2. **PR** - Create or update pull request
3. **MONITOR** - Watch GitHub Actions with pre-existing issue detection
4. **MERGE** - Auto-merge or rebase when checks pass

**Key Features:**
- Pre-existing issue detection (distinguishes new vs old failures)
- Comprehensive Actions monitoring (not just PR checks)
- Auto-merge with multiple strategies (merge, squash, rebase)
- Automatic rebase when behind main
- Branch protection awareness

## Usage

```bash
# Full workflow: push, PR, monitor, auto-merge
bash .agents/skills/github-workflow/run.sh

# Push only
bash .agents/skills/github-workflow/run.sh --push-only

# Push and create PR, don't merge
bash .agents/skills/github-workflow/run.sh --no-merge

# Monitor existing PR
bash .agents/skills/github-workflow/run.sh --monitor-only

# Auto-merge when ready
bash .agents/skills/github-workflow/run.sh --auto-merge

# With custom message
bash .agents/skills/github-workflow/run.sh --message "feat: new feature"
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--message, -m` | Commit/PR message | auto-generated |
| `--push-only` | Only push, no PR/merge | false |
| `--no-merge` | Don't auto-merge | false |
| `--monitor-only` | Only monitor existing PR | false |
| `--auto-merge` | Enable auto-merge | true |
| `--merge-method` | merge/squash/rebase | squash |
| `--base-branch` | Target branch | main |
| `--branch-name` | Custom branch name | auto-generated |
| `--rebase` | Rebase if behind | true |
| `--timeout` | Actions timeout | 3600 |
| `--check-all-actions` | Monitor repo Actions | true |
| `--fail-on-warning` | Treat warnings as errors | true |
| `--dry-run` | Simulate only | false |

## Workflow Phases

### Phase 1: PREPARE
- Check git status
- Validate working directory
- Detect or create branch
- Calculate branch name from message

### Phase 2: SYNC
- Fetch from origin
- Check if behind base branch
- Auto-rebase if enabled and behind
- Handle merge conflicts

### Phase 3: PUSH
- Stage all changes (if any)
- Create commit (if needed)
- Push to remote
- Set upstream tracking

### Phase 4: PR
- Check for existing PR
- Create PR if none exists
- Update PR if exists
- Generate PR body with context

### Phase 5: MONITOR
- Poll GitHub Actions workflows
- Check PR checks
- Distinguish pre-existing vs new issues
- Detect warnings and failures
- Report status comprehensively

### Phase 6: MERGE
- Wait for all checks to pass
- Verify no new issues introduced
- Auto-merge with configured method
- Clean up branch (optional)
- Report success

## Pre-existing Issue Detection

The skill distinguishes between:
- **Pre-existing issues**: Failures/warnings already in base branch
- **New issues**: Introduced by current changes

This prevents blocking merges due to unrelated existing problems.

## GitHub Actions Monitoring

Monitors:
- PR checks (`gh pr checks`)
- Repository Actions workflows
- Workflow runs for the branch
- Individual job statuses
- Step-level failures and warnings

## Auto-Merge Strategies

| Method | Description |
|--------|-------------|
| `merge` | Create merge commit |
| `squash` | Squash into single commit (default) |
| `rebase` | Rebase and fast-forward |

## Configuration

**Environment Variables:**
```bash
GITHUB_WORKFLOW_TIMEOUT=3600         # Actions monitoring timeout
GITHUB_WORKFLOW_BASE_BRANCH=main     # Target branch
GITHUB_WORKFLOW_MERGE_METHOD=squash  # Merge strategy
GITHUB_WORKFLOW_AUTO_MERGE=1         # Enable auto-merge
GITHUB_WORKFLOW_REBASE=1             # Auto-rebase when behind
GITHUB_WORKFLOW_FAIL_ON_WARNING=1    # Treat warnings as errors
GITHUB_WORKFLOW_CLEANUP_BRANCH=0     # Delete branch after merge
```

**Repository Settings (via gh):**
- Branch protection rules
- Required status checks
- Auto-merge setting in GitHub

## Error Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Push failed |
| 3 | PR creation failed |
| 4 | Checks failed (new issues) |
| 5 | Merge failed |
| 6 | Rebase failed |
| 7 | Timeout |
| 8 | Pre-existing issues only (can merge) |

## Examples

### Example 1: Quick Push and PR
```bash
bash .agents/skills/github-workflow/run.sh --message "fix: bug fix"
# Pushes, creates PR, monitors, auto-merges when ready
```

### Example 2: Monitor Existing PR
```bash
bash .agents/skills/github-workflow/run.sh --monitor-only
# Monitors current PR, reports status
```

### Example 3: Push Without Merge
```bash
bash .agents/skills/github-workflow/run.sh --no-merge
# Creates PR but waits for manual review
```

### Example 4: Handle Pre-existing Issues
```bash
bash .agents/skills/github-workflow/run.sh
# Detects base branch has failing tests
# Verifies no NEW failures introduced
# Merges if only pre-existing issues
```

## Success Criteria

Workflow succeeds when:
1. ✓ Changes pushed to remote
2. ✓ PR created/updated
3. ✓ All NEW issues resolved (pre-existing ok)
4. ✓ GitHub Actions pass (or only pre-existing failures)
5. ✓ Auto-merge completes successfully

## See Also

- `references/IMPLEMENTATION.md` - Technical implementation details
- `run.sh` - Main workflow script
- `evals/README.md` - Test scenarios and evaluation cases

