# Plan 15: Build/CI/Infrastructure Fixes (P1)

**Status**: DONE — merged via PR #584; all CI checks green

**GOAP Goal**: G-CONFIG  
**Priority**: P1  
**Estimated Total Effort**: 4-6 hours  
**GitHub Issues**: #194, #198

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #194 | Improvement | Add CI job timeouts and caching for faster builds | MEDIUM |
| #198 | Improvement | Fix tsconfig.app.json including Node types in browser build | LOW |

Plus additional infrastructure gaps discovered during analysis.

## Tasks

### 15.1 Add CI Job Timeouts
**Files**: `.github/workflows/*.yml`  
**Issue**: #194 — No `timeout-minutes` on any CI job. GitHub Actions defaults to 6 hours.  
**Action**:
1. Add `timeout-minutes: 15` to all jobs in all workflow files:
   ```yaml
   jobs:
     test:
       timeout-minutes: 15
       runs-on: ubuntu-latest
       # ...
   ```
2. Identify all workflow files: `ls .github/workflows/*.yml`
3. Apply to: test, lint, typecheck, build, E2E, and any other jobs
**Effort**: 0.5h  
**Validation**: Each job in every workflow has `timeout-minutes: 15`

---

### 15.2 Add pnpm Store and Playwright Caching
**Files**: `.github/workflows/*.yml`  
**Issue**: #194 — No caching for pnpm store, node_modules, or Playwright browsers  
**Action**:
1. Add pnpm store caching to CI workflows:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.local/share/pnpm/store
       key: ${{ runner.os }}-pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}
       restore-keys: |
         ${{ runner.os }}-pnpm-store-
   ```
2. Add Playwright browser caching:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.cache/ms-playwright
       key: ${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}
       restore-keys: |
         ${{ runner.os }}-playwright-
   ```
3. Ensure cache keys use `hashFiles` for proper invalidation
**Effort**: 1h  
**Validation**: CI runs show cache hit ≥40% reduction in install time

---

### 15.3 Fix tsconfig.app.json Node Types
**File**: `tsconfig.app.json`  
**Issue**: #198 — `types: ["vite/client", "node"]` includes Node.js types in browser build  
**Action**:
1. Remove `"node"` from `compilerOptions.types`:
   ```json
   {
     "compilerOptions": {
       "types": ["vite/client"]
     }
   }
   ```
2. Ensure no browser code uses Node.js APIs that would break
3. Verify `tsconfig.node.json` still includes node types for CLI/scripts
**Effort**: 0.5h  
**Validation**: `tsc --noEmit` passes; browser bundle doesn't include Node polyfills

---

### 15.4 Fix Dependabot Configuration
**File**: `.github/dependabot.yml`  
**Issue**: Dependabot configured for Docker, Terraform, Docker Compose, pre-commit — none of which exist in this repo  
**Action**:
1. Remove non-existent ecosystem entries
2. Keep only:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule:
         interval: "weekly"
   ```
**Effort**: 0.5h  
**Validation**: `dependabot.yml` only references npm and GitHub Actions

---

### 15.5 Disable/Remove create-jules-issues.yml
**File**: `.github/workflows/create-jules-issues.yml`  
**Issue**: One-time workflow that should be disabled  
**Action**:
1. Either:
   - Delete the file, or
   - Disable by setting `on: workflow_dispatch` only (no trigger)
**Effort**: 0.5h  
**Validation**: Workflow no longer runs on push/schedule

---

### 15.6 Add Path-Based CI Skipping
**Files**: `.github/workflows/*.yml`  
**Issue**: All changes trigger full CI, including docs-only changes  
**Action**:
1. Add path filters to CI workflows:
   ```yaml
   on:
     push:
       paths-ignore:
         - 'docs/**'
         - '**.md'
         - '**.txt'
   ```
2. Ensure docs-only changes skip expensive CI jobs
**Effort**: 0.5h  
**Validation**: Markdown-only PR skips test/build steps

---

## Completion Criteria

- [x] All CI jobs have an explicit `timeout-minutes` value. Values are tuned by workflow: 5 minutes for Dependabot auto-merge, 10 minutes for change detection, 15 minutes for standard jobs, and 20 minutes for E2E/coverage jobs.
- [x] The CI workflow caches the pnpm store through `actions/setup-node` and caches Playwright browsers with a lockfile-keyed `actions/cache` entry.
- [x] `tsconfig.app.json` only includes `vite/client` types.
- [x] `pnpm run typecheck` passes with browser-only types.
- [x] Dependabot is configured only for npm and GitHub Actions.
- [x] `create-jules-issues.yml` is manual-dispatch only and does not run automatically.
- [x] The `changes` job skips expensive quality, unit-test, build, and E2E jobs for docs-only pull requests while retaining dedicated documentation/workflow validation where configured.

### Verification note — 2026-08-01

Plan 097 completed the remaining actionable CI implementation by adding a lockfile-keyed Playwright browser cache to `.github/workflows/ci-and-labels.yml`. The cache covers Playwright browser archives under `~/.cache/ms-playwright`; Linux system packages installed by `playwright install --with-deps` remain runner-provided and are intentionally not represented as cached state. The original “all jobs have `timeout-minutes: 15`” wording was corrected because the repository already uses deliberately different limits for lightweight, standard, E2E, and coverage jobs; the enforceable requirement is explicit bounded timeouts on every job. Plan 15 was marked DONE on 2026-08-01 after PR #584 passed all required checks and merged (squash `720df58`).
