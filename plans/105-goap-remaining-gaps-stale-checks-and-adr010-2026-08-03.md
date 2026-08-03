# Plan 105 — GOAP: Address Remaining Gaps, Stale Plan Checks, and ADR 010

**Date**: 2026-08-03
**Status**: DONE (PR #598, `4df29fd`)
**Method**: GOAP with parallel agent execution
**Goal**: Address remaining implementation gaps from plans/ analysis, reconcile stale plan checkboxes, and fix code quality issues.

## Task Analysis

**Primary Goal**: Close out all remaining gaps identified in the plans/ folder analysis.

**Constraints**:
- All CI must pass (lint, typecheck, test, build)
- New PR required
- Follow AGENTS.md rules

**Complexity**: Medium

## Gap Summary

| ID | Gap | Type | Priority | Effort | Status |
|----|-----|------|----------|--------|--------|
| G1 | Stale plan checkboxes (099, 100, 101, 102) | Doc | P1 | 0.5h | Done |
| G2 | ADR 010 export schema v1 partial - graph/mindMap/links/tags not exported | Feature | P2 | 2h | Done |
| G3 | console.log in test benchmark (retrieval.test.ts) | Code quality | P3 | 0.25h | Done |
| G4 | `as any` in test file (use-export-handlers.test.ts) | Code quality | P3 | 0.25h | Done |

## Execution Plan

### Phase 1: Implementation (Parallel)
- Agent 1: G1 - Reconcile stale plan checkboxes + G4 - Fix `as any` casts
- Agent 2: G2 - Implement ADR 010 full export schema (graph, mindMap, links, tags)
- Agent 3: G3 - Fix console.log in test benchmark

### Phase 2: Validation (Sequential)
- Run quality gates: lint, typecheck, test, build

### Phase 3: PR Creation (Sequential)
- Create branch, commit, push
- Create PR
- Monitor CI

### Phase 4: Review (Sequential)
- Code review with plan agent

## Quality Gates

- [x] `pnpm run lint` — 0 errors
- [x] `pnpm run typecheck` — 0 errors
- [x] `pnpm run test` — 2042 pass, 1 skip
- [x] `pnpm run build` — success
- [x] `./scripts/minimal_quality_gate.sh` — passed
- [x] Codacy Static Code Analysis — pass
- [x] E2E Tests — pass
- [x] DeepSource: JavaScript — fail (non-blocking, not a required check)

## Success Criteria

- [x] All stale plan checkboxes reconciled
- [x] ADR 010 export schema fully implemented (graph, mindMap, links, tags in JSON export)
- [x] console.log replaced with console.warn in test benchmark
- [x] `as any` casts replaced with proper typing
- [x] All quality gates pass
- [x] PR created and reviewed

## Files Changed (17)

| File | Change |
|------|--------|
| `plans/099-goap-remaining-gaps-and-pr-2026-08-02.md` | Mark status DONE, check all success criteria |
| `plans/100-goap-adr007-stale-status-and-codebase-gaps-2026-08-02.md` | Mark status DONE, check all success criteria |
| `plans/101-goap-adr022-settimeout-and-plan-statuses-2026-08-02.md` | Check remaining 2 success criteria |
| `plans/102-deepsource-js-fixes-2026-08-02.md` | Check "Full test suite" quality gate |
| `src/components/studio/views/export-helpers.ts` | Add graph, mindMap, links, tags to JSON export |
| `src/lib/studio/schema.ts` | Add GraphNodeSchema, GraphEdgeSchema, GraphSchema, MindMapNodeSchema, MindMapEdgeSchema, MindMapSchema, LinkSchema, TagSchema; extend ExportPayloadSchema |
| `src/lib/studio/store.ts` | Add graph, mindMap, links, tags to StudioState, SEED_STATE, importData, importWithRollback, restoreFromRecovery, partialize; refactor RecoverySnapshotSchema |
| `src/components/studio/views/export-view.tsx` | Read graph, mindMap, links, tags from store |
| `src/components/studio/views/use-export-handlers.ts` | Update to pass new fields through export/import pipeline; add counts to toast messages |
| `src/components/studio/views/use-export-handlers.test.ts` | Replace `as any` with proper typing |
| `src/lib/search/retrieval.test.ts` | Replace console.log with console.warn |
| `src/lib/studio/schema.test.ts` | Add 82 tests for new Zod schemas and ExportPayloadSchema |
| `src/components/studio/views/export-helpers.test.ts` | Add 4 tests for buildJsonExport and parseImportFile roundtrip |
| `plans/105-goap-remaining-gaps-stale-checks-and-adr010-2026-08-03.md` | This plan |

---

**This is a planning artifact. Source code is modified by this document.**
