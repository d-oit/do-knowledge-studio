# AGENTS.md

> Production-ready harness for do-knowledge-studio.
> Local-first | TRIZ-based | Structured Data

## HARD RULES
- **Local-first ONLY**: No required backend.
- **SQLite (WASM) + OPFS**: Primary storage.
- **Markdown is NOT canonical truth**: Use only for export/import.
- **Strict TypeScript**: NO `any`.

## Project Stack
- **DB**: SQLite WASM + OPFS (with FTS5)
- **Search**: Orama (Local RAG)
- **Core**: React + Vite + TypeScript
- **Visuals**: Sigma.js, Mind Elixir
- **Editor**: Tiptap

## Quality Gate
- Run `npm test` (Vitest - unit/integration)
- Run `npm run test:e2e` (Playwright - E2E critical paths)
- Run `npm run lint`
- Run `npm run typecheck`

### Testing Strategy (2026 Best Practices)

**Test Pyramid**:
- 70% Unit tests (Vitest - fast, isolated)
- 20% Integration tests (Vitest + MSW - API/stores)
- 10% E2E tests (Playwright - critical journeys)

**Coverage Targets**:
- Lines/Functions/Branches: 80% minimum
- Critical paths (auth, entity CRUD, graph): 100% covered
- Exclude: config, types, mocks, e2e tests

**2026 Tool Stack**:
- Unit/Integration: Vitest with v8 coverage
- E2E: Playwright (cross-browser, component tests)
- Mocking: vi.mock() for units, MSW for integration

**Required Test Coverage**:
- All repository CRUD operations
- Validation schemas (Zod)
- NLP utilities
- Job queue/coalescing logic

### E2E Test Requirements

**Critical Journeys** (must cover):
1. User can create/view/edit/delete entities
2. User can add claims to entities
3. User can search via chat (local RAG)
4. Graph visualization renders and interacts
5. Mind map creation and editing

**Browser Matrix**:
- Chromium (primary)
- Mobile viewport (375px)
- Tablet viewport (768px)

## UI/UX Guardrails
- **Design Tokens ONLY**: Use CSS variables defined in `src/styles/index.css`.
- **Mobile First**: All layouts must be responsive.
- **Interactive Targets**: Minimum tap target size of 44x44px.

## CLI Commands
- `sync <dir>`: Sync markdown files to the local database.
- `export --format site`: Generate a static site from your knowledge base.
- `entity-create <name>`: Create a new entity via CLI.
- `claim-create <entity> <statement>`: Add a claim via CLI.

## Skills

The canonical skill source is `.agents/skills/`. See the full table below for all available skills.

### Available Skills

| Skill | Description | Category |
|-------|-------------|----------|
| `accessibility-auditor` | Audit web applications for WCAG 2.2 compliance, screen reade | Security |
| `agent-browser` | Browser automation CLI for AI agents. Use when the user need | workflow |
| `agent-coordination` | Coordinate multiple agents for software development across a | Coordination |
| `agents-md` | Create AGENTS.md files with production-ready best practices. | General |
| `anti-ai-slop` | > | General |
| `api-design-first` | Design and document RESTful APIs using design-first principl | API Development |
| `architecture-diagram` | Generate or update a project architecture SVG diagram by sca | General |
| `atomic-commit` | Atomic git workflow - validates, commits, pushes, creates PR | General |
| `cicd-pipeline` | Design and implement CI/CD pipelines with GitHub Actions, Gi | DevOps |
| `cloudflare-worker-api` | > | workflow |
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
| `intent-classifier` | Classify user intents and route to appropriate skills, comma | Coordination |
| `iterative-refinement` | Execute iterative refinement workflows with validation loops | General |
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
| `llm-provider-system` | Plugin system for OpenRouter/Kilo Gateway free LLM models | LLM Integration |

## Single Source of Truth
This file (`AGENTS.md`) is the source of truth for all agents. Agent-specific instructions live in `.agents/`.
- `swarm-worktree-web-research.sh <topic>`: Parallel web research workflow.
- `plans/`: Swarm analysis recommendations and implementation plans.
