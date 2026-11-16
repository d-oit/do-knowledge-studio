# Available Skills Reference

> Auto-generated from skill definitions in `.agents/skills/`.
> Run `./scripts/generate-skills-docs.py` to regenerate.

## Analysis

| Skill | Description |
|-------|-------------|

## General

| Skill | Description |
|-------|-------------|
| `accessibility-auditor` | Audit WCAG 2.2 compliance: screen readers, keyboard navigation, color contrast. Trigger on 'a11y check', 'WCAG compliance', 'ARIA validation'. |
| `agent-coordination` | Coordinate multiple agents: parallel independent tasks, sequential chains, swarm analysis, iterative refinement across languages. |
| `agents-md` | Create AGENTS.md files with production-ready best practices. Use when creating new AGENTS.md or implementing quality gates. |
| `anti-ai-slop` | Audit or create UI, UX, and copy that avoids the generic AI-slop aesthetic. Use for design reviews, UX writing, or distinctive human-feeling interfaces. |
| `api-design-first` | Design and document RESTful APIs with OpenAPI: endpoint planning, request/response modeling, versioning. Trigger on 'design an API', 'OpenAPI', 'Swagger'. |
| `architecture-diagram` | Generate or refresh the project architecture SVG from live structure. Trigger on 'update the diagram', 'regenerate the architecture SVG', 'diagram is out of date'. |
| `atomic-commit` | Sub-procedure of github-workflow for code submission: validate, commit, push, create PR, verify CI with zero-warnings policy and rollback. |
| `cicd-pipeline` | Design and implement CI/CD pipelines with GitHub Actions, GitLab CI, and Forgejo Actions. Use for automated testing, deployment strategies (blue-green, canary), security scanning, and multi-environment workflows. Includes pipeline optimization, secrets management, and failure handling patterns. |
| `code-quality` | General code cleanup reference (refactoring, smells, maintainability). For PR review with adversarial probing, use code-review-assistant. |
| `code-review-assistant` | Entry skill for PR review: diff analysis, change summaries, adversarial probing for swallowed exceptions, unguarded indexes, evicted shared resources. |
| `deepsource` | Read DeepSource review results: issues, vulnerabilities, report cards, CVEs, coverage, analysis runs. |
| `do-web-doc-resolver` | Resolve URLs and queries into compact LLM-ready markdown: progressive free-first cascade, quality scoring, trace evaluation. Use for docs fetching and web-source context. |
| `docs-hook` | Lightweight git hook integration for updating agents-docs with minimal tokens. Triggered on commit/merge events to sync documentation. |
| `git-github-workflow` | Retired alias of github-workflow. Use github-workflow for the full commit to PR to CI to merge flow. |
| `github-readme` | Create human-focused GitHub README.md files with 2026 best practices. Use when creating new projects, improving documentation, adding quick start guides, writing contribution guidelines, or making repositories more discoverable and user-friendly. |
| `github-workflow` | Entry skill for commit to PR to CI to merge: push, PR, Actions monitoring, auto-merge. Merge rules live in agents-docs/GIT-WORKFLOW.md. |
| `goap-planning` | Entry point for planning multi-step work and coordinating agents: decomposition, dependency mapping, parallel/sequential/swarm execution with quality gates. |
| `impeccable` | Design, critique, and polish frontend interfaces: UX review, visual hierarchy, accessibility, responsive behavior, theming, motion, UX copy. Not for backend-only tasks. |
| `intent-classifier` | Classify user intents and route to skills, commands, or workflows. Trigger on 'which skill should I use', 'route this to', 'classify this request', 'skill selection'. |
| `iterative-refinement` | Execute iterative refinement workflows with validation loops until quality criteria are met. Use for test-fix cycles, code quality improvement, performance optimization, or any task requiring repeated action-validate-improve cycles. |
| `local-chat-policy` | Enforce the local-first chat contract — in-browser corpus retrieval, entity citations, untrusted-content isolation, consent before any remote call. Trigger when changing chat, retrieval wiring, provider selection, or anything that moves corpus text. |
| `memory-context` | Retrieve semantically relevant past learnings and analysis outputs using the csm CLI (HDC encoder with hybrid BM25 retrieval) |
| `migration-refactoring` | Automate code migrations and refactorings with safety patterns: dependency upgrades, framework moves, breaking-change analysis, rollback strategies. |
| `parallel-execution` | Reference for dependency-free fan-out under goap-planning: run independent tasks simultaneously and aggregate results. |
| `privacy-first` | Keep emails and personal data out of the codebase. Use for privacy checks when writing code, config, or docs. |
| `security-code-auditor` | Audit code for vulnerabilities and misconfigurations. Trigger on 'security review', 'vulnerability scan', 'OWASP', 'penetration test', 'security assessment'. |
| `self-fix-loop` | Sub-procedure of github-workflow for CI repair: monitor runs, auto-fix failures with skills on demand, loop until green. |
| `shell-script-quality` | Lint and test shell scripts using ShellCheck and BATS. Use when checking bash/sh scripts for errors, writing shell script tests, fixing ShellCheck warnings, setting up CI/CD for shell scripts, or improving bash code quality. |
| `skill-creator` | Create, edit, and benchmark skills: new skills from scratch, evals, performance variance analysis, description optimization. |
| `skill-evaluator` | Reusable skill for evaluating other skills with structure checks, eval coverage review, and real usage spot checks. Use when you need to check a skill, add evals, benchmark a skill, validate outputs against assertions, or compare current skill behavior against a baseline. |
| `task-decomposition` | Retired alias of goap-planning. Use goap-planning to decompose goals and coordinate agents. |
| `test-runner` | Execute tests, analyze results, and diagnose failures across any testing framework. Use when running test suites, debugging failing tests, or configuring CI/CD testing pipelines. |
| `testing-strategy` | Design comprehensive testing strategies with modern techniques. Use for test planning, property-based testing, visual regression, load testing, mutation testing, and E2E test generation. Includes coverage analysis, test maintenance strategies, and CI/CD integration. |
| `triz-analysis` | Retired alias of triz-solver audit mode. Use triz-solver for contradiction audits and inventive solving. |
| `ui-ux-optimize` | Optimize UI/UX prompts with auto-research agents, handoff coordination, and quality gates for screen products. |
| `validation-checklist` | Validate data at this app's real boundaries — storage rehydration, file import, sync payloads, AI responses, MCP input — with Zod and referential integrity. Trigger when adding a persisted field, migration, import/export format, sync message, or parsing external JSON. |
| `vercel-deployment` | Diagnose Vercel deployment failures: red previews/production, plan-limit errors (api-deployments-free-per-day), vercel.json or build-command changes. |
| `web-search-researcher` | Research topics using web search to find accurate, current information. Use when you need modern information, official documentation, best practices, or technical solutions beyond training data. |

