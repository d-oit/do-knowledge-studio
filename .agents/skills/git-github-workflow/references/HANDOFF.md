# Handoff Protocol

This document describes the structured handoff protocol used for agent coordination in the git-github-workflow skill.

## Overview

When agents need to transfer control to another agent, they use a structured handoff format to preserve context and state.

## Handoff Structure

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

## Handoff Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `from` | string | Name of the originating agent |
| `to` | string | Name of the target agent |
| `context` | object | State and data to transfer |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `skills_needed` | array | List of skills required by the target |
| `priority` | string | Priority level: `low`, `medium`, `high`, `critical` |
| `timeout` | number | Maximum time allowed for handoff processing |

## Context Object

The context object contains all relevant state for the receiving agent:

```json
{
  "pr_number": 123,
  "commit_sha": "abc123",
  "branch_name": "feat/new-feature",
  "failures": [...],
  "logs": "...",
  "attempt": 1,
  "previous_agents": ["commit-agent", "pr-agent"]
}
```

## Handoff Patterns

### Success Handoff

When an agent completes successfully and the next agent should continue:

```json
{
  "from": "commit-agent",
  "to": "issue-agent",
  "context": {
    "commit_sha": "abc123",
    "branch_name": "feat/new-feature",
    "status": "success"
  }
}
```

### Error Handoff

When an agent encounters an error that another agent can fix:

```json
{
  "from": "monitor-agent",
  "to": "fix-agent",
  "context": {
    "pr_number": 123,
    "failures": ["test failure"],
    "error_code": 6,
    "logs": "..."
  },
  "skills_needed": ["testing-strategy"],
  "priority": "high"
}
```

### Retry Handoff

When the fix-agent needs to return control to the monitor-agent:

```json
{
  "from": "fix-agent",
  "to": "monitor-agent",
  "context": {
    "pr_number": 123,
    "fixes_applied": ["fixed test configuration"],
    "attempt": 2,
    "max_retries": 3
  }
}
```

## Implementation Notes

1. Handoffs are currently logged for visibility
2. Each agent validates the handoff before accepting
3. Invalid handoffs trigger error handling
4. Circular handoffs are detected and prevented
