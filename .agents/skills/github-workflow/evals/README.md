# GitHub Workflow Evals

Test scenarios for the github-workflow skill.

## Eval 1: Dry Run Mode

**Goal**: Verify dry run simulates without making changes

**Setup**:
```bash
git checkout -b eval-dry-run
echo "test" > test.txt
```

**Execution**: `run.sh --dry-run --message "test: dry run"`

**Assertions**:
- [ ] Command exits with code 0
- [ ] No commits created
- [ ] No pushes made
- [ ] No PRs created
- [ ] "[DRY-RUN]" prefix in output
- [ ] Shows what would be done

## Eval 2: Push Only

**Goal**: Verify --push-only stops after push

**Setup**:
```bash
git checkout -b eval-push-only
echo "feature" > feature.txt
```

**Execution**: `run.sh --push-only --message "feat: new feature"`

**Assertions**:
- [ ] Changes pushed to origin
- [ ] No PR created
- [ ] Command exits after PUSH phase
- [ ] No monitoring phase

## Eval 3: No Merge

**Goal**: Verify --no-merge creates PR but doesn't merge

**Setup**:
```bash
git checkout -b eval-no-merge
echo "fix" > fix.txt
```

**Execution**: `run.sh --no-merge --message "fix: bug fix"`

**Assertions**:
- [ ] Changes pushed
- [ ] PR created
- [ ] Monitoring runs
- [ ] PR not merged
- [ ] Exit code 0 if checks pass

## Eval 4: Auto-branch Creation

**Goal**: Verify branch creation when on main/master

**Setup**:
```bash
git checkout main
echo "change" > change.txt
```

**Execution**: `run.sh --message "feat: auto branch"`

**Assertions**:
- [ ] Feature branch created from main
- [ ] Changes committed
- [ ] Pushed to new branch
- [ ] PR created with correct head
- [ ] Original branch unchanged

## Eval 5: Existing PR Monitoring

**Goal**: Verify --monitor-only tracks existing PR

**Setup**:
```bash
git checkout -b eval-monitor
echo "monitor" > monitor.txt
git add -A && git commit -m "test"
git push -u origin eval-monitor
gh pr create --title "Test PR" --body "Test" --base main
```

**Execution**: `run.sh --monitor-only`

**Assertions**:
- [ ] Detects existing PR
- [ ] Monitors without push
- [ ] Reports PR status
- [ ] Handles merge state

## Eval 6: Rebase When Behind

**Goal**: Verify auto-rebase when behind base branch

**Setup**:
```bash
# On branch, origin/main has new commits
git checkout -b eval-rebase
git reset --hard origin/main~5
```

**Execution**: `run.sh --message "feat: rebase test"`

**Assertions**:
- [ ] Detects branch is behind
- [ ] Performs rebase automatically
- [ ] Rebase succeeds
- [ ] Push succeeds
- [ ] PR created

## Eval 7: Rebase Conflicts

**Goal**: Verify conflict detection and failure

**Setup**:
```bash
# Create conflicting changes
git checkout -b eval-conflict
# Modify same line as in origin/main
```

**Execution**: `run.sh --message "feat: conflict test"`

**Assertions**:
- [ ] Detects potential conflicts
- [ ] Fails with E_REBASE_FAILED (6)
- [ ] Reports conflict error
- [ ] No partial changes left

## Eval 8: Checks Pass

**Goal**: Verify successful monitoring and merge

**Setup**:
```bash
git checkout -b eval-checks-pass
echo "pass" > pass.txt
```

**Execution**: `run.sh --message "docs: checks pass test" --auto-merge`

**Assertions**:
- [ ] PR created
- [ ] Monitoring starts
- [ ] Checks pass
- [ ] Auto-merge executes
- [ ] PR merged
- [ ] Exit code 0

## Eval 9: Checks Fail (New Issues)

**Goal**: Verify failure detection and no merge

**Setup**:
```bash
# Push code that will fail CI
git checkout -b eval-checks-fail
# Introduce lint error or test failure
```

**Execution**: `run.sh --message "test: will fail"`

**Assertions**:
- [ ] Monitoring detects failure
- [ ] Exit code 4 (E_CHECKS_FAILED)
- [ ] PR not merged
- [ ] Reports specific failures

## Eval 10: Pre-existing Issues Only

**Goal**: Verify handling of base branch issues

**Setup**:
```bash
# When base branch already has failing checks
git checkout -b eval-pre-existing
echo "change" > change.txt
```

**Execution**: `run.sh --message "feat: pre-existing test"`

**Assertions**:
- [ ] Detects pre-existing failures
- [ ] Distinguishes from new issues
- [ ] Can merge if only pre-existing
- [ ] Reports pre-existing issues

## Eval 11: Squash Merge

**Goal**: Verify squash merge method

**Setup**:
```bash
git checkout -b eval-squash
echo "squash" > squash.txt
```

**Execution**: `run.sh --message "feat: squash test" --merge-method squash`

**Assertions**:
- [ ] PR created with multiple commits
- [ ] Merged as single commit
- [ ] Merge commit message includes PR info

