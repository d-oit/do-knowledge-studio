# AGENTS.md

> Production-ready harness for do-knowledge-studio.
> Local-first | TRIZ-based | Structured Data

## HARD RULES
- **Local-first ONLY**: No required backend.
- **SQLite (WASM) + OPFS**: Primary storage.
- **Markdown is NOT canonical truth**: Use only for export/import.
- **Strict TypeScript**: NO `any`.

## Search Retrieval Pipeline
The search system uses a staged pipeline for efficiency and relevance:
1.  **Stage 1: FTS5 (Exact Recall)**: Uses SQLite FTS5 for fast, keyword-based candidate generation.
2.  **Stage 2: Semantic (Orama)**: Triggered for broad queries or as a fallback/reranker to provide semantic similarity.
3.  **Stage 3: Graph Expansion**: (Optional) Broadens context by including immediate neighbors from the knowledge graph.

## Project Stack
- **DB**: SQLite WASM + OPFS (with FTS5)
- **Search**: Staged Retrieval (SQLite FTS5 -> Orama Semantic -> Graph Expansion)
- **Core**: React + Vite + TypeScript
- **Visuals**: Sigma.js, Mind Elixir
- **Editor**: Tiptap

## Quality Gate
- Run `npm test` (Vitest)
- Run `npm run lint`
- Run `npm run typecheck`

## UI/UX Guardrails
- **Design Tokens ONLY**: Use CSS variables defined in `src/styles/index.css`.
- **Mobile First**: All layouts must be responsive.
- **Interactive Targets**: Minimum tap target size of 44x44px.

## CLI Commands
- `sync <dir>`: Sync markdown files to the local database.
- `export --format site`: Generate a static site from your knowledge base.
- `entity-create <name>`: Create a new entity via CLI.
- `claim-create <entity> <statement>`: Add a claim via CLI.

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
