# Plan 085 — GOAP: Address Remaining Implementations (2026-07-26)

## Status: IN PROGRESS
## Branch: feat/085-remaining-implementations

## Task Analysis

**Primary Goal**: Close remaining ADR implementation gaps identified across plans 068–084
**Constraints**: All CI must pass, new PR required, address all PR feedback
**Complexity**: Medium (4 focused tasks, no architectural changes)

## Gap Analysis Summary

| Item | Source | Status | Action |
|------|--------|--------|--------|
| useRateLimiter hook | ADR 017 | Never built | CREATE |
| Wire rate limiter into AI send | ADR 017 | Not wired | IMPLEMENT |
| SearchPanel.onCreateEntity | ADR 017 | Not implemented | IMPLEMENT |
| CommandPalette.onEntitySelect | ADR 017 | Not implemented | IMPLEMENT |
| Undo/redo "coming soon" labels | Plans 071/076 | Already fixed | NONE |
| ADR 028 migration chain | ADR 028 | Already implemented | NONE |
| Coverage 55% | Plans 074-076 | Already at 57% | NONE |
| Playwright retry/trace | Plan 076 | Already configured (1 retry, on-first-retry) | NONE |

## Execution Plan

- Strategy: Hybrid (sequential phases with parallel tasks within phases)
- Quality Gates: 4 (after each wave)

### Wave 1 — Create useRateLimiter Hook (P0)
- Task: Create `src/lib/ai/use-rate-limiter.ts` with windowed counter, cooldown, `canRequest()` API
- Task: Add unit tests in `src/lib/ai/use-rate-limiter.test.ts`
- Quality Gate: typecheck + lint + test pass

### Wave 2 — Wire Rate Limiter + SearchPanel + CommandPalette (P0)
- Task: Wire `useRateLimiter` into `ai-harness-view.tsx` handleSend
- Task: Add `onCreateEntity` prop to SearchPanel (right-panel.tsx) → route to editor
- Task: Add `onEntitySelect` prop to CommandPalette → route to editor
- Quality Gate: typecheck + lint + test pass

### Wave 3 — Tests + PR (P1)
- Task: Add integration tests for rate limiter wiring
- Task: Run full quality gate (lint, typecheck, test, build)
- Task: Create PR, verify CI passes
- Task: Address any PR feedback

### Wave 4 — Documentation + Closeout (P2)
- Task: Update Plan 085 with results
- Task: Update INDEX.md
- Task: Update ADR 017 status if fully implemented
- Quality Gate: docs consistent

## Success Criteria

- [ ] useRateLimiter hook created with windowed counter and cooldown
- [ ] Rate limiter wired into AI send path with cooldown UI
- [ ] SearchPanel.onCreateEntity routes to editor
- [ ] CommandPalette.onEntitySelect routes to editor
- [ ] All tests pass (existing + new)
- [ ] PR created with all CI checks passing
- [ ] All PR feedback addressed
