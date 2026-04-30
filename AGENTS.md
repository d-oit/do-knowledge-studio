# AGENTS.md

> Production-ready harness for do-knowledge-studio.
> Local-first | TRIZ-based | Structured Data

## Hard Rules
- **Local-first ONLY**: No required backend.
- **SQLite (WASM) + OPFS**: Primary storage.
- **Markdown is NOT canonical truth**: Use only for export/import.
- **Strict TypeScript**: NO `any`, no type assertions without justification.
- **Design Tokens ONLY**: Use CSS variables defined in `src/styles/tokens.css`.
- **Mobile First**: All layouts must be responsive. Minimum tap target 44x44px.

## Coding Workflow
Follow this sequence for every change:
1. **Load Skill**: Use `load_skill('<skill-name>')` on demand.
2. **Implement**: Write strict TypeScript code.
3. **Quality Gate**:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e` (for UI/critical path changes)
4. **Commit**: Follow Conventional Commits via `commitlint`.

## Project Stack
- **DB**: SQLite WASM + OPFS (with FTS5)
- **Search**: Orama (Local RAG)
- **Core**: React 18 + Vite 8 + TypeScript 5
- **Visuals**: Sigma.js, Mind Elixir
- **Editor**: Tiptap

## Available Skills

<!-- AUTO-START:SKILL-TABLE -->
| Skill | Description | Category |
|-------|-------------|----------|
| `accessibility-auditor` | Audit web applications for WCAG 2.2 compliance | Security |
| `agent-browser` | Browser automation CLI for AI agents | workflow |
| `agent-coordination` | Multi-agent orchestration | Coordination |
| `agents-md` | Create AGENTS.md files with production-ready best practices | General |
| `anti-ai-slop` | Avoid generic AI slop aesthetic | General |
| `api-design-first` | Design and document RESTful APIs | API Development |
| `architecture-diagram` | Generate/update architecture diagrams | General |
| `atomic-commit` | Atomic git workflow (validate, commit, push) | General |
| `cicd-pipeline` | Design and implement CI/CD pipelines | DevOps |
| `cloudflare-worker-api` | Structure Worker API routes and handlers | workflow |
| `code-quality` | Review and improve code quality | Quality |
| `code-review-assistant` | Automated code review with PR analysis | General |
| `codeberg-api` | Codeberg API integration | API Development |
| `database-devops` | Database design, migration, and DevOps automation | DevOps |
| `database-schema-migrations` | Design database schema and write migrations | workflow |
| `do-web-doc-resolver` | Compact, LLM-ready web documentation resolver | Documentation |
| `docs-hook` | Lightweight git hook for updating agents-docs | Documentation |
| `document-rendering-and-locators` | Implement resilient document rendering | workflow |
| `dogfood` | Systematically explore and test a web application | quality |
| `git-github-workflow` | Unified atomic git workflow with GitHub integration | General |
| `github-readme` | Create human-focused GitHub README.md files | Documentation |
| `github-workflow` | Complete GitHub workflow automation | General |
| `goap-agent` | Goal-oriented action planning | Coordination |
| `intent-classifier` | Classify user intents and route to skills | Coordination |
| `iterative-refinement` | Execute iterative refinement workflows | General |
| `jules-implement` | Repository-aware implementation agent | General |
| `learn` | Extract non-obvious session learnings | knowledge-management |
| `local-chat-policy` | Guidelines for local-first chat priority | General |
| `memory-context` | Retrieve semantically relevant past learnings | General |
| `migration-refactoring` | Automate complex code migrations | Migration |
| `parallel-execution` | Execute multiple independent tasks simultaneously | Coordination |
| `privacy-first` | Prevent personal data from entering codebase | Security |
| `pwa-offline-sync` | Design Cache Storage + IndexedDB strategy | workflow |
| `reader-ui-ux` | Build localized, accessible reader UI | workflow |
| `secure-invite-and-access` | Implement access control and authentication | workflow |
| `security-code-auditor` | Perform security audits on code | Security |
| `self-fix-loop` | Self-learning fix loop | General |
| `shell-script-quality` | Lint and test shell scripts | Quality |
| `skill-creator` | Create and modify skills | Meta |
| `skill-evaluator` | Evaluate other skills | Meta |
| `stitch-design` | AI-powered UI design generation | General |
| `task-decomposition` | Break complex tasks into atomic goals | Coordination |
| `test-runner` | Execute and diagnose test failures | Quality |
| `testdata-builders` | Maintain deterministic builders for tests | quality |
| `testing-strategy` | Design comprehensive testing strategies | Quality |
| `triz-analysis` | TRIZ contradiction audit | analysis |
| `triz-solver` | Systematic problem-solving using TRIZ principles | Innovation |
| `turso-db` | Turso database development | DevOps |
| `ui-ux-optimize` | UI/UX prompt optimizer | UI/UX |
| `validation-checklist` | Data quality and schema adherence | Quality |
| `web-search-researcher` | Research topics using web search | Research |
<!-- AUTO-END:SKILL-TABLE -->

*Note: Canonical skill source is `.agents/skills/`.*

## Learnings
- `@eslint/js@10` requires ESLint v10 — use `@eslint/js@^9` with ESLint v9
- `eslint-plugin-react-hooks@5.x` required for ESLint v9 compat; v4.x has peer conflicts
- Multiple `gh` accounts: use `gh auth switch --user <account>` before push to fix 403 errors
- Vite 8 uses Rolldown: `build.rolldownOptions` + `codeSplitting.groups` (not `manualChunks`)
- `PHASES.md` in root violates "Markdown is NOT canonical truth" — always place in `docs/`
- `atomic-commit` expects feature branch — create branch before running if on main
- Pre-existing typecheck errors (e.g., `GraphView.tsx`) are unrelated to config migrations

## Single Source of Truth
This file is the canonical source for agent behavior. Detailed docs live in `docs/` and `agents-docs/`.
