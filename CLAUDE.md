@AGENTS.md

<!-- Claude Code-specific instructions only. Do not duplicate content from AGENTS.md. -->

## Claude Code Features

### Sub-Agents
Sub-agent definitions live in `.claude/agents/`. Each is a Markdown file with YAML
frontmatter (`name`, `description`, `tools`, `model`).

Default agents in this template:
- `agent-creator` - scaffold new sub-agent definitions
- `goap-agent` - goal-oriented action planning for complex workflows
- `loop-agent` - iterative refinement loops
- `analysis-swarm` - parallel multi-perspective code analysis

Delegate context-heavy research to sub-agents to keep the parent session focused.
See `agents-docs/SUB-AGENTS.md`.

### Skills
Skills live canonically in `.agents/skills/`. The `.claude/skills/` folder contains
only symlinks. Run `./scripts/setup-skills.sh` once after cloning.

Skills use progressive disclosure - `SKILL.md` is injected only when the agent
decides the skill is needed. Do not pre-load all skills at session start.
See `agents-docs/SKILLS.md`.

### Custom Commands
Project slash commands live in `.claude/commands/`. Use them for repeatable workflows.

### Hooks
Verification hooks run automatically on agent stop events.
- Exit `0` = silent success (nothing extra enters context)
- Exit `2` = errors surfaced to agent, forcing remediation before finishing
See `agents-docs/HOOKS.md`.

### Headless / CI Mode
```bash
claude -p "your prompt" --output-format stream-json
```

### Context Management
- Use `/clear` between unrelated tasks
- Use `Glob`/`Grep` to find code instead of reading whole file trees
- Prefer sub-agents for multi-step research tasks
- See `agents-docs/CONTEXT.md`