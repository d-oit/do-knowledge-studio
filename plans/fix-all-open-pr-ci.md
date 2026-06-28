# GOAP Plan: Fix All Open PR CI Failings

## Goal
Get all 6 open PRs to pass CI and merge them.

## Task Analysis
- **Primary Goal**: All 6 PRs merged with green CI
- **Current State**: PR #350 passes all checks. PRs #343-346 and #351 fail E2E Tests only
- **Root Cause**: E2E tests fail on main due to viewport/selector issues. PR #350 fixes these.
- **Strategy**: Merge #350 first, then rebase Dependabot PRs onto updated main

## Sub-Goals
1. **T1**: Merge PR #350 (E2E fixes) into main - P0, Deps: none
2. **T2**: Rebase Dependabot PRs (#343-346) onto updated main - P0, Deps: T1
3. **T3**: Rebase PR #351 (perf) onto updated main - P1, Deps: T1
4. **T4**: Verify all PRs pass CI - P0, Deps: T2, T3

## Execution Strategy
- Phase 1: Merge PR #350 (sequential, single action)
- Phase 2: Rebase all 5 PRs in parallel using git worktrees
- Phase 3: Wait for CI and merge

## Execution Plan

### Phase 1: Merge PR #350
- Action: `gh pr merge 350 --merge`
- Quality Gate: PR merged successfully

### Phase 2: Rebase Dependabot PRs (parallel via worktrees)
- Worktrees already exist at /tmp/wt-343 through /tmp/wt-346
- Action: For each worktree, rebase onto updated main and force-push
- Agent: Use explore agents for investigation, general agents for rebase operations

### Phase 3: Rebase PR #351
- Action: Rebase perf/editor-lazy-load-mentions onto updated main

### Phase 4: Verify and merge all
- Action: Wait for CI, merge passing PRs
