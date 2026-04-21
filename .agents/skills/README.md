# .agents/skills/ - Canonical Skill Source

This is the **single canonical location** for all skills in this repository.

Claude Code, Gemini CLI, and Qwen Code use symlinks; OpenCode reads directly from `.agents/skills/`:

```
.claude/skills/<name>      -> ../../.agents/skills/<name>
.gemini/skills/<name>      -> ../../.agents/skills/<name>
.qwen/skills/<name>        -> ../../.agents/skills/<name>
```

## Setup

After cloning, run once to create all symlinks:

```bash
./scripts/setup-skills.sh
```

Validate symlinks are intact:

```bash
./scripts/validate-skills.sh
```

## Adding a New Skill

1. Create `.agents/skills/<skill-name>/SKILL.md` (see `agents-docs/SKILLS.md`)
2. Add `reference/` folder for detailed content (optional)
3. Run `./scripts/setup-skills.sh` to create symlinks for all CLI tools
4. The skill is now available in Claude Code, OpenCode, Gemini CLI, and Qwen Code

## Skills in This Repository

> Auto-generated from skill definitions. Run `./scripts/generate-skills-readme.py` to regenerate.

| Skill | Description |
|---|---|
| [`accessibility-auditor/`](accessibility-auditor/) | Audit web applications for WCAG 2.2 compliance, screen reader compatibility, keyboard navigation, and color contrast. Triggers on "accessibility audit", "a11y check", "WCAG compliance", "screen reader test", "keyboard navigation", "color contrast check", "ARIA validation", "wcag", " Section 508", "ADA compliance". |
| [`agent-browser/`](agent-browser/) | Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. |
| [`agent-coordination/`](agent-coordination/) | Coordinate multiple agents for software development across any language. Use for parallel execution of independent tasks, sequential chains with dependencies, swarm analysis from multiple perspectives, or iterative refinement loops. Handles Python, JavaScript, Java, Go, Rust, C#, and other languages. |
| [`agents-md/`](agents-md/) | Create AGENTS.md files with production-ready best practices. Use when creating new AGENTS.md or implementing quality gates. |
| [`anti-ai-slop/`](anti-ai-slop/) | Apply this skill whenever the user wants to audit, fix, redesign, write, or review UI, UX, copy, or text to avoid the generic "AI slop" aesthetic of 2025–2026. Triggers include: "make this feel less AI", "this looks too generic", "avoid AI clichés", "audit my copy", "anti-pattern review", "humanize this", "this feels soulless", "too corporate", "fix the UX writing", "why does this feel like ChatGPT made it", "anti-design", "brutalist", "raw", "intentional", "authentic", "distinctive", "not like every other AI app", "responsive", "mobile", "tablet", "desktop". Also trigger when producing new UI, copy, or UX flows and the user cares about quality and distinctiveness. Always verify mobile, tablet, and desktop views for proper navigation and layout. This skill is your checklist, diagnostic tool, and creative brief for everything that makes design feel human, considered, and real in 2026. |
| [`api-design-first/`](api-design-first/) | Design and document RESTful APIs using design-first principles with OpenAPI specifications. Use when users ask to 'design an API', 'create API spec', 'REST API', 'OpenAPI', 'Swagger', or 'API documentation'. Trigger on API design tasks, endpoint planning, request/response modeling, or API versioning discussions. |
| [`architecture-diagram/`](architecture-diagram/) | Generate or update a project architecture SVG diagram by scanning the live project structure. Use this skill whenever the user asks to regenerate, refresh, or update the architecture diagram, or when skills, agents, or commands have been added/removed and the diagram is stale. Triggers on phrases like "update the diagram", "regenerate the architecture SVG", "sync the diagram", or "diagram is out of date". |
| [`atomic-commit/`](atomic-commit/) | Atomic git workflow - validates, commits, pushes, creates PR, and verifies CI with zero-warnings policy. Orchestrates complete code submission as state machine with rollback on failure. |
| [`cicd-pipeline/`](cicd-pipeline/) | Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions. Use for automated testing, deployment strategies (blue-green, canary), security scanning, and multi-environment workflows. Includes pipeline optimization, secrets management, and failure handling patterns. |
| [`cloudflare-worker-api/`](cloudflare-worker-api/) | Structure Worker API routes and handlers. Activate for route definition, response helpers, and typed handler patterns. Auth belongs to secure-invite-and-access. |
| [`code-quality/`](code-quality/) | Review and improve code quality across any programming language. Use when conducting code reviews, refactoring for best practices, identifying code smells, or improving maintainability. |
| [`code-review-assistant/`](code-review-assistant/) | Automated code review with PR analysis, change summaries, and quality checks. Use for reviewing pull requests, generating review comments, checking against best practices, and identifying potential issues. Includes style guide compliance, security issue detection, and review automation. |
| [`codeberg-api/`](codeberg-api/) | Interact with Forgejo/Codeberg repositories via the REST API — read or write files, manage issues, create pull requests, list branches/tags, search repos, and automate CI/CD workflows. Use this skill when the user wants to: read file contents from a Forgejo repo, create or update files, manage issues (create, list, close), list repositories for a user, search, set up Forgejo Actions workflows, or automate any git-forge operation. Works without authentication for public repos; requires FORGEJO_TOKEN for private repos and write operations. |
| [`database-devops/`](database-devops/) | Database design, migration, and DevOps automation with safety patterns. Use for schema design, migration planning, query optimization, multi-database orchestration, and Infrastructure-as-Code. Includes rollback strategies, performance analysis, and cross-database synchronization. |
| [`database-schema-migrations/`](database-schema-migrations/) | Design database schema and write migrations. Activate for table design, migration scripts, or schema changes. Generic pattern adaptable to any SQL database. |
| [`do-web-doc-resolver/`](do-web-doc-resolver/) | Python resolver for URLs and queries into compact, LLM-ready markdown. Uses progressive free-first cascade with quality scoring, circuit breakers, layered routing memory, trace-based evaluation, and agent-friendly docs validation. Use when fetching documentation, resolving web URLs, or building context from web sources. |
| [`docs-hook/`](docs-hook/) | Lightweight git hook integration for updating agents-docs with minimal tokens. Triggered on commit/merge events to sync documentation. |
| [`document-rendering-and-locators/`](document-rendering-and-locators/) | Implement resilient document rendering and annotation anchoring. Activate for reader-core, TOC, locator, or highlight anchoring changes. Generic pattern applicable to EPUB, PDF, or any document format. |
| [`dogfood/`](dogfood/) | Systematically explore and test a web application to find bugs, UX issues, and other problems. Use when asked to "dogfood", "QA", "exploratory test", "find issues", "bug hunt", "test this app/site/platform", or review the quality of a web application. Produces a structured report with full reproduction evidence. |
| [`git-github-workflow/`](git-github-workflow/) | Unified atomic git workflow with GitHub integration - commits all changes, checks GitHub issues, creates PR, validates all Actions pass including pre-existing, uses swarm coordination with web research on failures. Post-merge validation of all files and docs. |
| [`github-readme/`](github-readme/) | Create human-focused GitHub README.md files with 2026 best practices. Use when creating new projects, improving documentation, adding quick start guides, writing contribution guidelines, or making repositories more discoverable and user-friendly. |
| [`github-workflow/`](github-workflow/) | Complete GitHub workflow automation - push, create branch/PR, monitor Actions with pre-existing issue detection, auto-merge/rebase when checks pass. Handles the full git→GitHub→merge lifecycle. |
| [`goap-agent/`](goap-agent/) | Invoke for complex multi-step tasks requiring intelligent planning and multi-agent coordination. Use when tasks need decomposition, dependency mapping, parallel/sequential/swarm/iterative execution strategies, or coordination of multiple specialized agents with quality gates. |
| [`intent-classifier/`](intent-classifier/) | Classify user intents and route to appropriate skills, commands, or workflows. Use when determining which skill to invoke, routing requests to specialized agents, or building skill selection logic. Trigger on 'which skill should I use', 'route this to', 'classify this request', 'skill selection', or when multiple skills could handle a task. |
| [`iterative-refinement/`](iterative-refinement/) | Execute iterative refinement workflows with validation loops until quality criteria are met. Use for test-fix cycles, code quality improvement, performance optimization, or any task requiring repeated action-validate-improve cycles. |
| [`jules-implement/`](jules-implement/) | Repository-aware implementation agent that handles delta-based targeted research, code generation, and validation of Stitch-rendered designs. |
| [`learn/`](learn/) | Extract non-obvious session learnings into scoped AGENTS.md files |
| [`local-chat-policy/`](local-chat-policy/) | Guidelines for ensuring chat functionality prioritizes local data and respects privacy. |
| [`memory-context/`](memory-context/) | Retrieve semantically relevant past learnings and analysis outputs using the csm CLI (HDC encoder with hybrid BM25 retrieval) |
| [`migration-refactoring/`](migration-refactoring/) | Automate complex code migrations and refactorings with safety patterns. Use when upgrading dependencies, migrating frameworks (React class→hooks, Flask→FastAPI), modernizing languages (Python 2→3), or performing large-scale refactories. Includes breaking change analysis, automated fix application, rollback strategies, and cross-file dependency tracking. |
| [`parallel-execution/`](parallel-execution/) | Execute multiple independent tasks simultaneously using parallel agent coordination to maximize throughput and minimize execution time. Use when tasks have no dependencies, results can be aggregated, and agents are available for concurrent work. |
| [`privacy-first/`](privacy-first/) | Prevent email addresses and personal data from entering the codebase. Use when user asks to "prevent emails", "remove personal data", "privacy check", "no email", or when writing/ editing any code, config, or documentation files. |
| [`pwa-offline-sync/`](pwa-offline-sync/) | Design Cache Storage + IndexedDB strategy and sync queue. Activate for service worker, cache, or offline bug investigation. Generic pattern for any offline-first application. |
| [`reader-ui-ux/`](reader-ui-ux/) | Build localized, accessible reader/admin UI with responsive layouts, telemetry, and state management. Activate for React screens or UX polish. Generic pattern for any document reader application. |
| [`secure-invite-and-access/`](secure-invite-and-access/) | Implement access control, authentication, and authorization patterns. Activate for auth endpoints, permission management, session/token logic, or signed URL generation. Generic template adaptable to any project's auth needs. |
| [`security-code-auditor/`](security-code-auditor/) | Perform security audits on code to identify vulnerabilities, misconfigurations, and security anti-patterns. Use when users ask to 'audit', 'review', or 'check security' of code, configurations, or repositories. Trigger on keywords like 'security review', 'vulnerability scan', 'OWASP', 'secure coding', 'penetration test', or 'security assessment'. |
| [`self-fix-loop/`](self-fix-loop/) | Self-learning fix loop - commit, push, monitor CI, auto-fix failures using swarm agents with skills on demand, loop until all checks pass. |
| [`shell-script-quality/`](shell-script-quality/) | Lint and test shell scripts using ShellCheck and BATS. Use when checking bash/sh scripts for errors, writing shell script tests, fixing ShellCheck warnings, setting up CI/CD for shell scripts, or improving bash code quality. |
| [`skill-creator/`](skill-creator/) | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy. |
| [`skill-evaluator/`](skill-evaluator/) | Reusable skill for evaluating other skills with structure checks, eval coverage review, and real usage spot checks. Use when you need to check a skill, add evals, benchmark a skill, validate outputs against assertions, or compare current skill behavior against a baseline. |
| [`stitch-design/`](stitch-design/) | Headless Stitch CLI / MCP skill for automated UI/UX design and rendering. Orchestrates responsive layouts across all breakpoints (mobile, tablet, desktop, large screens) with zero-overlap navigation and atomic design exports. |
| [`task-decomposition/`](task-decomposition/) | Break down complex tasks into atomic, actionable goals with clear dependencies and success criteria. Use when planning multi-step projects, coordinating agents, or decomposing complex requests. |
| [`test-runner/`](test-runner/) | Execute tests, analyze results, and diagnose failures across any testing framework. Use when running test suites, debugging failing tests, or configuring CI/CD testing pipelines. |
| [`testdata-builders/`](testdata-builders/) | Maintain deterministic builders/factories for test entities. Activate when authoring tests, extending test utilities, or adding schema fields that affect fixtures. |
| [`testing-strategy/`](testing-strategy/) | Design comprehensive testing strategies with modern techniques. Use for test planning, property-based testing, visual regression, load testing, mutation testing, and E2E test generation. Includes coverage analysis, test maintenance strategies, and CI/CD integration. |
| [`triz-analysis/`](triz-analysis/) | Run a systematic TRIZ contradiction audit against a codebase, architecture, or workflow to identify hidden trade-offs and innovation opportunities. |
| [`triz-solver/`](triz-solver/) | Systematic problem-solving using TRIZ (Theory of Inventive Problem Solving) principles adapted for software engineering. Use when stuck on complex problems, facing technical contradictions, optimizing system design, or seeking innovative solutions beyond trial-and-error. Prevents solving the wrong problem correctly. |
| [`turso-db/`](turso-db/) | Use this skill for Turso (LibSQL/Limbo) database development, including scaffolding, querying, migrations, and maintenance. Supports vector search, full-text search, CDC, MVCC, encryption, and bidirectional remote sync. Use when working with Turso SDKs for JavaScript, Rust, Python, Go, and React Native. Provides current API guidance to avoid stale "libsql" legacy knowledge. |
| [`ui-ux-optimize/`](ui-ux-optimize/) | Swarm-powered UI/UX prompt optimizer with auto-research agents, handoff coordination, confidence-scored autoresearch loops, and backpressure quality gates. Use for web apps, mobile apps, games, dashboards, SaaS, e-commerce, kiosks, and any screen-based product. |
| [`validation-checklist/`](validation-checklist/) | Maintain high data quality and schema adherence within the knowledge studio. |
| [`web-search-researcher/`](web-search-researcher/) | Research topics using web search to find accurate, current information. Use when you need modern information, official documentation, best practices, or technical solutions beyond training data. |
