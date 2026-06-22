# Plan: Fix All Lint Errors

## Task Analysis

**Primary Goal**: Fix all 114 ESLint errors and 1 warning so `pnpm run lint` passes cleanly
**Constraints**: Must not break tests or typecheck
**Complexity**: Medium (7 files, mostly type safety issues)

## Error Summary by File

| File | Errors | Root Cause |
|------|--------|------------|
| `src/components/TagsPanel.tsx` | ~45 | `any` typed repository calls, missing types |
| `src/components/VersionHistoryPanel.tsx` | ~30 | `any` typed repository calls, missing types |
| `src/components/CommandPalette.tsx` | ~8 | `any` typed search results |
| `src/components/Overlay.tsx` | 2 | a11y: click handler on non-interactive element |
| `src/hooks/useScrollLock.ts` | 2 | Immutability rule on ref property |
| `src/features/ai/useChat.ts` | 1 | Missing hook dependencies |
| `src/lib/motion.ts` | 1 | Empty arrow function |

## Strategy: Parallel Execution

All 7 files are independent. Launch 7 parallel agents to fix simultaneously.

## Execution Plan

### Phase 1: Parallel Fix (7 agents)
- Agent 1: Fix `TagsPanel.tsx` - Add proper types to repository calls
- Agent 2: Fix `VersionHistoryPanel.tsx` - Add proper types to repository calls
- Agent 3: Fix `CommandPalette.tsx` - Add proper types to search results
- Agent 4: Fix `Overlay.tsx` - Add keyboard handler for a11y
- Agent 5: Fix `useScrollLock.ts` - Fix immutability issue
- Agent 6: Fix `useChat.ts` - Add missing dependencies
- Agent 7: Fix `motion.ts` - Fix empty arrow function

### Phase 2: Validate
- Run `pnpm run lint`
- Run `pnpm run typecheck`
- Run `pnpm run test`

### Phase 3: Commit & Push
- Commit all fixes
- Push to branch

## Progress

- [x] Phase 1: Parallel fix (7 agents) - All 7 agents completed successfully
- [x] Phase 2: Validate - lint ✓, typecheck ✓, tests ✓ (51 files, 506 tests)
- [ ] Phase 3: Commit & Push
