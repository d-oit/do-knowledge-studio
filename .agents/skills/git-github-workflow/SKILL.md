---
name: git-github-workflow
description: Unified atomic git workflow with GitHub integration - commits all changes, checks GitHub issues, creates PR, validates all Actions pass including pre-existing, uses swarm coordination with web research on failures. Post-merge validation of all files and docs.
---

# Git-GitHub Workflow Skill

**Unified atomic workflow:** commit → check issues → create PR → validate ALL Actions → merge → post-merge validation

## Overview

This skill orchestrates a complete development workflow with **swarm agent coordination**.
See `references/SWARM.md` for detailed agent definitions and coordination patterns.

## Workflow Phases

### Phase 1: ATOMIC COMMIT (Agent: commit-agent)
- Stage ALL changes (`git add -A`)
- Validate with quality gate
- Create atomic commit with conventional format
- Generate meaningful commit message

### Phase 2: CHECK GITHUB ISSUES (Agent: issue-agent)
- List open issues in repository
- Check if issues relate to current changes
- Identify blocking issues
- Determine if issues need fixing before merge

### Phase 3: CREATE PR (Agent: pr-agent)
- Push to new feature branch
- Create comprehensive PR with commit summary and context

### Phase 4: MONITOR ALL ACTIONS (Agent: monitor-agent)
**CRITICAL:** ALL GitHub Actions must pass, including pre-existing issues
- Monitor PR checks continuously
- Check ALL repository workflows
- Validate no NEW failures introduced
- Wait for ALL checks to be green

### Phase 5: ISSUE RESOLUTION (Agent: fix-agent) [If needed]
If ANY check fails:
- Trigger web research with doc-resolver skill
- Use available skills to fix issues
- Re-run checks after fixes
- Coordinate with handoff pattern (see `references/HANDOFF.md`)

### Phase 6: MERGE (Agent: merge-agent)
- Verify ALL checks passing
- Merge with squash (default)
- Delete feature branch
- Update related issues

### Phase 7: POST-MERGE VALIDATION (Agent: validate-agent)
- Checkout main branch
- Verify ALL files present
- Validate documentation complete
- Check repository integrity
- Run final quality gate

## Usage

### Basic (Full Workflow)
```bash
bash .agents/skills/git-github-workflow/run.sh
```

### With Options
```bash
bash .agents/skills/git-github-workflow/run.sh \
  --message "feat: implement feature" \
  --fix-issues \
  --strict-validation
```

### Check Issues Only
```bash
bash .agents/skills/git-github-workflow/run.sh --check-issues-only
```

### Validate Main After Merge
```bash
bash .agents/skills/git-github-workflow/run.sh --validate-main-only
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--message, -m` | Commit message | auto-generated |
| `--fix-issues` | Attempt to fix issues automatically | false |
| `--close-issues` | Close related issues on merge | false |
| `--strict-validation` | ALL checks must pass (no pre-existing) | true |
| `--skip-issue-check` | Don't check GitHub issues | false |
| `--post-merge-validate` | Run validation after merge | true |
| `--auto-research` | Use web research on failures | true |
| `--max-retries` | Max fix attempts | 3 |
| `--timeout` | Actions timeout | 3600 |
| `--dry-run` | Simulate without executing | false |

## Pre-existing Issue Handling

**STRICT MODE (default):**
- ALL checks must pass, including pre-existing
- No exceptions
- Full green status required

**If pre-existing failures found:**
1. Document the pre-existing issue
2. Attempt to fix using web research
3. Apply fix if possible
4. Re-run checks
5. Only merge when ALL green

## Web Research Integration

On ANY failure:
```
Failure Detected
      ↓
Launch web-search-researcher
      ↓
Query: "<failure message> solution"
      ↓
Launch do-web-doc-resolver
      ↓
Get official docs
      ↓
Apply fix using relevant skills
      ↓
Re-run checks
      ↓
Pass? → Continue : Retry (max 3)
```

## Post-Merge Validation

After successful merge:

```bash
git checkout main
git pull origin main

# Validate:
1. All committed files present
2. Documentation updated
3. No broken links
4. Quality gate passes
5. All tests pass
6. Repository integrity OK
```

## Configuration

```bash
GIT_GITHUB_WORKFLOW_TIMEOUT=3600
GIT_GITHUB_WORKFLOW_MAX_RETRIES=3
GIT_GITHUB_WORKFLOW_STRICT_VALIDATION=1
GIT_GITHUB_WORKFLOW_AUTO_RESEARCH=1
GIT_GITHUB_WORKFLOW_POST_MERGE_VALIDATE=1
GIT_GITHUB_WORKFLOW_CLOSE_ISSUES=0
```

## Success Criteria

Workflow succeeds when:
1. ✓ All changes atomically committed
2. ✓ GitHub issues checked (none blocking or all resolved)
3. ✓ PR created and pushed
4. ✓ ALL GitHub Actions passing (including pre-existing)
5. ✓ Any issues fixed via web research
6. ✓ Successfully merged to main
7. ✓ Post-merge validation passes
8. ✓ All files and docs validated

## See Also

- `references/SWARM.md` - Agent coordination details
- `references/HANDOFF.md` - Handoff protocol
- `run.sh` - Implementation script
