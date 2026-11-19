# Runtime & Toolchain

Authoritative decisions: `plans/219-runtime-toolchain-1165-1166-2026-11-19.md`
(#1165 Node matrix, #1166 pnpm 12). This page is the operator-facing summary.

## Node.js

| Runtime | Status | Where validated |
|---------|--------|-----------------|
| Node 22 LTS | **Primary runtime** — `engines.node` floor is `>=22.12.0` | Per-PR CI (`ci-and-labels.yml`), `setup-node` pinned to `'22'` |
| Node 24 LTS | Supported — inside `engines.node` `>=22.12.0 <27.0.0` | Scheduled weekly matrix (`.github/workflows/runtime-matrix.yml`) |
| Node 26 LTS | Supported — same range, same schedule | Same matrix |
| Node 27+ | **Not supported** (untested future line) — engine-strict refuses it | — |

- The matrix runs frozen install, lint, typecheck, unit tests, and the
  production build on every listed runtime (weekly + on demand + on any
  change to the workflow, lockfile, or root manifests).
- A red matrix run is a supported-runtime blocker: record the concrete
  failure (and the upstream issue) in plan 219, narrow `engines.node`, and
  note the exclusion — no runtime is advertised merely because install
  worked.

## pnpm

- Pinned **`pnpm@12.17.0`** by `packageManager` (lockfile vendors the pinned
  manager: integrity-checked `@pnpm/exe.*` artifacts in the lockfile's
  manager document, so CI and local installs are reproducible even before
  `pnpm/action-setup` runs).
- All pnpm settings live in `pnpm-workspace.yaml` (`engineStrict`,
  `peerDependencyRules`, `overrides`, `allowBuilds`, `auditConfig`). There is
  **no `.npmrc`** and no `pnpm` field in `package.json` — pnpm 12 ignores the
  latter and the validator (`scripts/validate-package-manager.sh`) fails the
  gate if settings drift back.
- Build scripts of pinned deps are **denied by default** (`allowBuilds:
  pkg: false` — core-js, esbuild, onnxruntime-node, protobufjs,
  unrs-resolver). To approve a new dep's postinstall, run
  `pnpm approve-builds <pkg>` and review the resulting `allowBuilds` diff —
  never run `--all`.
- Rollback pnpm: `git revert` the plan-219 commit, then
  `pnpm install --frozen-lockfile` (details in plan 219).

## Upgrading the toolchain (next time)

1. `npm view pnpm versions` + release notes; test with
   `npm_config_manage_package_manager_versions=false npx -y pnpm@<candidate>
   install --frozen-lockfile` first — expect a settings migration, never
   regenerate blindly.
2. `pnpm approve-builds` for new build-script deps (deny form to preserve the
   default).
3. Full gate under the candidate (`pnpm --version` must print the candidate),
   lockfile churn diff (target: zero dep-graph changes), docs + plan record,
   then pin.
