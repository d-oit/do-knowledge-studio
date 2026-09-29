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
- Max 500 LOC per source file; refactor before extending oversized files. Exception: shadcn-generated primitives (e.g., `sidebar.tsx`) may exceed this limit — document the exception in `plans/` rather than splitting vendor scaffolding.
- Prefer small, composable modules over mixed-responsibility files.
- Reuse existing abstractions before introducing new patterns.
- Keep changes scoped; avoid unrelated refactors in the same commit.
- **Never create a GitHub release without explicit human instruction.** Releases are coordinated manually by the maintainer — the `version-propagation.yml` workflow was retired in Plan 073. Do NOT run `gh release create` unless the user explicitly asks you to cut a release. You may prepare draft release notes in `plans/` on request, but never publish a release autonomously.
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
- **Prefer `const fn = () => {}` over `function fn() {}` for module-scope helper functions (especially in test files).** DeepSource's JS-0067 rule flags top-level `function` declarations as "global scope" (a false positive for ES modules, but it fails the check). Arrow-function expressions avoid this. This applies to test helpers (`makeEntity`, `resetStore`, etc.) and non-exported internal helpers in `src/`. The `.deepsource.toml` `issue_patterns` suppression for JS-0067 is a belt-and-suspenders fallback, not the primary fix.
- **Never ignore pre-existing issues or warnings.** Every warning, lint error, or failing check must be fixed or documented as a follow-up task in `plans/`. Ignoring issues compounds technical debt and erodes trust in the pipeline.
- **Treat warnings as errors in quality gates.** When running `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, or `pnpm run build`, any output containing `⚠`, `warning`, `Warning`, or non-zero exit code must be addressed immediately — do not proceed to the next task until the warning is fixed or explicitly documented as a follow-up. Build warnings (e.g., deprecation notices, lockfile conflicts) are not informational — they are defects.
- **Always run code review before merge.** After CI passes and before requesting merge, invoke the `code-review-assistant` skill to perform a structured review of all changed files. Address all P1/P2 findings. No PR merges without a completed review pass.
- **Never merge with Codacy issues.** If Codacy reports `ACTION_REQUIRED`, `FAILED`, or any new issues on a PR, the PR must not be merged until all issues are resolved or explicitly suppressed with a documented reason. Zero tolerance: no warnings, no failures, no "action required" status.

When Codacy reports new issues on a PR, invoke the `codacy` skill to query findings via `codacy pull-request ... --output json`, identify whether each is a true or false positive using `toolInfo.name` and `resultDataId`, and suppress false positives with `--ignore-issue`. Do not guess the analysis engine from suppression comment syntax — read `toolInfo.name` from the API.

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

```bash
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
```

- Fast loop: `./scripts/minimal_quality_gate.sh` (lint + typecheck + test).
- Also run `pnpm run test:e2e` for UI, editor, graph, mind map, search, export,
  or any critical workflow change — a unit test proves the function, not the app.
- Before commit: `./scripts/quality_gate.sh`. After CI passes, before merge:
  the `code-review-assistant` skill, addressing all P1/P2 findings.
- CI repair: `./scripts/self-fix-loop.sh`.

Warnings are errors — a deprecation notice or lockfile conflict is a defect,
not progress. Full script catalog: `agents-docs/SCRIPTS.md`.

## Delivery Lifecycle

A change is not done when it builds — it is done when it survives production.

```text
production → failure → reproduce → candidate fix → evaluate
           → adversarial → shadow → canary → promote | rollback
