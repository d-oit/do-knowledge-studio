# Harness Engineering

> Reference doc - not loaded by default. Link from AGENTS.md or a skill as needed.

`coding agent = AI model(s) + harness`

The harness is everything around the model: AGENTS.md, MCP servers, skills, sub-agents,
hooks, and back-pressure mechanisms. Harness engineering is the practice of tuning these
surfaces to improve output quality and reliability.

## Core Principle: Iterate on Failure

Do not design the ideal harness upfront. Add configuration **only when the agent actually
fails**. When a failure occurs, engineer a solution so it cannot happen the same way again.
Throw away what does not help - more config is not always better.

## AGENTS.md Guidelines

- Keep within `MAX_LINES_AGENTS_MD` (currently 250, enforced by `scripts/agent-surface.py validate`; see `.agents/config.sh`); human-written (never auto-generated - LLM-generated files hurt quality)
- Concise and universally applicable - every instruction costs tokens
- Use progressive disclosure: detailed docs in `agents-docs/`, not the root file

## Skills (Single Canonical Source)

All skills live in `.agents/skills/`. Claude Code, Gemini CLI, and Qwen Code use symlinks
(`.claude/skills/`, `.gemini/skills/`, `.qwen/skills/`) created by `./scripts/setup-skills.sh`.
OpenCode reads skills directly from `.agents/skills/` - no symlinks needed.
See `agents-docs/AVAILABLE_SKILLS.md`.

## MCP Servers

- Only connect servers you actively use and trust
- Tool descriptions inject into the system prompt - each one consumes instruction budget
- Prefer well-known CLIs (GitHub, Docker, databases) over MCP
- Write thin CLI wrappers with concise output rather than verbose MCP responses
- Never connect to untrusted MCP servers - they are a prompt injection vector

## Supported AI Agents

| Agent | Skills Location | Sub-agents |
|-------|-----------------|------------|
| Claude Code | `.claude/skills/` (symlinks) | `.claude/agents/` |
| Gemini CLI | `.gemini/skills/` (symlinks) | - |
| OpenCode | `.agents/skills/` (direct) | `.opencode/agents/` |
| Qwen Code | `.qwen/skills/` (symlinks) | - |
| Cursor | `.cursor/skills/` (symlink) | - |
| Windsurf | `.windsurf/skills/` (symlink) | - |
| Jules | managed via manifest (`symlink_strategy: none`) | - |

> Machine-readable source of truth: `.agents/manifest.json` — update both when adding a tool.

## Further Reading

| Topic | File |
|---|---|
| Delivery lifecycle | `agents-docs/DELIVERY-LIFECYCLE.md` |
| Skills | `agents-docs/AVAILABLE_SKILLS.md` |
| Sub-Agents | `agents-docs/SUB-AGENTS.md` |
| Hooks | `agents-docs/HOOKS.md` |
| Back-Pressure | `agents-docs/CONTEXT.md` |