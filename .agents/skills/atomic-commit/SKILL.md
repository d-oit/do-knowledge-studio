---
name: atomic-commit
description: Atomic git workflow - validates, commits, pushes, creates PR, and verifies CI with zero-warnings policy. Orchestrates complete code submission as state machine with rollback on failure.
---

# Atomic Commit Skill

Atomic workflow: validate → commit → push → PR → verify. All changes committed as single unit with **zero warnings** policy.

## Overview

Orchestrates complete code submission as state machine with 7 phases:
1. PRE_COMMIT - Validation (quality gate, secrets scan)
2. COMMIT - Atomic commit creation (conventional format)
3. PRE_PUSH - Remote sync check
4. PUSH - Upload to origin
5. PR_CREATE - Open pull request
6. VERIFY - Wait for CI checks
7. REPORT - Success summary

**Zero warnings policy**: Any warning fails the workflow and triggers rollback.

## Usage

```bash
# Full workflow
/atomic-commit

# With custom message
/atomic-commit --message "feat(auth): add OAuth2 flow"

# Dry run (validate only)
/atomic-commit --dry-run

# Skip CI verification (emergency)
/atomic-commit --skip-ci
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--message, -m` | Commit message (auto-detect if omitted) | auto |
| `--dry-run` | Validate only, no commits/pushes | false |
| `--skip-ci` | Skip CI verification | false |
| `--timeout` | CI wait timeout in seconds | 1800 |
| `--base-branch` | Target branch for PR | main |

## State Machine

```
[Start] → PRE_COMMIT → COMMIT → PRE_PUSH → PUSH → PR_CREATE → VERIFY → REPORT → [Success]
              ↓           ↓         ↓         ↓          ↓         ↓
            [Fail]      Rollback  Rollback  Rollback   Rollback  Rollback
```

## Quality Gates

| Phase | Check | Failure Action |
|-------|-------|----------------|
| PRE_COMMIT | Quality gate zero warnings | Abort |
| PRE_COMMIT | No secrets in diff | Abort |
| PRE_COMMIT | Not on protected branch | Abort |
| COMMIT | Valid conventional format | Rollback |
| PRE_PUSH | Remote accessible | Rollback |
| PUSH | SHA verification | Rollback |
| PR_CREATE | gh CLI authenticated | Rollback |
| VERIFY | All CI checks green | Rollback |
| VERIFY | Zero warnings in checks | Rollback |

## Rollback Actions

On failure, automatically:
1. Close PR (if created)
2. Remove remote commit (best effort)
3. Reset local commit
4. Unstage changes

## Error Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Quality gate failed |
| 3 | Commit failed |
| 4 | Push failed |
| 5 | PR creation failed |
| 6 | Checks failed/warnings found |
| 7 | Timeout |
| 8 | Rollback failed |

## Prerequisites

- `gh` CLI installed and authenticated
- Working on feature branch (not main/master)
- `./scripts/quality_gate.sh` exists

## Configuration

Environment variables:
```bash
ATOMIC_COMMIT_TIMEOUT=1800          # Check wait timeout
ATOMIC_COMMIT_BASE_BRANCH=main      # Target branch for PR
ATOMIC_COMMIT_NO_ROLLBACK=0         # Set 1 to disable rollback
```

## Commit Format

```
type(scope): Brief description (50 chars max)

- Why (not what) - user perspective
- Reference issues: Fixes #123
```

**Types:** feat, fix, docs, style, refactor, perf, test, ci, chore

## Implementation

This skill uses sub-agents for each phase:
- `validate` - Phase 1: PRE_COMMIT
- `commit` - Phase 2: COMMIT
- `push` - Phases 3-4: PRE_PUSH & PUSH
- `create-pr` - Phase 5: PR_CREATE
- `verify` - Phase 6: VERIFY

## Success Criteria

Command succeeds only when:
1. ✓ All local validation passes (zero warnings)
2. ✓ Commit created with valid SHA
3. ✓ Pushed to remote successfully
4. ✓ PR created with valid URL
5. ✓ All GitHub Actions pass
6. ✓ Zero warnings in all checks

## See Also

- `.opencode/commands/commit.md` - Basic commit guidelines
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template
- `references/IMPLEMENTATION.md` - Technical details
# Test change
