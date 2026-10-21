# Harness Engineering

> Reference doc - not loaded by default. Link from AGENTS.md or a skill as needed.

`coding agent = AI model(s) + harness`

The harness is everything around the model: AGENTS.md, MCP servers, skills, sub-agents,
hooks, and back-pressure mechanisms. Harness engineering is the practice of tuning these
surfaces to improve output quality and reliability.

## Core Principle: Iterate on Failure

Do not design the ideal harness upfront. Add configuration **only when the agent actually
fails**. When a failure occurs, engineer a solution so it cannot happen the same way again.
Throw away what does not help - more config is not always better.

## AGENTS.md Guidelines

- Keep within `MAX_LINES_AGENTS_MD` (currently 250, enforced by `scripts/agent-surface.py validate`; see `.agents/config.sh`); human-written (never auto-generated - LLM-generated files hurt quality)
- Concise and universally applicable - every instruction costs tokens
- Use progressive disclosure: detailed docs in `agents-docs/`, not the root file

## Skills (Single Canonical Source)

All skills live in `.agents/skills/`. Claude Code, Gemini CLI, and Qwen Code use symlinks
(`.claude/skills/`, `.gemini/skills/`) created by `./scripts/setup-skills.sh`.
OpenCode reads skills directly from `.agents/skills/` - no symlinks needed.
See `agents-docs/AVAILABLE_SKILLS.md`.

## Local Verification Harness (`do-harness.toml`)

The repository uses `do-harness.toml` (`language = "generic"`) as a single local sensor map that maps path changes to fast, canonical verification commands. This allows agents and developers to select relevant local checks and escalate to browser or production build checks only when affected files warrant it.

### Canonical Sensor Map

| Sensor | Purpose | Triggering Paths | Canonical Command |
|--------|---------|------------------|-------------------|
| `feedback` | Fast lint and typecheck for UI/component changes | `src/**`, `public/**`, `e2e/**`, `package.json` | `pnpm run lint && pnpm run typecheck` |
| `verification` | Full unit test suite, test typecheck, and skill validation | `src/**`, `tests/**`, `scripts/**`, `.agents/**`, `AGENTS.md`, `.github/**`, `package.json`, `pnpm-lock.yaml`, `tsconfig*.json` | `pnpm run typecheck:test && pnpm run test && ./scripts/validate-skills.sh` |
| `offline` | Production build and Playwright offline E2E suite | `public/sw.js`, `public/precache-manifest.json`, `scripts/generate-precache-manifest.mjs`, `src/app/layout.tsx`, `src/components/studio/app-shell.tsx`, `src/components/studio/offline-indicator.tsx`, `src/components/studio/service-worker-registration.tsx`, `e2e/offline-views.spec.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml` | `pnpm run build && pnpm run test:e2e:offline` |
| `schema/data` | Schema, migration, hydration, store, and sync tests | `src/lib/studio/schema.ts`, `src/lib/studio/migrations.ts`, `src/lib/studio/hydration*.ts`, `src/lib/studio/store.ts`, `src/lib/studio/slices/**`, `src/lib/studio/seed-*.ts`, `src/lib/sync/**`, `src/lib/okf/**` | `pnpm test src/lib/studio/schema.test.ts src/lib/studio/migrations.test.ts src/lib/studio/hydration.test.ts src/lib/studio/store.test.ts src/lib/sync/` |
| `release` | Full build and release preflight verification | `package.json`, `pnpm-lock.yaml`, `src/**`, `public/**`, `scripts/**`, `.github/**`, `VERSION`, `AGENTS.md` | `pnpm run build && ./scripts/verify.sh` |

### Design & Escalation Rationale

- **Fast Feedback vs. Heavy Suites:** Ordinary UI component edits run fast linting and typechecking via `feedback` without triggering expensive production builds or browser E2E suites.
- **CI Parity:** The `offline` path list matches `.github/workflows/ci-and-labels.yml`'s `offline` path filter exactly, preserving the CI rationale of keeping production offline tests separate from daily UI edits.
- **Schema & Data Protection:** Schema, persistence, store, migration, or sync edits run targeted Vitest suites (`schema/data`) rather than relying solely on TypeScript compile checks.
- **Independence:** GitHub Actions workflows remain the authoritative merge gate on `main`. `do-harness.toml` provides local sensor mapping for agents and developers.

## MCP Servers

- Only connect servers you actively use and trust
- Tool descriptions inject into the system prompt - each one consumes instruction budget
- Prefer well-known CLIs (GitHub, Docker, databases) over MCP
- Write thin CLI wrappers with concise output rather than verbose MCP responses
- Never connect to untrusted MCP servers - they are a prompt injection vector

## Supported AI Agents

| Agent | Skills Location | Sub-agents |
|-------|-----------------|------------|
| Claude Code | `.claude/skills/` (symlinks) | `.claude/agents/` |
| Gemini CLI | `.gemini/skills/` (symlinks) | - |
| OpenCode | `.agents/skills/` (direct) | `.opencode/agents/` |
| Qwen Code | `.qwen/skills/` (symlinks) | - |
| Cursor | `.cursor/skills/` (symlink) | - |
| Windsurf | `.windsurf/skills/` (symlink) | - |
| Jules | managed via manifest (`symlink_strategy: none`) | - |

> Machine-readable source of truth: `.agents/manifest.json` — update both when adding a tool.

## Further Reading

| Topic | File |
|---|---|
| Delivery lifecycle | `agents-docs/DELIVERY-LIFECYCLE.md` |
| Skills | `agents-docs/AVAILABLE_SKILLS.md` |
| Sub-Agents | `agents-docs/SUB-AGENTS.md` |
| Hooks | `agents-docs/HOOKS.md` |
| Back-Pressure | `agents-docs/CONTEXT.md` |