## Eval 12: Rebase Merge

**Goal**: Verify rebase merge method

**Setup**:
```bash
git checkout -b eval-rebase-merge
echo "rebase" > rebase.txt
```

**Execution**: `run.sh --message "feat: rebase merge test" --merge-method rebase`

**Assertions**:
- [ ] PR rebased onto main
- [ ] Fast-forward merge
- [ ] Linear history maintained

## Eval 13: Branch Cleanup

**Goal**: Verify --cleanup-branch deletes after merge

**Setup**:
```bash
git checkout -b eval-cleanup
echo "cleanup" > cleanup.txt
```

**Execution**: `run.sh --message "test: cleanup" --cleanup-branch`

**Assertions**:
- [ ] PR merged successfully
- [ ] Remote branch deleted
- [ ] Local branch deleted
- [ ] Clean state achieved

## Eval 14: Warning Handling

**Goal**: Verify --fail-on-warning and --no-fail-on-warning

**Setup**:
```bash
# Push code with warnings
git checkout -b eval-warnings
# Introduce deprecation warning
```

**Execution A**: `run.sh --message "test: warnings" --fail-on-warning`

**Assertions A**:
- [ ] Detects warnings
- [ ] Fails with E_CHECKS_FAILED

**Execution B**: `run.sh --message "test: warnings" --no-fail-on-warning`

**Assertions B**:
- [ ] Detects warnings
- [ ] Reports warnings
- [ ] Continues to merge

## Eval 15: Custom Branch Name

**Goal**: Verify --branch-name overrides auto-generation

**Setup**:
```bash
git checkout main
echo "custom" > custom.txt
```

**Execution**: `run.sh --message "feat: custom" --branch-name my-custom-branch`

**Assertions**:
- [ ] Branch named exactly "my-custom-branch"
- [ ] Not auto-generated name
- [ ] Pushed to correct branch
- [ ] PR created with correct head

## Eval 16: Timeout Handling

**Goal**: Verify --timeout limits monitoring

**Setup**:
```bash
git checkout -b eval-timeout
echo "slow" > slow.txt
# Create PR with slow checks
```

**Execution**: `run.sh --message "test: timeout" --timeout 30`

**Assertions**:
- [ ] Monitors for max 30 seconds
- [ ] Exits with E_TIMEOUT (7)
- [ ] Reports timeout
- [ ] PR not merged (checks incomplete)

## Eval 17: All Actions Monitoring

**Goal**: Verify --check-all-actions monitors repo Actions

**Setup**:
```bash
git checkout -b eval-all-actions
echo "actions" > actions.txt
```

**Execution**: `run.sh --message "test: actions" --check-all-actions`

**Assertions**:
- [ ] Monitors PR checks
- [ ] Monitors repository Actions
- [ ] Reports workflow runs
- [ ] Detects failures in any workflow

## Eval 18: Base Branch Override

**Goal**: Verify --base-branch targets different branch

**Setup**:
```bash
git checkout -b eval-base-branch
echo "develop" > develop.txt
```

**Execution**: `run.sh --message "feat: develop" --base-branch develop`

**Assertions**:
- [ ] PR targets "develop" branch
- [ ] Syncs with origin/develop
- [ ] Rebase against develop if needed
- [ ] Correct base in PR

## Eval 19: Already Merged PR

**Goal**: Verify handling of externally merged PR

**Setup**:
```bash
git checkout -b eval-already-merged
echo "merged" > merged.txt
git push -u origin eval-already-merged
gh pr create --title "Will merge manually" --body "Test"
# Manually merge PR via GitHub UI
```

**Execution**: `run.sh --monitor-only`

**Assertions**:
- [ ] Detects PR is already merged
- [ ] Reports "PR was already merged!"
- [ ] Exit code 0
- [ ] No errors

## Eval 20: Closed PR Detection

**Goal**: Verify handling of closed (not merged) PR

**Setup**:
```bash
git checkout -b eval-closed
echo "closed" > closed.txt
git push -u origin eval-closed
gh pr create --title "Will close" --body "Test"
# Manually close PR via GitHub UI
```

**Execution**: `run.sh --monitor-only`

**Assertions**:
- [ ] Detects PR is closed
- [ ] Exit code E_CHECKS_FAILED (4)
- [ ] Reports "PR was closed"

## Quality Criteria

All evals must:
- [ ] Clean up after execution
- [ ] Not leave orphaned branches
- [ ] Not leave stale PRs
- [ ] Provide clear pass/fail
- [ ] Test one specific feature
- [ ] Be reproducible

## Running Evals

```bash
# Run single eval
cd .agents/skills/github-workflow
./evals/run.sh dry-run

# Run all evals
./evals/run.sh --all

# Run with verbose
./evals/run.sh checks-pass --verbose

# Cleanup after tests
./evals/run.sh --cleanup
```

## Test Environment

Required:
- Git repository with origin remote
- GitHub CLI authenticated
- Repository with Actions enabled
- Write access to repository
- Branch protection configured (for merge tests)
