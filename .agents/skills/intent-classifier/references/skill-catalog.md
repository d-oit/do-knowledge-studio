# Skill Catalog

> Auto-generated from `.agents/skills/` directory.
> Last updated: 2024-04-03

## Available Skills

| Skill | Description | Key Triggers |
|-------|-------------|--------------|
| agent-coordination | Coordinate multiple agents for software development across any language. Use for parallel execution of independent tasks, sequential chains with dependencies, swarm analysis from multiple perspectives, or iterative refinement loops. | parallel, sequential, agents, coordinate, swarm |
| anti-ai-slop | Apply this skill whenever the user wants to audit, fix, redesign, write, or review UI, UX, copy, or text to avoid the generic "AI slop" aesthetic. Triggers include: make this feel less AI, this looks too generic, avoid AI clichés, audit my copy, humanize this. | UI, UX, copy, design, humanize, anti-design |
| api-design-first | Design and document RESTful APIs using design-first principles with OpenAPI specifications. Use when users ask to design an API, create API spec, REST API, OpenAPI, Swagger, or API documentation. | REST, API, OpenAPI, Swagger, endpoints, spec |
| architecture-diagram | Generate or update a project architecture SVG diagram by scanning the live project structure. Use when users ask to regenerate, refresh, or update the architecture diagram. | architecture, diagram, SVG, regenerate |
| codeberg-api | Interact with Forgejo/Codeberg repositories via the REST API. Use when users want to read files, manage issues, create pull requests, or automate workflows on Codeberg. | Codeberg, Forgejo, git, API, PR, issues |
| docs-hook | Lightweight git hook integration for updating agents-docs with minimal tokens. Triggered on commit/merge events to sync documentation. | git hook, documentation, sync, commit |
| github-readme | Create human-focused GitHub README.md files with 2026 best practices. Use when creating new projects, improving documentation, adding quick start guides, writing contribution guidelines. | README, GitHub, documentation, quick start |
| goap-agent | Invoke for complex multi-step tasks requiring intelligent planning and multi-agent coordination. Use when tasks need decomposition, dependency mapping, or coordination of multiple specialized agents. | complex, multi-step, plan, coordinate, GOAP |
| intent-classifier | Classify user intents and route to appropriate skills, commands, or workflows. Use when determining which skill to invoke, routing requests, or building skill selection logic. | classify, route, which skill, intent |
| iterative-refinement | Execute iterative refinement workflows with validation loops until quality criteria are met. Use for test-fix cycles, code quality improvement, performance optimization. | iterative, refine, loop, test-fix, optimize |
| parallel-execution | Execute multiple independent tasks simultaneously using parallel agent coordination to maximize throughput. Use when tasks have no dependencies and agents are available. | parallel, execute, simultaneous, independent |
| privacy-first | Prevent email addresses and personal data from entering the codebase. Use when user asks to prevent emails, remove personal data, privacy check, or when writing code. | privacy, email, personal data, PII |
| security-code-auditor | Perform security audits on code to identify vulnerabilities. Use when users ask to audit, review, or check security of code. Triggers: security review, vulnerability scan, OWASP. | security, audit, OWASP, vulnerability, review |
| shell-script-quality | Lint and test shell scripts using ShellCheck and BATS. Use when checking bash/sh scripts for errors, writing shell script tests, fixing ShellCheck warnings. | shell, bash, script, ShellCheck, BATS, lint |
| skill-creator | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill. | skill, create, evals, benchmark |
| skill-evaluator | Reusable skill for evaluating other skills with structure checks, eval coverage review, and real usage spot checks. Use when you need to check a skill, add evals, benchmark. | eval, skill, benchmark, validate |
| task-decomposition | Break down complex tasks into atomic, actionable goals with clear dependencies. Use when planning multi-step projects, coordinating agents, or decomposing requests. | decompose, break down, tasks, goals, plan |
| triz-solver | Systematic problem-solving using TRIZ principles adapted for software engineering. Use when stuck on complex problems, facing technical contradictions, or seeking innovative solutions. | TRIZ, problem-solving, contradiction, innovate |
| ui-ux-optimize | Swarm-powered UI/UX prompt optimizer with auto-research agents. Use for web apps, mobile apps, games, dashboards, SaaS, or any screen-based product. | UI, UX, optimize, web app, mobile, design |
| web-search-researcher | Research topics using web search to find accurate, current information. Use when you need modern information, official documentation, best practices. | research, web search, documentation, current |

## Skill Categories

### Development
- agent-coordination
- goap-agent
- parallel-execution
- task-decomposition

### Code Quality
- security-code-auditor
- shell-script-quality
- iterative-refinement

### Documentation
- github-readme
- docs-hook
- api-design-first

### Skills Engineering
- skill-creator
- skill-evaluator
- intent-classifier

### Design/UX
- anti-ai-slop
- ui-ux-optimize
- architecture-diagram

### External Services
- codeberg-api
- web-search-researcher

### Specialized
- privacy-first
- triz-solver

## Update Catalog

To regenerate this catalog:
```bash
./scripts/dynamic-catalog.sh
```
