# AGENTS.md

> Single source of truth for AI coding agents working in this repository.

## Project

Local-first knowledge studio with rich text, knowledge graph, mind maps, SQLite WASM + FTS5 search, static export, CLI automation, and an AI agent harness.

## Hard Rules

- Local-first only. Do not introduce a required backend.
- SQLite WASM + OPFS is the primary storage layer.
- Markdown is import/export, not canonical truth.
- Use strict TypeScript. Do not use `any`.
- No magic numbers; extract descriptive named constants.
- No hardcoded project-level settings outside config, constants, or env layers.
- Max 500 LOC per source file; refactor before extending oversized files.
- Prefer small, composable modules over mixed-responsibility files.
- Reuse existing abstractions before introducing new patterns.
- Keep changes scoped; avoid unrelated refactors in the same commit.

## Repository Shape

- `src/app` - app shell, routing, layout
- `src/db` - SQLite WASM database layer and FTS5 search
- `src/features` - editor, graph, mind map, search, export
- `src/lib` - shared utilities and Orama search helpers
- `cli/` - TypeScript CLI entrypoints and commands
- `export/` - static site export engine
- `tests/` - Playwright end-to-end tests
- `scripts/` - reusable repository automation
- `plans/` - GOAP plans, ADRs, audits, implementation notes, benchmarks
- `agents-docs/` - detailed harness, workflow, config, hooks, and skill docs

## Planning Workflow

- For every non-trivial task, create or update planning artifacts in `plans/`.
- Use `plans/` for GOAP decomposition, task plans, audits, benchmarks, and implementation notes.
- Use `plans/ADRs/` for architecture decision records.
- If a task changes architecture, storage, search behavior, export behavior, agent workflow, or cross-cutting infrastructure, add or update an ADR.
- Follow the existing `plans/` naming style: numbered plans for implementation tracks, descriptive names for audits and benchmarks, and dedicated ADR files in `plans/ADRs/`.
- Do not write planning, audit, or analysis markdown in the repository root.

## File Placement Rules

- Never create temp, debug, scratch, analysis, or one-off script files in the repository root.
- Never leave ad-hoc `tmp-*`, `debug-*`, `analyze-*`, `notes-*`, or throwaway files in the root.
- Use `plans/` for persistent analysis and planning artifacts.
- Use `scripts/` only for reusable repository automation that belongs in version control.
- Use system temp locations such as `/tmp` or `mktemp` for ephemeral files.
- If an output is only needed during execution, keep it out of the repository.
- Root-level files must remain intentional project manifests, configs, or primary documentation only.

## Package Manager

Use `pnpm` only.

## Setup

```bash
pnpm install
./scripts/setup-skills.sh
./scripts/validate-skills.sh
```

## Development Commands

```bash
pnpm run dev
pnpm run build
pnpm run preview
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run test:e2e
pnpm run test:e2e:ci
pnpm run cli -- <command>
```

## Quality Workflow

Run for any non-trivial change:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Also run for UI, editor, graph, mind map, database, search, export, or critical workflow changes:

```bash
pnpm run test:e2e
```

Required before commit:

```bash
./scripts/quality_gate.sh
```

Useful fast path:

```bash
./scripts/minimal_quality_gate.sh
```

Useful validation helpers:

```bash
./scripts/validate-package-manager.sh
./scripts/validate-git-hooks.sh
./scripts/verify.sh
./scripts/docs-sync.sh
```

If CI fails after pushing, use the existing repair workflow:

```bash
./scripts/self-fix-loop.sh
```

## Testing Expectations

- Use Vitest for unit and integration coverage.
- Use Playwright for critical end-to-end user journeys.
- Keep critical flows covered: entity CRUD, claim creation, local search/chat flows, graph interaction, and mind map editing.
- When touching database, validation, NLP/search, queueing, or export behavior, add or update tests close to the changed logic.
- Run `pnpm run test:coverage` for core data-model, search, export, or infrastructure changes.

## UI / UX Guardrails

- Use design tokens from `src/styles/index.css`.
- Build mobile-first.
- Keep interactive targets at least 44x44px.
- Preserve responsive behavior across editor, graph, search, and mind map views.

## Git Workflow

Start from an up-to-date branch:

```bash
git fetch origin
git pull --rebase
git checkout -b feat/<short-name>
```

Never commit directly to `main`.

Use conventional commits:

```bash
git commit -m "feat(scope): short description"
```

If hooks are needed locally:

```bash
./scripts/install-hooks.sh
./scripts/validate-git-hooks.sh
```

Do not finish with failing lint, typecheck, tests, build, or quality gate output.

## Skills

- Canonical skills live in `.agents/skills/`.
- Refresh symlinks with `./scripts/setup-skills.sh`.
- Load only the skills needed for the task to limit context usage.
- Prefer existing skills and existing `agents-docs/` guidance before inventing a new workflow.

## Learnings

- Skim existing learnings before non-trivial work.
- After a successful task, update the nearest relevant `AGENTS.md` if the task produced a durable lesson.
- Record only durable lessons: hidden file relationships, surprising runtime behavior, undocumented commands, fragile config, or files that must change together.
- Merge duplicates, shorten wording, and remove stale guidance when updating learnings.
- Scope learnings correctly:
  - project-wide -> root `AGENTS.md`
  - script-specific -> `scripts/AGENTS.md`
  - skill-specific -> nearest skill-level `AGENTS.md`
- Keep verbose historical detail out of the root file.

## Research / Analysis

For complex multi-source analysis or parallel web research, use:

```bash
./scripts/swarm-worktree-web-research.sh "Topic"
```

Optional cleanup profile:

```bash
./scripts/swarm-worktree-web-research.sh --profile balanced --cleanup "Topic"
```

Any persistent outputs from research belong in `plans/`, not in the repository root.

## Context

Read these only when relevant:

- `agents-docs/HARNESS.md` - harness engineering and context budgeting
- `agents-docs/WORKFLOW.md` - detailed workflow procedures
- `agents-docs/AVAILABLE_SKILLS.md` - skill catalog and usage
- `agents-docs/SUB-AGENTS.md` - delegation patterns
- `agents-docs/HOOKS.md` - hook behavior
- `agents-docs/CONTEXT.md` - context-loading and back-pressure
- `agents-docs/CONFIG.md` - repository constants and configuration
- `agents-docs/MIGRATION.md` - migration guidance

## Completion Checklist

Before marking a task done:

- Plan exists or was updated in `plans/` for non-trivial work.
- ADR exists or was updated in `plans/ADRs/` when architecture changed.
- No temp, scratch, analysis, or one-off script files were added to the repository root.
- Lint, typecheck, tests, and build pass.
- Relevant docs or learnings were updated and compacted if the task produced durable new guidance.
