# Plan 104 — Address Remaining Implementation Gaps from plans/ Analysis

**Date**: 2026-08-03
**Status**: DONE (merged via PR #597, `c908089`)
**Method**: GOAP with parallel agent execution
**Goal**: Address the genuine remaining implementation gaps identified from plans/ analysis.

## Task Analysis

**Primary Goal**: Fix the 4 genuine remaining gaps in the current codebase.

**Constraints**:
- All CI must pass (lint, typecheck, test, build)
- New PR required
- Address all PR feedback
- Follow AGENTS.md rules

**Complexity**: Medium

## Gap Analysis Summary

From the 14 items checked against the codebase:
- **6 items**: Already IMPLEMENTED (entity CRUD, mind map editing, graph layouts, API keys in IndexedDB, files under 500 LOC)
- **4 items**: N/A to current architecture (cursor pagination, LRU cache, transformers lazy-load, mention virtualization — targeted SQLite/Orama stack that was replaced)
- **4 items**: Genuine remaining gaps

## Genuine Gaps to Address

| ID | Gap | File | Effort | Priority |
|----|-----|------|--------|----------|
| G1 | Chat submit not debounced (300ms) | `chat-view.tsx` | 0.5h | P1 |
| G2 | Graph keyboard nav incomplete (no arrow-key panning, zoom, Home, Delete) | `graph-view.tsx` | 1.5h | P1 |
| G3 | Empty catch blocks in streaming parser | `providers.ts` | 0.5h | P2 |
| G4 | Export O(N×M) claims lookup optimization | `export-helpers.ts` | 1h | P2 |

## Execution Plan

### Phase 1: Implementation (Parallel)
- Agent 1: G1 (chat debounce) + G3 (empty catches)
- Agent 2: G2 (graph keyboard nav)
- Agent 3: G4 (export optimization)

### Phase 2: Validation (Sequential)
- Run quality gates: lint, typecheck, test, build
- Run E2E tests

### Phase 3: PR Creation (Sequential)
- Create branch, commit, push
- Create PR
- Monitor CI

### Phase 4: Review (Sequential)
- Code review with plan agent
- Address any findings

## Success Criteria

- [x] Chat submit debounced at 300ms
- [x] Graph keyboard navigation complete (arrow keys, zoom, Home, Delete)
- [x] Empty catch blocks resolved
- [x] Export claims lookup optimized
- [x] All quality gates pass
- [x] PR created and reviewed

## Quality Gates

- [x] `pnpm run lint` — 0 errors
- [x] `pnpm run typecheck` — 0 errors
- [x] `pnpm run test` — 1998 pass, 1 skip
- [x] `pnpm run build` — success
- [x] `./scripts/minimal_quality_gate.sh` — passed
- [x] Codacy Static Code Analysis — pass
- [x] E2E Tests — pass (after flaky re-run)

## Files Changed (8)

| File | Change |
|------|--------|
| `src/components/studio/views/chat-view.tsx` | Added 300ms debounce to sendMessage via ref-based timer |
| `src/components/studio/views/graph-view.tsx` | Added pan/zoom state, keyboard handler for arrow/+/-/Home/Delete |
| `src/lib/ai/providers.ts` | Added descriptive comments to streaming parser catch blocks |
| `src/components/studio/views/export-helpers.ts` | Added `buildClaimsByEntityId()` Map helper, replaced 4× `.filter()` calls |
| `src/components/studio/views/chat-view.test.tsx` | Updated to use fake timers for debounce testing + debounce cancellation test |
| `src/components/studio/views/chat-view-coverage.test.tsx` | Updated to use fake timers for debounce testing |
| `src/components/studio/views/graph-view.test.tsx` | Added 6 keyboard navigation tests + fixed vi.mock hoisting |
| `plans/104-remaining-gap-remediation-2026-08-03.md` | Plan documenting the gap analysis and implementation |