## Innovation Problem Solving

| Skill | Description |
|-------|-------------|
| `triz-solver` | Solve hard problems with TRIZ inventive principles: audit mode finds the contradiction, solve mode resolves it. Use when stuck or facing design trade-offs. |

## Knowledge Management

| Skill | Description |
|-------|-------------|
| `learn` | Extract non-obvious session learnings into scoped AGENTS.md files |

## Quality

| Skill | Description |
|-------|-------------|
| `codacy` | Tool reference under static-analysis-suppression: query Codacy PR analysis, triage issues, suppress false positives, run local analysis. |
| `dogfood` | Exploratory QA of a web app with full reproduction evidence. Trigger on 'dogfood', 'bug hunt', 'exploratory test', 'find issues', app quality review. |
| `static-analysis-suppression` | Suppress false-positive or pre-existing static-analysis findings blocking a PR: Codacy, DeepSource, ESLint. |
| `testdata-builders` | Maintain deterministic builders and factories for test entities, fixtures, and schema-driven test data. |

## Workflow

| Skill | Description |
|-------|-------------|
| `agent-browser` | Drive websites via CLI: navigate, fill forms, click, screenshot, scrape, test web apps. Trigger on 'open a website', 'take a screenshot', 'scrape data', 'test this app'. |
| `document-rendering-and-locators` | Implement resilient document rendering and annotation anchoring: TOC, locators, highlight anchoring for EPUB/PDF. |
| `persistence-data-safety` | Verify storage, hydration, migration and sync changes against a real corpus in a real browser: shadow fingerprints, quarantine, cross-tab, undo/redo and export round trip. |
| `pwa-offline-sync` | Design Cache Storage plus IndexedDB strategy and sync queue for offline-first apps and service-worker bugs. |
| `reader-ui-ux` | Build localized accessible reader/admin UI: responsive layouts, telemetry, state management for React screens. |
| `secure-invite-and-access` | Implement access control, authentication, and authorization: auth endpoints, sessions, signed URLs. |
| `verify-before-asserting` | Verify before claiming, fixing, or shipping: reproduce first, watch the test fail, then fix. Trigger on 'the bug is', 'just fixed', 'false positive', module changes. |

## Usage

Skills are triggered automatically based on context or loaded explicitly.
See `agents-docs/AVAILABLE_SKILLS.md` for loading skills manually.

## See Also

- `agents-docs/AVAILABLE_SKILLS.md` - Skill authoring guide
- `.agents/skills/skill-rules.json` - Skill validation rules
