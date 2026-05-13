---
name: jules
version: 2.0.0
description: >
  Autonomous Jules Delegator skill for delegating complex, multi-file
  tasks to a persistent repository-aware session.
---

# Jules Delegator Skill

This skill allows an agent to delegate autonomous coding tasks to **Jules**, a specialized AI agent designed for deep repository exploration and implementation.

## Core Capabilities

### 1. Repository Session Management
- **Auto-Detection**: Automatically detects the current repository and branch using git commands.
- **Session Lifecycle**: Create sessions, monitor progress, and provide feedback via comments.
- **Persistence**: Maintains context across multi-step research and implementation loops.

### 2. Autonomous Workflow
- **Research**: Uses `grep_search`, `glob`, and `read_file` to map dependencies.
- **Implementation**: Performs surgical code edits using `replace` and `write_file`.
- **Validation**: Executes project-specific quality gates (`npm test`, `npm run lint`).
- **Submission**: Automates PR creation and summary generation.

## Usage Guide

### When to Delegate to Jules
- **Complex Features**: Tasks touching 3+ files or requiring architectural changes.
- **Bug Fixes**: Issues requiring reproduction scripts and deep trace analysis.
- **E2E Testing**: Tasks requiring `agent-browser` and persistent state.
- **Large Refactors**: Deduplication, type-safety improvements, or framework migrations.

### Monitoring & Interaction
- **get_session_state**: Use to check progress without interrupting the agent.
- **get_code_review_context**: Analyze proposed changes before submission.
- **send_reply_to_session**: Provide missing information or correct course.

## Constraints
- **Local-first ONLY**: No required backend.
- **Strict TypeScript**: NO `any`.
- **Single Source of Truth**: `AGENTS.md` is foundational.
- **Zero-Warning Policy**: Must pass all linters and typechecks before submission.

## Jules Toolset (Internal)
Jules operates with a high-fidelity toolset including:
- `run_terminal_command`
- `read_file` / `edit_file`
- `google_search` / `web_fetch`
- `request_plan_review`
- `submit` (for PR generation)

## Orchestration with GOAP
For multi-agent workflows, use the `goap-agent` skill to decompose high-level goals into atomic tasks for Jules.
