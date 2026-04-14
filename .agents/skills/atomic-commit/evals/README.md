# Atomic Commit Evals

Evaluation scenarios for the atomic-commit skill.

## Eval 1: Dry Run Mode

**Goal**: Verify dry run only validates without making changes

**Setup**:
```bash
git checkout -b eval-dry-run
echo "test" > eval-test.txt
```

**Execution**: `/atomic-commit --dry-run`

**Assertions**:
- [ ] Command exits with code 0
- [ ] No commits created
- [ ] No pushes made
- [ ] No PRs created
- [ ] Quality gate ran
- [ ] Output shows "DRY RUN COMPLETED"

## Eval 2: Feature Branch Required

**Goal**: Verify cannot run on protected branches

**Setup**:
```bash
git checkout main
```

**Execution**: `/atomic-commit --message "test: branch check"`

**Assertions**:
- [ ] Command exits with code 2 (quality gate)
- [ ] Error message: "Cannot commit directly to main branch"
- [ ] No commits created
- [ ] Suggests creating feature branch

## Eval 3: Quality Gate Failure

**Goal**: Verify zero warnings policy blocks commit

**Setup**:
```bash
git checkout -b eval-quality-gate
echo "BAD CODE" > bad-file.sh
```

**Execution**: `/atomic-commit --message "test: quality gate"`

**Assertions**:
- [ ] Command exits with code 2
- [ ] Quality gate runs and fails
- [ ] No commits created
- [ ] No pushes made
- [ ] Error message shows specific failure

## Eval 4: Full Workflow Success

**Goal**: Verify complete workflow succeeds

**Setup**:
```bash
git checkout -b eval-full-workflow
echo "# Valid change" > valid-file.md
```

**Execution**: `/atomic-commit --message "docs: add valid file"`

**Assertions**:
- [ ] Command exits with code 0
- [ ] Commit created with SHA
- [ ] Pushed to remote
- [ ] PR created with valid URL
- [ ] CI checks monitored
- [ ] Success report displayed
- [ ] Commit SHA shown in output
- [ ] PR URL shown in output
- [ ] Duration metrics shown

## Eval 5: Rollback on PR Failure

**Goal**: Verify rollback when PR creation fails

**Setup**:
```bash
git checkout -b eval-rollback
echo "test" > test.txt
# Temporarily break gh CLI
```

**Execution**: `/atomic-commit --message "test: rollback"`

**Assertions**:
- [ ] Command fails during PR creation
- [ ] Local commit removed
- [ ] Remote commit removed (best effort)
- [ ] Clean working state restored
- [ ] Error message indicates rollback attempted

## Eval 6: Secret Detection

**Goal**: Verify secrets are detected and blocked

**Setup**:
```bash
git checkout -b eval-secrets
echo "api_key = 'AKIAIOSFODNN7EXAMPLE'" > secrets.txt
```

**Execution**: `/atomic-commit --message "test: secrets"`

**Assertions**:
- [ ] Command exits with code 2
- [ ] Secret detected in output
- [ ] Commit blocked
- [ ] Message suggests using environment variables

## Eval 7: Skip CI Mode

**Goal**: Verify --skip-ci bypasses CI verification

**Setup**:
```bash
git checkout -b eval-skip-ci
echo "change" > change.txt
```

**Execution**: `/atomic-commit --skip-ci --message "test: skip ci"`

**Assertions**:
- [ ] Command exits with code 0
- [ ] Commit created
- [ ] Pushed to remote
- [ ] PR created
- [ ] CI verification skipped
- [ ] Warning shown: "VERIFY - SKIPPED (emergency mode)"
- [ ] No CI monitoring performed

## Eval 8: Custom Message

**Goal**: Verify custom commit message is used

**Setup**:
```bash
git checkout -b eval-message
echo "feature" > feature.txt
```

**Execution**: `/atomic-commit --message "feat(scope): implement feature"`

**Assertions**:
- [ ] Command exits with code 0
- [ ] Commit created with exact message
- [ ] Message matches input exactly
- [ ] Conventional format preserved

## Eval 9: Auto-detect Commit Type

**Goal**: Verify commit type auto-detection works

**Setup**:
```bash
git checkout -b eval-autodetect
# Create CI file
echo "ci: change" > .github/workflows/test.yml
```

**Execution**: `/atomic-commit`

**Assertions**:
- [ ] Command exits with code 0
- [ ] Commit type detected as "ci"
- [ ] Message includes "ci" prefix
- [ ] Auto-generated message shown in output

## Eval 10: Timeout Handling

**Goal**: Verify timeout after CI check wait

**Setup**:
```bash
git checkout -b eval-timeout
echo "slow" > slow.txt
```

**Execution**: `/atomic-commit --timeout 5 --message "test: timeout"`

**Assertions**:
- [ ] Command exits with code 7 (timeout)
- [ ] Timeout message shown
- [ ] PR URL shown for manual check
- [ ] Rollback performed

## Quality Criteria

All evals must:
- [ ] Exit with correct error codes
- [ ] Show clear success/failure messages
- [ ] Leave repository in clean state
- [ ] Not leave orphaned branches or PRs
- [ ] Provide actionable error messages

## Running Evals

```bash
# Run specific eval
/test-eval atomic-commit dry-run

# Run all evals
/test-eval atomic-commit --all

# Run with verbose output
/test-eval atomic-commit full-workflow --verbose
```
