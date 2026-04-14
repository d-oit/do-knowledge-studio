# AGENTS.md

> Single source of truth for all AI coding agents in this repository.
> Supported by: Claude Code, Windsurf, Gemini CLI, Codex, Copilot, OpenCode, Devin, Amp, Zed, Warp, RooCode, Jules
> See: https://agents.md

## Named Constants

```bash
# File size limits (lines)
readonly MAX_LINES_PER_SOURCE_FILE=500
readonly MAX_LINES_PER_SKILL_MD=250
readonly MAX_LINES_AGENTS_MD=150

# Retry and polling configuration
readonly DEFAULT_MAX_RETRIES=3
readonly DEFAULT_RETRY_DELAY_SECONDS=5
readonly DEFAULT_POLL_INTERVAL_SECONDS=5
readonly DEFAULT_MAX_POLL_ATTEMPTS=12
readonly DEFAULT_TIMEOUT_SECONDS=1800

# Git/PR configuration
readonly MAX_COMMIT_SUBJECT_LENGTH=72
readonly MAX_PR_TITLE_LENGTH=72
```

## Project Overview

Production-ready template for AI agent-powered development.
Primary stack: Bash scripts, Markdown documentation, GitHub Actions CI/CD.

## Setup

```bash
# Create skill symlinks (run after clone)
./scripts/setup-skills.sh

# Install git pre-commit hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

## Version Management

**Single source of truth**: `VERSION` file at project root. Never manually edit version strings in other files.

```bash
# Bump version - edit VERSION only
echo "0.3.0" > VERSION
git add VERSION
git commit -m "chore: bump version to 0.3.0"
# Pre-commit hook auto-propagates to README.md, QUICKSTART.md, etc.
```

See `agents-docs/VERSION.md` for full workflow details.

## Quality Gate (Required Before Commit)

```bash
./scripts/quality_gate.sh
```

**Always run before committing. Fix all errors.**

**Guard Rails:** The pre-commit hook validates git config to prevent global hooks from overriding local. If global hooks detected, run `git config --global --unset core.hooksPath` or use `SKIP_GLOBAL_HOOKS_CHECK=true git commit -m "..."` to skip.

## Code Style

- Max `${MAX_LINES_PER_SOURCE_FILE}` lines per source file; `${MAX_LINES_PER_SKILL_MD}` per `SKILL.md`; `${MAX_LINES_AGENTS_MD}` per `AGENTS.md`
- `SKILL.md` must start with frontmatter (`---` on line 1)
- **Reference format**: `` `references/filename.md` - Description `` (no @ prefix, no markdown links)
- Conventional Commits: `feat:`, `fix:`, `docs:`, `ci:`, `test:`, `refactor:`
- Shell scripts: `shellcheck` for linting, `bats` for testing
- Markdown: `markdownlint` for consistency
- No magic numbers - use named constants; Use `mermaid` for diagrams

## Repository Structure

**Fixed Infrastructure** (Required, never changes):
```
<project-root>/
├── AGENTS.md              # Single source of truth (this file)
├── agents-docs/           # Detailed reference (loaded on demand)
├── .agents/skills/        # Canonical skill source
└── scripts/               # Setup, validation, quality gates
```

**Dynamic Folders** (Created as needed):
- `.claude/`, `.gemini/`, `.qwen/` - Agent-specific symlinks → `.agents/skills/`
- `<agent-name>.md` - Override files for specific agents
- `analysis/` - Generated analysis outputs (audits, swarm analysis, TRIZ analysis)
- `reports/` - Generated reports and summaries

**Generated Files Rule**: Place all agent-generated analysis, reports, and temporary outputs in `analysis/` or `reports/`, never in project root.

## Testing

- Write/update tests for every change; Tests must be deterministic
- Success is silent; surface only failures. See `agents-docs/CONTEXT.md`

## PR Instructions

- Title: `[type(scope)] description` (max `${MAX_PR_TITLE_LENGTH}` chars)
- Create branch per feature - never commit to `main`; One concern per PR

## Security

- Never commit secrets/API keys - use `.env` (gitignored)
- Pin all GitHub Actions to full SHA (use `# vX.Y` comment); Dependabot handles updates
- Never connect to untrusted MCP servers; Report vulnerabilities via GitHub private advisories

## Agent Guidance

### Plan Before Executing
For non-trivial tasks: produce a written plan first, pause, wait for confirmation.

### Atomic Commit Policy (Optional / Customizable)
You MAY customize the atomic commit workflow for your project needs. See `agents-docs/WORKFLOW.md#atomic-commit-workflow` for details.

### Pre-Existing Issue Policy (REQUIRED)
Fix ALL pre-existing issues before completing. See `agents-docs/WORKFLOW.md#pre-existing-issue-resolution` for the full process.

### Post-Task Learning
After non-trivial work: run the `learn` skill or manually append non-obvious discoveries to the nearest relevant `AGENTS.md`. Capture only: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together. Never write: obvious facts, duplicates, verbose explanations. See `agents-docs/WORKFLOW.md#post-task-learning` for details.

#### Recent Project-Wide Learnings
- **Worktree Cleanup**: Scripts creating worktrees must register them in `CREATED_WORKTREES` and use the `trap cleanup EXIT ERR` pattern (LESSON-010)

### Context Discipline
- Delegate research to sub-agents; Use `/clear` between unrelated tasks
- Load skills only when needed; See `agents-docs/SKILLS.md` for skill framework
- **Post-task**: Use `learn` skill to capture non-obvious insights in scoped `AGENTS.md` files

### Nested AGENTS.md
For monorepos, place additional `AGENTS.md` inside each sub-package. Nearest file takes precedence.

## Reference Docs

See `agents-docs/` for detailed reference documentation.

## Available Skills

Skills are auto-generated from `.agents/skills/` and symlinked to agent directories (`.claude/skills/`, `.gemini/skills/`, `.qwen/skills/`).

Run `ls .agents/skills/` to see all available skills, or check `agents-docs/AVAILABLE_SKILLS.md` for descriptions.

To add a new skill: create `SKILL.md` in `.agents/skills/<skill-name>/` and run `./scripts/setup-skills.sh`.
