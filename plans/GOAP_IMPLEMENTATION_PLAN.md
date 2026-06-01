# GOAP Implementation Plan: Swarm Analysis Recommendations

> Orchestrated via Goal-Oriented Action Planning with multi-agent handoff coordination

## Task Analysis

**Primary Goal**: Address all critical and high-priority findings from the swarm analysis to improve code quality, security, and reliability.

**Constraints**:
- Time: Normal (no external deadline)
- Resources: Available agents (feature-implementer, refactorer, debugger, test-runner, code-reviewer)
- Dependencies: Open PRs (#245-#247) should be merged first to avoid conflicts

**Complexity Level**: Complex (12+ tasks across multiple domains)

**Quality Requirements**:
- Testing: All changes must pass existing test suite
- Standards: AGENTS.md compliance, TypeScript strict mode
- Documentation: Update plans/ with results

---

## Task Decomposition

### P0 - Critical (Fix Now)

| Task | ID | Agent | Dependencies | Complexity |
|------|----|-------|--------------|------------|
| Fix XSS in export (entity descriptions) | P0-1 | refactorer | none | Medium |
| Fix `as any` in repository.ts | P0-2 | refactorer | none | Low |
| Fix dependabot auto-merge workflow | P0-3 | feature-implementer | none | Medium |

### P1 - High Priority (Address Soon)

| Task | ID | Agent | Dependencies | Complexity |
|------|----|-------|--------------|------------|
| Add concurrency groups to CI workflows | P1-1 | refactorer | none | Low |
| Fix dedup similarity algorithm | P1-2 | refactorer | none | Medium |
| Remove dead `library` view from SidebarNav | P1-3 | refactorer | none | Low |
| Fix version-propagation race condition | P1-4 | refactorer | none | Low |

### P2 - Medium Priority (Backlog)

| Task | ID | Agent | Dependencies | Complexity |
|------|----|-------|--------------|------------|
| Add job timeouts to CI/E2E workflows | P2-1 | refactorer | none | Low |
| Reduce stale.yml permissions | P2-2 | refactorer | none | Low |
| Fix deprecated `onKeyPress` in AIHarness | P2-3 | refactorer | none | Low |
| Fix silent error swallowing in repository.ts | P2-4 | refactorer | P0-2 | Medium |
| Fix `limit` option in Chat.tsx | P2-5 | refactorer | none | Low |
| Remove unused `relatedEntities` prop | P2-6 | refactorer | none | Low |

---

## Execution Strategy

**Strategy**: Hybrid (Parallel within phases, Sequential between phases)

```
Phase 1 (Parallel): P0 Critical Fixes
  ├─ Agent A → P0-1 (XSS in export)
  ├─ Agent B → P0-2 (as any in repository)
  └─ Agent C → P0-3 (dependabot auto-merge)
  ↓ Quality Gate: All P0 fixes complete, tests pass

Phase 2 (Parallel): P1 High Priority Fixes
  ├─ Agent A → P1-1 (concurrency groups)
  ├─ Agent B → P1-2 (dedup algorithm)
  ├─ Agent C → P1-3 (dead library view)
  └─ Agent D → P1-4 (version-propagation)
  ↓ Quality Gate: All P1 fixes complete, tests pass

Phase 3 (Swarm): P2 Medium Priority Fixes
  ├─ Worker 1 → P2-1, P2-2, P2-3
  ├─ Worker 2 → P2-4, P2-5, P2-6
  ↓ Quality Gate: All P2 fixes complete, tests pass

Phase 4 (Sequential): Final Validation
  ├─ test-runner → Full test suite
  ├─ code-reviewer → Quality check
  └─ Synthesize results
```

---

## Quality Gates

### Gate 1: After P0 Fixes
- [ ] XSS vulnerability fixed in `ExportPanel.tsx` and `cli/index.ts`
- [ ] `as any` casts removed from `repository.ts`
- [ ] Dependabot auto-merge workflow secured
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes

### Gate 2: After P1 Fixes
- [ ] Concurrency groups added to all applicable workflows
- [ ] Dedup algorithm uses proper similarity metric
- [ ] Dead `library` view removed or implemented
- [ ] Version-propagation has concurrency group
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes

### Gate 3: After P2 Fixes
- [ ] Job timeouts added to CI/E2E workflows
- [ ] `stale.yml` permissions reduced
- [ ] Deprecated `onKeyPress` replaced with `onKeyDown`
- [ ] Silent error swallowing addressed
- [ ] Dead `limit` option removed or implemented
- [ ] Unused `relatedEntities` prop removed
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run test` passes

---

## Success Criteria

- [ ] All 12 tasks completed
- [ ] 3 quality gates passed
- [ ] Zero regressions in existing functionality
- [ ] All GitHub Actions workflows improved
- [ ] Plans/ folder updated with execution results

---

## Contingency Plans

- **If P0 task fails**: Debug individually, apply fix, re-validate
- **If quality gate fails**: Run debugger agent, fix regressions, re-run gate
- **If task blocked**: Skip and continue with independent tasks, return later
