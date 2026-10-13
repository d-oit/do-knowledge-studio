# Scripts Reference

> All scripts in `scripts/` with their purpose, usage, and dependencies.
> Keep this file updated when adding or removing scripts.

## Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `quality_gate.sh` | Full repository gate: validation, lint, typecheck, tests, conditional E2E | `./scripts/quality_gate.sh` |
| `minimal_quality_gate.sh` | Minimal quality gate — lint, typecheck, tests (no build) | `./scripts/minimal_quality_gate.sh` |
| `verify.sh` | Shell/YAML lint, BATS (when installed), frontend lint/typecheck/tests, and production build | `./scripts/verify.sh` |
| `verify-deps.sh` | Verify dependency changes don't break the build | `./scripts/verify-deps.sh` |
| `setup-skills.sh` | Create manifest-managed skill links and regenerate skill catalogs | `./scripts/setup-skills.sh` |
| `install-hooks.sh` | Install git hooks (pre-commit + commit-msg) | `./scripts/install-hooks.sh` |
| `propagate-version.sh` | Sync `VERSION` to derived version strings in docs | `./scripts/propagate-version.sh` |

`quality_gate.sh` accepts `--scope <scope>`, `--fast`, and `--changed`.
`--fast` skips test runners; `--scope` selects a gate scope; `--changed` derives
the scope from changed paths and requires a resolvable base ref.

## Validation Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `validate-skills.sh` | Validate skill symlinks and SKILL.md files | `./scripts/validate-skills.sh` |
| `validate-git-hooks.sh` | Check git hooks configuration | `./scripts/validate-git-hooks.sh` |
| `validate-links.sh` | Validate links and reference formatting in `SKILL.md` files | `./scripts/validate-links.sh` |
| `validate-package-manager.sh` | Validate the correct package manager (pnpm) is used | `./scripts/validate-package-manager.sh` |
| `validate-github-actions-shas.sh` | Validate GitHub Actions are pinned to full commit SHAs | `./scripts/validate-github-actions-shas.sh` |

## Automation Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `self-fix-loop.sh` | Auto-fix CI failures in a loop | `./scripts/self-fix-loop.sh` |
| `diagnose-merge-state.sh` | Diagnose a BLOCKED pull request merge state | `./scripts/diagnose-merge-state.sh` |
| `docs-sync.sh` | Check documentation directories and report the skill count | `./scripts/docs-sync.sh` |
| `audit-vite-env.sh` | Audit environment-variable secret exposure in client bundles | `./scripts/audit-vite-env.sh` |
| `vercel-ignore-build.sh` | Fail-closed Vercel build-ignore command for docs/plans/agent-only changes | `./scripts/vercel-ignore-build.sh` |
| `agent-surface.py` | Validate or sync manifest-managed agent surfaces | `python3 scripts/agent-surface.py <sync|validate>` |
| `generate-skills-docs.py` | Regenerate skill tables (AVAILABLE_SKILLS.md, skills README); `--check` fails on drift | `python3 scripts/generate-skills-docs.py` |
| `generate-precache-manifest.mjs` | Regenerate the service-worker precache list from production build output | invoked by `pnpm run build` after `next build` |
| `generate-pwa-icons.py` | Manual: re-raster PWA icons from the logo SVG | `python3 scripts/generate-pwa-icons.py` |

## Shared Library

| File | Purpose |
|------|---------|
| `lib/lint_cache.sh` | Lint-result caching for the quality gate |
| `lib/run-check.sh` | Shared check runner used by verify.sh |
| `lib/workflow-monitor.sh` | Shared check-state parser used by GitHub workflow skills |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_TESTS` | `false` | Skip language test runners, including Vitest and BATS |
| `SKIP_LINT` | `false` | Skip lint checks |
| `SKIP_E2E` | `false` | Skip the conditionally triggered Playwright E2E run |
| `FORCE_E2E` | `false` | Run Playwright E2E regardless of structural-change detection |
| `FORCE_COLOR` | unset | Use TTY color detection; `0` disables colors |

## Quality Gate Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Quality gate passed |
| `1` | Invalid invocation or scope |
| `2` | One or more quality checks failed |

## Dependency Map

```mermaid
graph TD
    A[quality_gate.sh] --> B[validate-skills.sh]
    A --> C[validate-links.sh: SKILL.md only]
    A --> D[lint, typecheck, tests, conditional E2E]
    F[setup-skills.sh] --> G[manifest-managed tool links]
    F --> H[generate-skills-docs.py]
    H --> I[AVAILABLE_SKILLS.md and skills README]
    J[install-hooks.sh] --> K[pre-commit and commit-msg hooks]
    K --> L[minimal_quality_gate.sh]
