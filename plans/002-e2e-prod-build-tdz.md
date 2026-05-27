# E2E Production Build Fix — 2026-05-27

> **Status**: ✅ RESOLVED
> **Goal**: Fix E2E tests failing in CI due to production build TDZ error
> **Root Cause**: Circular dependency in `src/lib/perf/` + forward `const` reference in `App.tsx` + schema index ordering

## Root Causes

### Cause 1: Circular dependency in `src/lib/perf/`
`src/lib/perf/index.ts` used `export { Profiled, PerfPanel } from './components.js'` — a re-export that forces Rolldown to evaluate `components.tsx` before `index.ts` finishes. `components.tsx` imports `{ perf }` from `./index.js`, creating a circular dependency. In production, Rolldown optimization exposed the TDZ.

### Cause 2: Forward `const` reference in `App.tsx`
`handleEditComplete` (line 80) closed over `refreshData` (line 94) — `const refreshData` was declared AFTER `handleEditComplete`. Standard JS closures defer access until call time, but Rolldown's bundling can trigger TDZ during initialization.

### Cause 3: Schema index ordering
`schema.sql` had `CREATE INDEX idx_web_cache_resolved_at ON web_cache(resolved_at)` at line 68, before the `web_cache` table `CREATE TABLE` at line 90. SQLite processes DDL sequentially, so the index creation failed on fresh databases.

## Fix Applied

1. **Extracted `src/lib/perf/core.ts`** — moved `perf` object and types out of `index.ts` into `core.ts`. Both `index.ts` and `components.tsx` import from `core.ts` instead of each other.

2. **Reordered hook declarations in `App.tsx`** — moved `const refreshData = useCallback(...)` before `const handleEditComplete = useCallback(...)`.

3. **Fixed schema index order** — moved `idx_web_cache_resolved_at` to after `web_cache` table creation.

4. **ADR-008** documents the circular dependency policy.

## Verification

```bash
pnpm run build                  # ✅ Builds in 900ms
pnpm run typecheck               # ✅ Passes
pnpm run lint                    # ✅ 0 errors
PLAYWRIGHT_MODE=production npx playwright test tests/e2e/smoke.spec.ts --project=chromium --reporter=list  # ✅ 1 passed (854ms)
```
