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
- Escape JSX text content — use `&apos;` for apostrophes, `&quot;` for quotes in JSX text nodes. Do not rely on raw punctuation in JSX strings.
- All `catch` blocks must handle errors meaningfully — log, toast, or rethrow. Never use empty `catch {}` blocks.
- Use `try/catch` with `finally` for resource cleanup (AbortController, timers, subscriptions, file handles).
- Clean up side effects in `useEffect` return functions — abort fetches, clear timers, remove listeners.
- Use `AbortController` for all `fetch` calls to prevent stale responses and memory leaks.
- Prefer `const` assertions and `satisfies` over type assertions for type narrowing.
- Use `React.memo` for pure components that receive stable props to prevent unnecessary re-renders.
- Use `useCallback` for event handlers passed to child components, `useMemo` for expensive computations.
- Never hardcode user-facing strings — extract to constants or i18n-ready string maps for future localization.
- Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.RelativeTimeFormat` for locale-sensitive formatting.
- Validate all external input at boundaries (API responses, user input, localStorage rehydration) with Zod schemas.
- Never log secrets, API keys, or sensitive data. Use `console.error` for errors, not `console.log` in production.
- Prefer `structuredClone` over JSON parse/stringify for deep copies.
- Use `crypto.randomUUID()` for generating IDs, not `Math.random()`.
- Prefer native `AbortController` over custom cancellation patterns.
- Use `queueMicrotask` or `requestAnimationFrame` for batching DOM updates, not `setTimeout(fn, 0)`.
- Prefer `Intl.Segmenter` over manual string splitting for i18n-safe text processing.
- **Always use named exports.** Never use `export default`. Named exports enable better tree-shaking, safer refactoring (find-all-references works), and consistent import style across the codebase. **Exception**: Next.js App Router files (`src/app/page.tsx`, `src/app/layout.tsx`) require `export default` by framework convention — this is the only acceptable case.
- **Never ignore pre-existing issues or warnings.** Every warning, lint error, or failing check must be fixed or documented as a follow-up task in `plans/`. Ignoring issues compounds technical debt and erodes trust in the pipeline.
- **Treat warnings as errors in quality gates.** When running `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, or `pnpm run build`, any output containing `⚠`, `warning`, `Warning`, or non-zero exit code must be addressed immediately — do not proceed to the next task until the warning is fixed or explicitly documented as a follow-up. Build warnings (e.g., deprecation notices, lockfile conflicts) are not informational — they are defects.
- **Always run code review before merge.** After CI passes and before requesting merge, invoke the `code-review-assistant` skill to perform a structured review of all changed files. Address all P1/P2 findings. No PR merges without a completed review pass.

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

Required after CI passes, before merge:

```bash
# Invoke code-review-assistant skill on the PR
# Review all changed files for AGENTS.md compliance, security, a11y, performance
# Address all P1/P2 findings before requesting merge
```

Useful fast path:

```bash
./scripts/minimal_quality_gate.sh
```

Useful validation helpers:

```bash
./scripts/validate-package-manager.sh
./scripts/validate-git-hooks.sh
./scripts/verify-deps.sh
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
- Accent color: Saffron (`#c77d3a` light, `#e5944a` dark).
- Font: Geist Sans (body) + Newsreader (serif headings).
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

After CI passes on a PR, always run a code review before merge:

```bash
# Invoke code-review-assistant skill on the PR
# Review must cover: AGENTS.md compliance, security, a11y, performance, test coverage
# Address all P1/P2 findings before merge
```

If hooks are needed locally:

```bash
./scripts/install-hooks.sh
./scripts/validate-git-hooks.sh
```

Do not finish with failing lint, typecheck, tests, build, or quality gate output.

## Deployment (Vercel)

**Critical**: This project uses Vercel for production deployment. Breaking the build breaks the live site.

### Requirements

- **Node.js ≥ 20** — enforced via `package.json` `engines.node` and `.nvmrc`
- **pnpm** — Vercel uses `packageManager` field to install correct version
- **Build must pass** — `pnpm run build` runs on every push to `main`

### Configuration Files

| File | Purpose | Do NOT delete |
|------|---------|---------------|
| `package.json` | `engines.node >= 20` tells Vercel which Node version | `engines` field |
| `vercel.json` | Explicit build/install commands for Vercel | entire file |
| `.nvmrc` | Node version for local dev and CI | entire file |

### Preventing Deployment Failures

1. **Always run `pnpm run build` locally** before pushing to `main`
2. **Never remove `engines` field** from `package.json` — Vercel needs it
3. **Never remove `vercel.json`** — Vercel needs explicit build config
4. **Never change `build` script** without verifying `vercel.json` matches
5. **If adding new deps**, run `pnpm install` to update `pnpm-lock.yaml`
6. **If upgrading Next.js**, check Node.js version requirements

### Diagnosing Vercel Failures

```bash
# Check Vercel deployment status
gh pr checks <PR#> | grep -i vercel

# Check production deployment
gh api repos/d-oit/do-knowledge-studio/deployments --jq '.[] | select(.environment == "Production")'

# Verify build passes locally
pnpm run build
```

### Common Vercel Failure Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Node.js version too old | Build fails with syntax errors | Ensure `engines.node >= 20` in package.json |
| Missing `vercel.json` | Vercel uses wrong build command | Add vercel.json with explicit config |
| `pnpm-lock.yaml` out of date | Install fails | Run `pnpm install` and commit lockfile |
| TypeScript errors | Build fails | Run `pnpm run typecheck` before pushing |
| Missing dependencies | Import errors | Run `pnpm install` and commit changes |
| Major dependency bump (breaking API) | Type errors in build only | Run `./scripts/verify-deps.sh` after any dependabot merge |
| TypeScript major bump (deprecations) | TSconfig option deprecated | Add `"ignoreDeprecations": "6.0"` to tsconfig.base.json |

### Dependency Upgrade Rules

When merging dependabot PRs or manually bumping dependencies:

1. **Always run `./scripts/verify-deps.sh`** after any dependency version change.
2. **Major version bumps** (semver X.0.0) require checking the changelog for breaking API changes — do not auto-merge.
3. **TypeScript major bumps** may deprecate tsconfig options — check `pnpm run typecheck` output for deprecation warnings treated as errors.
4. **UI library major bumps** (shadcn primitives, react-resizable-panels, radix) may rename exports — check `pnpm run build` for type errors.
5. **After merging any dependabot PR**, immediately run the full quality workflow including `pnpm run build` and push a fix if needed.

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
| `impeccable` | Design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize frontend interfaces. Covers UX review, visual hierarchy, typography, spacing, layout, color, motion, responsive behavior, theming, and anti-patterns.
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
