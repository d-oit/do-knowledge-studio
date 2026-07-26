# Plan 079 — View Test Coverage + PR for Plan 078

**Date**: 2026-07-25
**Status**: DONE (verified 2026-07-25)
**Method**: GOAP with parallel execution
**Branch**: `feat/079-view-tests`
**PR**: [#514](https://github.com/d-oit/do-knowledge-studio/pull/514) — all 22 CI checks pass

## Context

Plan 078 goals are all verified complete. The only remaining gap is 5 view components
without test files. This plan adds those tests and creates a PR combining all Plan 078
verification evidence with new test coverage.

## Baseline (verified 2026-07-25)

| Metric | Value |
|--------|-------|
| Tests | 665 passed (49 files) |
| Coverage | Lines 41.47%, Branches 31.38%, Functions 32.49%, Statements 41.74% |
| Lint | 0 warnings |
| Typecheck | 0 errors |
| Build | Success |
| export-view.tsx | 128 LOC (under 500) |
| ARCHITECTURE.md | 174 lines, accurate |
| E2E CI | Job exists in ci-and-labels.yml |

## Goals

| ID | Goal | Priority | Status |
|----|------|----------|--------|
| G1 | Add test files for 5 missing view components | P1 | OPEN |
| G2 | Create PR with all Plan 078 + Plan 079 changes | P1 | OPEN |
| G3 | All CI checks pass | P1 | OPEN |

## Wave Structure

### Wave 1 — View Test Files (parallel, 3 agents)

Write test files for the 5 missing view components:

| Component | File to Create | Focus |
|-----------|---------------|-------|
| `ai-harness-view.tsx` | `ai-harness-view.test.tsx` | Provider config UI, model selection, chat interface |
| `chat-view.tsx` | `chat-view.test.tsx` | Message list, input, send, streaming |
| `library-view.tsx` | `library-view.test.tsx` | Entity list, filtering, search, selection |
| `sync-view.tsx` | `sync-view.test.tsx` | QR pairing, presence display, conflict UI |
| `triz-view.tsx` | `triz-view.test.tsx` | Matrix display, contradiction input, principle suggestions |

Each test file ~100-200 LOC. Use `@testing-library/react` with mocked Zustand store.

### Wave 2 — Quality Gate + PR (sequential)

1. Run lint, typecheck, test, build
2. Run `pnpm test:coverage` and update vitest.config.ts thresholds if needed
3. Create branch, commit, push, create PR
4. Monitor CI — all checks must pass
5. Address any PR review comments

## Key Files

| File | Action |
|------|--------|
| `src/components/studio/views/ai-harness-view.test.tsx` | New |
| `src/components/studio/views/chat-view.test.tsx` | New |
| `src/components/studio/views/library-view.test.tsx` | New |
| `src/components/studio/views/sync-view.test.tsx` | New |
| `src/components/studio/views/triz-view.test.tsx` | New |
| `vitest.config.ts` | Possibly update thresholds |

## Verification

- `pnpm run lint` — 0 warnings
- `pnpm run typecheck` — 0 errors
- `pnpm run test` — all tests pass (existing + new)
- `pnpm run test:coverage` — thresholds pass
- `pnpm run build` — success
- `./scripts/quality_gate.sh` — passes
- All CI checks pass on PR
