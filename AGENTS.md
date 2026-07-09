# AGENTS.md

> Single source of truth for AI coding agents working in this repository.

## Project

Local-first knowledge studio built with Next.js 16 / React 19 / Tailwind 4 / shadcn / Zustand. Rich text editing, knowledge graph, mind maps, client-side search, export, and an AI agent harness. Persistence via Zustand + localStorage. No required backend.

## Hard Rules

- Local-first only. Do not introduce a required backend.
- Zustand + localStorage is the persistence layer.
- Markdown is import/export, not canonical truth.
- Use strict TypeScript. Do not use `any`.
- No magic numbers; extract descriptive named constants.
- No hardcoded project-level settings outside config, constants, or env layers.
- Max 500 LOC per source file; refactor before extending oversized files.
- Prefer small, composable modules over mixed-responsibility files.
- Reuse existing abstractions before introducing new patterns.
- Keep changes scoped; avoid unrelated refactors in the same commit.
- **Never** create GitHub releases manually (`gh release create`). Releases are handled by `.github/workflows/version-propagation.yml` — edit `VERSION` and the workflow propagates and tags automatically.
- Never modify `biome.json`, any `eslint` configuration file, or lint suppressions/ignore settings unless I explicitly request that change. If such a change seems necessary, stop, explain why, and ask for approval before editing.

## Repository Shape

- `src/app` - Next.js app shell, routing, layout (App Router)
- `src/components/studio` - React components (views, UI primitives)
- `src/lib/studio` - Zustand store, types, seed data, utilities
- `src/lib/ai` - AI provider adapters (client-side fetch)
- `src/lib/export` - Export logic (JSON, MD, HTML, encrypted)
- `src/lib/search` - Client-side retrieval engine
- `scripts/` - reusable repository automation
- `plans/` - GOAP plans, ADRs, audits, implementation notes
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
pnpm run start
pnpm run lint
pnpm run typecheck
pnpm run test
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
- Keep critical flows covered: entity CRUD, claim creation, local search/chat flows, graph interaction, and mind map editing.
- When touching database, validation, NLP/search, queueing, or export behavior, add or update tests close to the changed logic.
- Run `pnpm run test:coverage` for core data-model, search, export, or infrastructure changes.

## UI / UX Guardrails

- Use design tokens from `src/app/globals.css` `@theme` block (source of truth).
- Two themes: `light` and `dark` via `data-theme` attribute.
- Accent color: Emerald green (`#10b981` light, `#34d399` dark).
- Font: Inter (clean SaaS aesthetic).
- Build mobile-first.
- Keep interactive targets at least 44x44px.
- Preserve responsive behavior across editor, graph, search, and mind map views.
- Never hardcode hex values in components — use tokens.

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

### Available Skills

| Skill | Description | Category |
|-------|-------------|----------|
| `accessibility-auditor` | Audit web applications for WCAG 2.2 compliance, screen reade | Security |
| `agent-browser` | Browser automation CLI for AI agents. Use when the user need | workflow |
| `agent-coordination` | Coordinate multiple agents for software development across a | Coordination |
| `agents-md` | Create AGENTS.md files with production-ready best practices. | General |
| `anti-ai-slop` | Avoid generic AI aesthetic in UI/UX design and copy | General |
| `api-design-first` | Design and document RESTful APIs using design-first principl | API Development |
| `architecture-diagram` | Generate or update a project architecture SVG diagram by sca | General |
| `atomic-commit` | Atomic git workflow - validates, commits, pushes, creates PR | General |
| `cicd-pipeline` | Design and implement CI/CD pipelines with GitHub Actions, Gi | DevOps |
| `cloudflare-worker-api` | > | workflow |
| `codacy` | Use Codacy static analysis CLIs to query PR analysis, triage | Quality |
| `code-quality` | Review and improve code quality across any programming langu | Quality |
| `code-review-assistant` | Automated code review with PR analysis, change summaries, an | General |
| `codeberg-api` | >- | API Development |
| `database-devops` | Database design, migration, and DevOps automation with safet | DevOps |
| `database-schema-migrations` | > | workflow |
| `do-web-doc-resolver` | Python resolver for URLs and queries into compact, LLM-ready | Documentation |
| `docs-hook` | Lightweight git hook integration for updating agents-docs wi | Documentation |
| `document-rendering-and-locators` | > | workflow |
| `dogfood` | Systematically explore and test a web application to find bu | quality |
| `git-github-workflow` | Unified atomic git workflow with GitHub integration - commit | General |
| `github-readme` | Create human-focused GitHub README.md files with 2026 best p | Documentation |
| `github-workflow` | Complete GitHub workflow automation - push, create branch/PR | General |
| `goap-agent` | Invoke for complex multi-step tasks requiring intelligent pl | Coordination |
| `impeccable` | Canonical skill for frontend UI design, visual polish, and UX critique. Prevents common AI design patterns. Covers typography, color, spacing, layout, motion, and interaction.
| General |
| `intent-classifier` | Classify user intents and route to appropriate skills, comma | Coordination |
| `iterative-refinement` | Execute iterative refinement workflows with validation loops | General |
| `jules` | > | General |
| `jules-implement` | > | General |
| `learn` | Extract non-obvious session learnings into scoped AGENTS.md  | knowledge-management |
| `local-chat-policy` | Guidelines for ensuring chat functionality prioritizes local | General |
| `memory-context` | Retrieve semantically relevant past learnings and analysis o | General |
| `migration-refactoring` | Automate complex code migrations and refactorings with safet | Migration |
| `parallel-execution` | Execute multiple independent tasks simultaneously using para | Coordination |
| `privacy-first` | > | Security |
| `pwa-offline-sync` | > | workflow |
| `reader-ui-ux` | > | workflow |
| `secure-invite-and-access` | > | workflow |
| `security-code-auditor` | Perform security audits on code to identify vulnerabilities, | Security |
| `self-fix-loop` | Self-learning fix loop - commit, push, monitor CI, auto-fix  | General |
| `shell-script-quality` | Lint and test shell scripts using ShellCheck and BATS. Use w | Quality |
| `skill-creator` | Create new skills, modify and improve existing skills, and m | Meta |
| `skill-evaluator` | Reusable skill for evaluating other skills with structure ch | Meta |
| `static-analysis-suppression` | Suppress false-positive Codacy/DeepSource/ESLint blockers on PRs with code-level, config-level, or admin-merge fixes. Follows decision tree: fix code before suppressing config before admin override. | Quality |
| `stitch-design` | > | General |
| `task-decomposition` | Break down complex tasks into atomic, actionable goals with  | Coordination |
| `test-runner` | Execute tests, analyze results, and diagnose failures across | Quality |
| `testdata-builders` | > | quality |
| `testing-strategy` | Design comprehensive testing strategies with modern techniqu | Quality |
| `triz-analysis` | Run a systematic TRIZ contradiction audit against a codebase | analysis |
| `triz-solver` | Systematic problem-solving using TRIZ (Theory of Inventive P | innovation-problem-solving |
| `turso-db` | Use this skill for Turso (LibSQL/Limbo) database development | DevOps |
| `ui-ux-optimize` | > | UI/UX |
| `validation-checklist` | Maintain high data quality and schema adherence within the k | Quality |
| `web-search-researcher` | Research topics using web search to find accurate, current i | Research |
