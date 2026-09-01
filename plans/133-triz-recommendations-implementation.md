# Plan 133: TRIZ Recommendations Implementation (Phase 1)

**Goal**: Implement the high-impact Phase 1 architectural improvements identified in the TRIZ Contradiction Audit (`analysis/triz-system-architecture-2026-09-01.md`).

## Objectives

1. **Modularize Near-Limit Views (< 500 LOC Enforcement)**:
   - Refactor `graph-view.tsx` (499 LOC -> < 350 LOC) by extracting `graph-toolbar.tsx` and `graph-view-helpers.ts`.
   - Refactor `chat-view.tsx` (491 LOC -> < 350 LOC) by extracting `chat-input-bar.tsx`.
   - Maintain 100% test compatibility and zero UI regressions.

2. **Off-Thread Web Worker Search Engine**:
   - Implement `src/lib/search/search-worker.ts` for offloading BM25 indexing and query execution.
   - Implement `src/lib/search/search-worker-client.ts` with transparent fallback for non-DOM/SSR/Vitest environments.
   - Add unit and integration tests.

3. **Inverted Context & Dynamic Claim Pruning for AI Harness**:
   - Extend `src/lib/ai/context.ts` with configurable token budget pruning, claim summaries, and tool definition schemas (`src/lib/ai/tools.ts`).
   - Add comprehensive test coverage.

4. **Tiered Storage & Quota Safety Resilience**:
   - Add IndexedDB snapshot backup module (`src/lib/studio/indexeddb-backup.ts`) to provide safety against `localStorage` 5MB quota errors.
   - Add unit tests for storage backup and recovery.

## Quality Checklist
- [ ] Max 500 LOC per file respected across all new/modified files.
- [ ] Named exports only.
- [ ] No `any` types; strict TypeScript.
- [ ] All tests pass (`pnpm run test`).
- [ ] Typecheck passes (`pnpm run typecheck`).
- [ ] Lint passes (`pnpm run lint`).
- [ ] Build passes (`pnpm run build`).
- [ ] Minimal quality gate passes (`./scripts/minimal_quality_gate.sh`).
