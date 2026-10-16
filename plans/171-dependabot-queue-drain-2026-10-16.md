# Plan 171 — Dependabot queue drain

**Date:** 2026-10-16  
**Status:** Done — all seven PRs merged; production verified for every app-touching bump  
**Owner:** integration owner for this sweep  
**Base at inventory:** `main` `b1660e1b0ed27cc1ef528ca50bbe5e0458967a65` (after Plan 170 and its status PR merged)

## Scope and protocol

Drain the seven open Dependabot PRs (957–963) left over after the Plan 168 sweep and the Plan 170 feature work. The ruleset requires strict up-to-date branches (`strict_required_status_checks_policy`) and linear history, so the queue is strictly serial: rebase one PR onto `main`, let full CI run on its new head, squash-merge, then rebase the next. Each merge re-behinds every remaining PR.

Per PR:

1. Review the diff and upstream release notes for breaking changes (a major bump gets the full read).
2. Request `@dependabot rebase` (the bot regenerates the lockfile; a manual `update-branch` would conflict on `pnpm-lock.yaml` once a sibling lockfile change lands).
3. Let CI run on the rebased head; verify checks and review threads are clean.
4. `gh pr merge --auto --squash --delete-branch` under the standing merge authorization.
5. Workflow-only or docs-only merges do not produce Vercel deployments; app-touching merges are verified against the production deployment.

## Inventory

| PR | Package | From → To | Files | Review notes |
|---|---|---|---|---|
| #963 | `actions/setup-node` | 7.0.0 → 7.1.0 | 3 workflow YAMLs | mise.toml support, path validation; no config changes needed |
| #962 | `actions/upload-artifact` | 7.0.1 → 7.0.2 | `ci-and-labels.yml` | 429 retry handling |
| #961 | `reviewdog/action-actionlint` | 1.77.0 → 1.80.1 | `yaml-lint.yml` | pyflakes/python image bumps; bot updated to 1.80.1 mid-sweep |
| #960 | `@types/node` | 26.6.3 → 26.6.5 | `package.json`, lockfile | patch-level types |
| #959 | `jsdom` | 29.1.1 → 30.1.2 | `package.json`, lockfile | **major**: Node ≥22.22.2 (we run 22.23.2), `getComputedStyle()` px conversion; exercised by the full unit suite |
| #958 | `@radix-ui/react-separator` | 1.1.15 → 1.2.0 | `package.json`, lockfile | `exactOptionalPropertyTypes` compatibility; used by `src/components/ui/separator.tsx` |
| #957 | `docx` | 9.7.1 → 9.10.0 | `package.json`, lockfile | additive `docx/layout`, hyperlink-fragment fix; used by `src/components/studio/views/export-documents.ts` |

## Progress

- 2026-10-16: refreshed inventory — all seven BEHIND `main`, zero review threads, prior heads all green; release notes reviewed per table above.
- #963 rebased to `e359c79`, all checks green (E2E correctly skipped for a workflow-only diff), squash-merged at 11:15Z.
- #962 rebased to `72fe335`, all checks green, squash-merged.
- #961 rebased to `4fb1d0d`; Dependabot re-pushed `3cd1823` (actionlint updated to 1.80.1) with auto-merge armed; squash-merged at 11:25:48Z.
- #960 rebased to `94512ef`, all checks green including E2E, squash-merged at 11:53:59Z.
- #959 (jsdom 30 major) rebased to `8452c1b`; full unit suite (4m03s), Coverage, E2E, and Quality Gate all green on the new head; squash-merged at 12:07:42Z. Production deployment `ac39506` succeeded.
- #958 first rebase (`2a058ff`) missed the #959 squash by one commit (BEHIND); a follow-up rebase landed correctly on main (`1316688`, `ahead 1 / behind 0`), all checks green, squash-merged; production deployment `146adc7` succeeded. `@dependabot rebase` can target a main snapshot one merge behind — always verify ancestry with the compare API before declaring the branch mergeable.
- #957 (docx) rebased to `fb7f12a` (`ahead 1 / behind 0`), all checks green including E2E, squash-merged at 12:23:40Z; production deployment `0dd90a5` succeeded.
- #960 (@types/node, dev-only) produced no Vercel deployment; the ignored-build-step correctly skipped it.
- Workflow-only merges (#963, #962, #961) produced no Vercel deployments; production remains the verified `1941b2f` build.

## Merge ledger

| PR | Squash on main | Checks | Production |
|---|---|---|---|
| #963 | `3550168` | all green (E2E skipped: workflow-only) | n/a (workflow) |
| #962 | `086b81e` | all green (E2E skipped) | n/a (workflow) |
| #961 | `0697310` | all green (E2E skipped) | n/a (workflow) |
| #960 | `ce9f16f` | all green incl. E2E | n/a (dev-only) |
| #959 | `ac39506` | all green incl. E2E | `success` |
| #958 | `146adc7` | all green incl. E2E | `success` |
| #957 | `0dd90a5` | all green incl. E2E | `success` |
