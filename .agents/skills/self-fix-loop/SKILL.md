---
name: self-fix-loop
description: Self-learning fix loop - commit, push, monitor CI, auto-fix failures using swarm agents with skills on demand, loop until all checks pass.
version: "1.0"
template_version: "0.2"
---

# Self-Fix Loop Skill

Automated self-learning cycle: **commit → push → monitor → analyze failures → fix → retry** until all GitHub Actions pass.

## Overview

Continuous improvement loop that:
1. Commits all changes atomically
2. Pushes to feature branch
3. Creates/updates PR
4. Monitors GitHub Actions
5. On failure: uses swarm agents + skills to diagnose and fix
6. Repeats until ALL checks pass

## Usage

```bash
# Full loop with auto-fix
./scripts/self-fix-loop.sh

# With options
./scripts/self-fix-loop.sh --max-retries 5 --auto-research --fix-issues

# Dry run (simulate without push)
./scripts/self-fix-loop.sh --dry-run
```

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--max-retries N` | Maximum fix iterations | 5 |
| `--auto-research` | Use web research on failures | true |
| `--fix-issues` | Attempt automatic fixes | true |
| `--strict-validation` | ALL checks must pass | true |
| `--timeout SECONDS` | Per-iteration timeout | 1800 |
| `--poll-interval SECONDS` | CI check polling | 30 |
| `--dry-run` | Simulate without pushing | false |
| `--base-branch BRANCH` | Target branch | main |

## Loop Phases

```
[Start]
   ↓
Phase 1: COMMIT & PUSH
   - Stage all changes
   - Run quality gate
   - Atomic commit
   - Push to feature branch
   ↓
Phase 2: CREATE/UPDATE PR
   - Create new PR or update existing
   ↓
Phase 3: MONITOR CI
   - Poll GitHub Actions
   - Wait for all checks complete
   ↓
Phase 4: ANALYZE FAILURES
   - Identify failed checks
   - Extract error messages
   - Categorize failure type
   ↓
Phase 5: FIX (if failures)
   - Launch swarm agents
   - Use relevant skills on demand
   - Apply fixes
   - Commit fix
   ↓
Phase 6: RETRY LOOP
   - If retries remaining → Phase 1
   - If max retries → FAIL
   - If all pass → SUCCESS
```

## Skills Used On Demand

| Failure Type | Skills Activated |
|--------------|------------------|
| Shell script errors | `shell-script-quality` |
| YAML syntax | `cicd-pipeline` |
| Python errors | `code-quality` |
| TypeScript/JS errors | `code-quality` |
| Markdown issues | `markdownlint` |
| Security warnings | `security-code-auditor` |
| Link/reference errors | `validate-links.sh` |
| Skill format issues | `validate-skill-format.sh` |
| Unknown errors | `web-search-researcher` + `do-web-doc-resolver` |

## Swarm Agent Coordination

On each failure:
1. **Analyzer Agent**: Diagnoses root cause from CI logs
2. **Researcher Agent**: Web searches for solutions (if enabled)
3. **Fixer Agent**: Applies fixes using relevant skills
4. **Validator Agent**: Runs local quality gate before retry

## Configuration

```bash
SELF_FIX_LOOP_MAX_RETRIES=5
SELF_FIX_LOOP_TIMEOUT=1800
SELF_FIX_LOOP_POLL_INTERVAL=30
SELF_FIX_LOOP_AUTO_RESEARCH=1
SELF_FIX_LOOP_STRICT_VALIDATION=1
```

## Success Criteria

Loop succeeds when:
1. ✓ All changes committed and pushed
2. ✓ PR exists
3. ✓ ALL GitHub Actions passing
4. ✓ Zero warnings in all checks

## Error Codes

| Code | Meaning |
|------|---------|
| 0 | Success - all checks passed |
| 1 | Quality gate failed |
| 2 | Git operations failed |
| 3 | Max retries exceeded |
| 4 | Timeout |
| 5 | PR operations failed |

## See Also

- `git-github-workflow/SKILL.md` - Full git workflow
- `atomic-commit/SKILL.md` - Atomic commit pattern
- `web-search-researcher/SKILL.md` - Web research skill
