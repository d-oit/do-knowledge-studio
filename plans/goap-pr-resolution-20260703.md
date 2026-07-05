# GOAP Plan: Resolve All Open PRs (10 PRs) — 2026-07-03

## Phase 1: Task Analysis

**Primary Goal**: Resolve all 10 open GitHub PRs — fix CI failures, rebase to main, address review comments, and merge or close based on impact.

**Constraints**:
- All PRs are behind `main` by multiple commits
- 2 feature PRs (#368, #356) have DeepSource/Codacy CI failures
- 8 Dependabot PRs have cancelled auto-merge but otherwise passing CI
- Must preserve backward compatibility for security PR #356

**Complexity**: Medium-to-High
- Mixed PR types (feature vs. dependency)
- Multiple CI failure types (lint vs. static analysis)
- Coordination needed to avoid conflicts

---

## Phase 2: Task Decomposition

### Track 1: Feature PR CI Fixes (Priority P0)

#### Goal A: Fix PR #368 (Perf optimization — N+1 search)
- **Deps**: none
- **Issues**: 2x non-null assertions in `src/lib/search/progressive.ts` (lines 98, 100)
- **Agent**: code-quality + git-github-workflow
- **Strategy**: Sequential — fix lint, rebase, push

**Sub-Tasks**:
1. Checkout PR #368 branch
2. Replace non-null assertions with proper null checks
3. Run quality gate
4. Rebase onto main
5. Push and verify CI
6. Merge if green

#### Goal B: Fix PR #356 (Security — key hardening)
- **Deps**: none (but higher complexity)
- **Issues**: 
  - 20+ DeepSource warnings (unused vars, `any` types, global function declarations, cyclomatic complexity)
  - Codacy ACTION_REQUIRED
- **Agent**: code-quality + security-code-auditor + git-github-workflow
- **Strategy**: Sequential — fix lints, rebase, push

**Sub-Tasks**:
1. Checkout PR #356 branch
2. Fix unused imports (`vi`, `afterEach`, `logger`)
3. Replace `any` with proper types
4. Convert global function declarations to `export` (ES module pattern)
5. Replace string concatenation with template literals
6. Extract complex function logic to reduce cyclomatic complexity
7. Run quality gate (typecheck, lint, tests)
8. Rebase onto main
9. Push and verify CI
10. Merge if green

---

### Track 2: Dependabot PR Rebase (Priority P1)

#### Goal C: Bulk-rebase and merge 8 Dependabot PRs
- **Deps**: none (independent of each other)
- **Issues**: All behind main, auto-merge cancelled due to drift
- **Agent**: git-github-workflow
- **Strategy**: Parallel execution with batch rebase

**Sub-Tasks** (can run in parallel):
1. PR #367: `@vitejs/plugin-react` 6.0.2 → 6.0.3
2. PR #366: `@tiptap/extension-placeholder` 3.25.0 → 3.27.1
3. PR #365: `@types/node` 25.9.3 → 26.0.1
4. PR #364: `@playwright/test` 1.61.0 → 1.61.1
5. PR #363: `@typescript-eslint/eslint-plugin` 7.2.0 → 7.18.0
6. PR #362: `actions/cache` 5.0.5 → 6.1.0
7. PR #361: `actions/setup-python` 6.2.0 → 6.3.0
8. PR #360: `trufflesecurity/trufflehog` 3.95.6 → 3.95.7

**For each**:
- Fetch PR branch
- Rebase onto main
- Push with `--force-with-lease`
- Verify CI passes
- Merge

---

## Phase 3: Strategy Selection

| Track | Strategy | Reason | Speed |
|-------|----------|--------|-------|
| Track 1 (Feature PRs) | **Sequential** | Code quality fixes need manual review | 1x |
| Track 2 (Dependabot) | **Parallel** | Independent, low-risk dependency updates | ~8x |

**Hybrid Execution**: Track 1 sequential, Track 2 parallel (spawn after Track 1 starts)

---

## Phase 4: Agent Assignment

| Agent | Role | Assigned To |
|-------|------|-------------|
| `code-quality` | Lint/static analysis fixes | PR #368, #356 |
| `security-code-auditor` | Review security implications | PR #356 |
| `git-github-workflow` | Rebase, push, merge coordination | All PRs |
| `test-runner` | Validate quality gates | PR #368, #356 |

---

## Phase 5: Execution Plan

### Phase 1: Feature PR #368 (Low-Risk)
**Tasks**:
1. Checkout `perf/eliminate-n-plus-one-search-init-8148724708500007784`
2. Fix 2x non-null assertions in `src/lib/search/progressive.ts`
3. Run `pnpm run typecheck && pnpm run lint && pnpm run build`
4. Rebase onto `main`
5. Push with `--force-with-lease`
6. Wait for CI (DeepSource should pass)
7. Merge PR #368

**Quality Gate**: All CI checks green + build succeeds

---

### Phase 2: Feature PR #356 (High-Risk — Security)
**Tasks**:
1. Checkout `fix/security-hardening-key-management-4796541718176994595`
2. Fix DeepSource warnings:
   - Remove unused imports
   - Replace `any` with specific types
   - Convert global functions to `export`
   - Use template literals
   - Refactor complex functions
3. Run full quality gate: `./scripts/quality_gate.sh`
4. Rebase onto `main`
5. Push with `--force-with-lease`
6. Wait for CI (DeepSource + Codacy should pass)
7. Merge PR #356

**Quality Gate**: All CI checks green + security audit passes + e2e tests pass

---

### Phase 3: Parallel Dependabot Rebase
**Tasks** (parallel execution):
- For each PR (#360-367):
  - `gh pr checkout <number>`
  - `git fetch origin main`
  - `git rebase origin/main`
  - `git push --force-with-lease`
  - Wait for CI
  - `gh pr merge --squash --auto` (enable auto-merge once CI passes)

**Quality Gate**: All 8 PRs have passing CI and auto-merge enabled

---

## Phase 6: Coordinated Execution

### Execution Order:
1. **Start Track 1 — PR #368** (fast, low-risk)
2. **Parallel — Start Track 2 (Dependabot)** while PR #368 is in CI
3. **Continue Track 1 — PR #356** (slower, high-risk)
4. **Monitor Track 2** — ensure all Dependabot PRs merge cleanly
5. **Final Sweep** — verify all PRs merged or closed

---

## Phase 7: Result Synthesis

### Success Criteria:
- ✅ PR #368: Merged (perf optimization)
- ✅ PR #356: Merged (security hardening)
- ✅ PRs #360-367: All 8 Dependabot PRs merged
- ✅ Zero open PRs remaining
- ✅ All CI checks green on `main`

### Deliverables:
- Clean PR backlog
- Improved codebase security (PR #356)
- Optimized search performance (PR #368)
- Up-to-date dependencies
- Documentation of fixes in commit messages

---

## Error Handling

| Error | Recovery |
|-------|----------|
| DeepSource still fails after fixes | Add `skipcq` comments with justification |
| Rebase conflict | Manual resolution + retest |
| Dependabot PR fails CI | Investigate specific dependency issue, may need to close/ignore |
| Security PR breaks tests | Roll back specific changes, split into smaller PRs |

---

## Implementation Notes

### Key Files to Modify:

**PR #368**:
- `src/lib/search/progressive.ts` (lines 98, 100) — replace `!` with proper checks

**PR #356**:
- `src/lib/__tests__/crypto.test.ts` — remove unused `vi`
- `src/lib/__tests__/key-store-migration.test.ts` — remove unused vars, fix `any`, use template literals
- `src/lib/crypto.ts` — export functions, remove unused `logger`
- `src/lib/key-store.ts` — export functions, reduce complexity in `getStoreEncryptionKey`
- `src/lib/llm/__tests__/encryption-migration.test.ts` — remove unused vars, use template literals
- `src/lib/llm/encryption.ts` — export functions, reduce complexity in `getKey`

### Quality Gate Commands:
```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
# For PR #356 only:
./scripts/quality_gate.sh
pnpm run test:e2e:ci
```

---

## Timeline Estimate

| Phase | Duration | Parallelism |
|-------|----------|-------------|
| PR #368 fixes | 10 min | 1x |
| PR #368 CI + merge | 8 min | 1x |
| PR #356 fixes | 30 min | 1x |
| PR #356 CI + merge | 12 min | 1x |
| Dependabot rebase | 15 min | 8x parallel → ~2 min real |
| Total | ~60 min | Mixed |

**Expected Real Time**: ~30-40 minutes with parallel execution

---

## Status Tracking

- [ ] Phase 1: PR #368 fixed
- [ ] Phase 1: PR #368 merged
- [ ] Phase 2: PR #356 fixed
- [ ] Phase 2: PR #356 merged
- [ ] Phase 3: Dependabot PRs rebased (8/8)
- [ ] Phase 3: Dependabot PRs merged (8/8)
- [ ] Final: All PRs resolved

---

## Next Steps

1. **Start Execution**: Begin with PR #368 (lowest risk)
2. **Monitor Progress**: Use GitHub Actions dashboard
3. **Validate Quality**: Ensure all quality gates pass
4. **Document Learnings**: Update AGENTS.md if new patterns emerge
