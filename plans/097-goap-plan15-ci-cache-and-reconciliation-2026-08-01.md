# Plan 097 — GOAP: Complete Plan 15 CI Caching and Reconcile Infrastructure Criteria

**Date**: 2026-08-01
**Status**: IN PROGRESS
**Method**: GOAP with targeted swarm investigation
**Goal**: Implement the remaining actionable current-architecture item from Plan 15 and reconcile its completion criteria with the repository’s actual CI design.

## Scope Decision

Historical plans contain many unchecked items for the retired Vite/SQLite/CLI architecture. The swarm narrowed this work to Plan 15 because it contains current GitHub Actions and TypeScript configuration requirements, and because the repository already satisfies most of those requirements. The only concrete implementation gap was Playwright browser caching in the main CI workflow.

The skipped IndexedDB persistence test in `src/lib/sync/bridge-branch-coverage.test.ts` remains a separate test-environment follow-up. It is not bundled into this CI/config PR because enabling it would require unrelated storage mocking or a test-only browser persistence dependency.

## Actions

| ID | Action | Status |
|----|--------|--------|
| G1 | Add a lockfile-keyed cache for `~/.cache/ms-playwright` to the E2E job | Done |
| G2 | Verify explicit timeout bounds across all workflow jobs | Done |
| G3 | Verify pnpm caching, browser-only app types, Dependabot ecosystems, and manual Jules dispatch | Done |
| G4 | Verify docs-only pull requests skip expensive jobs through the existing `changes` gate | Done |
| G5 | Run quality gates, review, create PR, and monitor all checks | In progress |

## Evidence

- `.github/workflows/ci-and-labels.yml` now caches Playwright browsers using the `pnpm-lock.yaml` hash and a restore key for the runner OS.
- `actions/setup-node` already caches pnpm in the quality, unit-test, E2E, build, and coverage jobs.
- Every workflow job has an explicit timeout. The values intentionally vary by workload rather than forcing every job to 15 minutes.
- `tsconfig.app.json` contains only `vite/client` in `compilerOptions.types`.
- `.github/dependabot.yml` contains only npm and GitHub Actions update ecosystems.
- `.github/workflows/create-jules-issues.yml` is `workflow_dispatch` only.
- The `changes` job drives `any_code` and `frontend` outputs, so docs-only pull requests skip quality, unit-test, build, and E2E jobs while dedicated documentation/workflow checks remain independently configured.

## Quality Gates

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run test`
- [ ] `pnpm run test:coverage`
- [ ] `pnpm run build`
- [ ] `./scripts/quality_gate.sh`
- [ ] Structured code review
- [ ] PR checks all green
