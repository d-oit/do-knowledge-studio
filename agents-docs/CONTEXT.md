# Context Engineering and Back-Pressure

> Reference doc - not loaded by default.

Context engineering = systematically managing what enters the context window
to maximize reliability and minimize cost.

## The Instruction Budget

Every item (tool descriptions, instructions, file contents, messages) consumes budget.
Performance degrades as context grows - longer is not better.

## Back-Pressure Priority Order

Implement from top down:

1. **Typechecks / build** - fast, deterministic, catches structural errors instantly
2. **Unit tests** - validates logic
3. **Integration tests** - validates system behavior
4. **Lint / format** - enforces style
5. **Coverage reporting** - surface drops via hook
6. **UI/browser testing** - Playwright, agent-browser

**Critical:** All verification must be context-efficient.
Swallow passing output - surface only failures.

## Context Hygiene

- `/clear` between unrelated tasks
- `Glob`/`Grep` instead of reading whole files
- Sub-agents for research (noise stays in their window)
- Load skills progressively - not at session start
- Prefer CLI tools over MCP servers for well-known services

## Skills Architecture (Progressive Disclosure)

```
AGENTS.md (concise, universal)
  +-- agents-docs/ (detailed reference, loaded on demand)
       +-- Skills with SKILL.md (loaded when agent needs them)
            +-- references/ within each skill (read only what is needed)
```

For efficient retrieval of past project knowledge, use the `memory-context` skill (`csm` CLI) instead of loading the entire `LESSONS.md` file.

All skills are canonical in `.agents/skills/`.
Claude Code, Gemini CLI, and Qwen Code use symlinks (`.claude/skills/`, `.gemini/skills/`, `.qwen/skills/`);
OpenCode reads directly from `.agents/skills/`.
Run `./scripts/setup-skills.sh` to create symlinks for Claude Code, Gemini CLI, and Qwen Code.

## Anti-Patterns

- Running the full test suite after every change
- Reading large file trees into context
- Installing many MCP servers just in case
- One very long session for a multi-day project
- Using larger context windows as a substitute for context isolation
- Auto-generating AGENTS.md (hurts performance; always human-written)
- Loading the entire `LESSONS.md` or `analysis/` directory into context manually (use `memory-context` / `csm query` instead)
- Running `csm index-*` on every session — index once, query many times