```

| Stage | Exit criterion | Tooling |
|-------|----------------|---------|
| Reproduce | A test fails for the *stated* reason before any fix | `pnpm test` red |
| Candidate fix | Green; diff scoped to the defect | `git diff` review |
| Evaluate | lint + typecheck + test + build clean, zero warnings | `scripts/verify.sh` |
| Adversarial | Someone tried to break it and failed | `code-review-assistant` |
| Shadow | New path runs beside the old, emits, changes nothing | flag + recorded comparison |
| Canary | Narrow slice, real browser, one-command undo | Vercel PR preview |
| Promote | 100% rollout, then delete the flag | `gh pr merge --auto --squash` |
| Rollback | Flag off ⇒ old behavior returns immediately | flip and revert |

**Never fix a bug you cannot make fail on demand.** Failure is the input, not
the exception — a production incident is the highest-quality task this repo
receives.

Pick depth by blast radius, not all nine stages every time:

| Change | Minimum path |
|--------|-------------|
| Docs, comments, dead code | evaluate |
| Bug fix with a reproducing test | reproduce → evaluate → adversarial |
| New component / view | evaluate → adversarial → canary |
| Persistence, hydration, undo/redo, sync | evaluate → adversarial → shadow → canary |
| Schema migration, deps, anything touching the store | full loop from production |

**Data-loss bugs start at production.** Never ship a persistence change that
was not driven against a real corpus in a real browser.

This repo is local-first with **no** feature-flag library, **no** error
telemetry, and a single global Vercel deployment. A flag is a store field or
`localStorage` read, default-off. Shadow means both paths reachable, compared
on the same input, result recorded in `plans/` — skip the stage for a pure
refactor rather than faking one. Never introduce machinery that needs a server
to work offline.

Stage mechanics, harness guardrails, and the per-stage skill map:
`agents-docs/DELIVERY-LIFECYCLE.md`.

## Testing Expectations

- Use Vitest for unit and integration coverage.
- Keep critical flows covered: entity CRUD, claim creation, local search/chat flows, graph interaction, and mind map editing.
- When touching database, validation, NLP/search, queueing, or export behavior, add or update tests close to the changed logic.
- Run `pnpm run test:coverage` for core data-model, search, export, or infrastructure changes.

## UI / UX Guardrails

- Use design tokens from `src/app/globals.css` `@theme` block (source of truth).
- Two themes: `light` and `dark` via `data-theme` attribute.
- Accent color: Saffron (`#9a5c2a` light, `#e5944a` dark).
- Font: Geist Sans (body) + Newsreader (serif headings).
- Build mobile-first.
- Keep interactive targets at least 44x44px.
- Preserve responsive behavior across editor, graph, search, and mind map views.
- Never hardcode hex values in components — use tokens.

## Git Workflow

- Branch from up to date, never commit to `main`, use conventional commits.
- Code review (`code-review-assistant`) is mandatory after CI passes; address
  all P1/P2 findings before requesting merge.
- `Codacy Static Code Analysis` is the only ruleset-required check on `main` and
  has a zero-tolerance rule. A **missing** check is a transient delay, not a
  defect — diagnose via `commits/{sha}/check-runs`, then nudge with an
  empty-commit push. Never merge with it failing.
- Unresolved review threads block merges, **including outdated ones**. Resolve
  every thread via GraphQL `resolveReviewThread`.
- `required_linear_history` is set: always `--squash`, never a merge commit.
- Never use `gh pr merge --admin` without explicit human approval.
- `BLOCKED` with all-green `gh pr checks` is usually staleness, not a real
  failure — `pr-merge-state-diagnoser.yml` automates that diagnosis.

Full procedure, staleness ladder, and the Codacy false-positive playbook:
`agents-docs/GIT-WORKFLOW.md`. Lessons: `agents-docs/LESSONS.md`.

## Learnings (session-distilled)

Non-obvious toolchain facts. Full catalog with debugging detail:
`agents-docs/LESSONS.md` (LESSON-001..041) and `lessons.jsonl`.

- **gitleaks-action v3+ needs a paid `GITLEAKS_LICENSE`** — pin v2.x; a failing
  license gate masks real scan results. yamllint enforces `line-length` (120)
  and `new-line-at-end-of-file` inside `run: |` blocks.
- **DeepSource suppressions in `.deepsource.toml` do not reliably prevent check
  failures** — use `const fn = () => {}` (never `function`) for module-scope
  helpers; keep exported-function complexity under 6.
- **Codacy and DeepSource re-post stale positional findings as NEW unresolved
  threads on every push** (observed 4× on PR #758), and
  `required_review_thread_resolution` turns each re-post into a merge blocker.
  Fix the working tree, reply with evidence, resolve the thread, then STOP
  pushing until CI demands it. Long-term fix: check-summary-only reporting
  (LESSON-034).
- **Vitest typecheck is experimental** and `ignoreSourceErrors: true`, so a
  green result does not cover `*.test.ts` source errors (LESSON-035).
- **Verify before asserting — load the `verify-before-asserting` skill.** Trust
  live code over plans, docs, or memory; grep for a helper before adding one
  (LESSON-040); and **a test you have not seen fail is not evidence** — re-inject
  the defect, watch it fail, restore it (LESSON-041). `quality_gate.sh` runs E2E
  when wiring or state ownership changes: 2759 unit tests once passed while the
  app's first load was broken.

## Skills

Canonical skills live in `.agents/skills/`; refresh symlinks with
`./scripts/setup-skills.sh`. **Load only what the stage needs** — every
always-loaded skill is a tax. Prefer existing skills and `agents-docs/` guidance
over inventing a workflow, and add a skill only after a real failure
(`agents-docs/HARNESS.md`).

Catalog: `agents-docs/AVAILABLE_SKILLS.md` (regenerate with
`./scripts/generate-skills-docs.py`). Per-stage map:
`agents-docs/DELIVERY-LIFECYCLE.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
