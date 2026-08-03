# Plan 104 — Address Remaining Implementation Gaps from plans/ Analysis

**Date**: 2026-08-03
**Status**: IN PROGRESS
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

- [ ] Chat submit debounced at 300ms
- [ ] Graph keyboard navigation complete (arrow keys, zoom, Home, Delete)
- [ ] Empty catch blocks resolved
- [ ] Export claims lookup optimized
- [ ] All quality gates pass
- [ ] PR created and reviewed
