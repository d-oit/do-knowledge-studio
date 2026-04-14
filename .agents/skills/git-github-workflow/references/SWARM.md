# Agent Coordination (Swarm Pattern)

This document describes the swarm agent coordination pattern used by the git-github-workflow skill.

## Overview

The workflow uses 7 specialized agents that coordinate via structured handoffs:

```
[Atomic Commit] → [Check GitHub Issues] → [Create PR] → [Monitor ALL Actions]
       ↓                    ↓                      ↓                  ↓
   Any issues?      Fix/Close issues      All passing?     Web Research
       ↓                    ↓                      ↓                  ↓
   Research    →     Resolve      →      Merge      →   Validate Main
```

## Agent Definitions

### Agent 1: commit-agent
```yaml
role: Create atomic commit
skills: [shell-script-quality, git]
tasks:
  - Stage all changes
  - Run quality gate
  - Create conventional commit
output: commit_sha, branch_name
```

### Agent 2: issue-agent
```yaml
role: Check GitHub issues
skills: [codeberg-api, github]
tasks:
  - List open issues
  - Check issue relevance
  - Flag blocking issues
output: issues_list, blocking_count
```

### Agent 3: pr-agent
```yaml
role: Create pull request
skills: [github]
tasks:
  - Push branch
  - Create PR body
  - Link related issues
output: pr_number, pr_url
```

### Agent 4: monitor-agent
```yaml
role: Monitor ALL GitHub Actions
skills: [github, iterative-refinement]
tasks:
  - Poll PR checks
  - Check repo workflows
  - Detect failures
  - Wait for completion
output: checks_status, failures_list
```

### Agent 5: fix-agent (Conditional)
```yaml
role: Fix issues using skills
skills: [web-search-researcher, do-web-doc-resolver, all-available]
tasks:
  - Research failures
  - Apply fixes
  - Re-run checks
  - Handoff back to monitor
trigger: ANY check failure
```

### Agent 6: merge-agent
```yaml
role: Merge PR
skills: [github]
tasks:
  - Verify checks passing
  - Merge PR
  - Cleanup branch
  - Update issues
output: merge_status
```

### Agent 7: validate-agent
```yaml
role: Post-merge validation
skills: [shell-script-quality, all-available]
tasks:
  - Checkout main
  - Verify files present
  - Validate docs
  - Run quality gate
  - Check integrity
output: validation_status
```

## Communication Protocol

Agents communicate via structured handoffs:

```json
{
  "from": "monitor-agent",
  "to": "fix-agent",
  "context": {
    "pr_number": 123,
    "failures": ["test failure", "lint error"],
    "logs": "...",
    "attempt": 1
  },
  "skills_needed": ["web-search-researcher", "shell-script-quality"]
}
```

## Coordination Strategy

### Sequential Execution
Agents execute in sequence, with each agent's output becoming the next agent's input.

### Conditional Branching
The fix-agent only activates when checks fail, creating a feedback loop.

### Error Propagation
Errors bubble up through the chain, with each agent able to abort the workflow.

### Retry Logic
The monitor→fix loop retries up to 3 times before failing the workflow.

## Configuration

```bash
GIT_GITHUB_WORKFLOW_TIMEOUT=3600
GIT_GITHUB_WORKFLOW_MAX_RETRIES=3
GIT_GITHUB_WORKFLOW_STRICT_VALIDATION=1
GIT_GITHUB_WORKFLOW_AUTO_RESEARCH=1
GIT_GITHUB_WORKFLOW_POST_MERGE_VALIDATE=1
GIT_GITHUB_WORKFLOW_CLOSE_ISSUES=0
```

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Complete |
| 1 | General error | Stop |
| 2 | Commit failed | Review changes |
| 3 | Quality gate failed | Fix issues |
| 4 | GitHub issues blocking | Resolve issues |
| 5 | PR creation failed | Manual PR |
| 6 | Actions failed | Fix and retry |
| 7 | Max retries exceeded | Manual fix |
| 8 | Merge failed | Manual merge |
| 9 | Post-merge validation failed | Emergency fix |
