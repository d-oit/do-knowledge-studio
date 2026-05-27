# ADR 008: Circular Dependency Resolution in Rolldown Production Builds

## Status
IMPLEMENTED

## Context
The production build (`pnpm run build`) crashed with `Cannot access 'X' before initialization` (Temporal Dead Zone errors) in the bundled JavaScript. This only occurred in production builds — the dev server worked fine.

Investigation revealed two root causes:

1. **Circular dependency in `src/lib/perf/`**: `index.ts` used `export { Profiled, PerfPanel } from './components.js'` — a re-export that forces Rolldown to evaluate `components.tsx` before `index.ts` finishes initializing. Meanwhile `components.tsx` imports `{ perf }` from `index.ts`, creating a runtime circular dependency. In production, Rolldown's optimization exposed this TDZ.

2. **Forward reference to `const refreshData`**: `App.tsx` declared `handleEditComplete` (which closes over `refreshData`) before `refreshData` itself was declared. Standard JavaScript closures defer access until call time, but Rolldown's production bundling can trigger TDZ during module initialization when closures cross function boundaries in certain patterns.

3. **Schema index ordering**: `schema.sql` had `CREATE INDEX idx_web_cache_resolved_at ON web_cache(resolved_at)` on line 68, before the `web_cache` table was created on line 90. SQLite processes statements sequentially, so when the index creation runs, the table doesn't exist yet. This worked on pre-existing databases but failed on fresh instances.

## Decision

### 1. Break ALL circular import patterns
- Extract shared code into a common module (`core.ts`) that both sides import from
- Never use `export { X } from './module'` syntax when the target module imports from the source
- Replace with `import { X } from './module'; export { X };` pattern instead

### 2. Declare all `const`/`let` before their first reference in closures
- Reorder hook declarations so that state/callback declarations appear before any closures that reference them
- `const refreshData = useCallback(...)` must appear before `const handleEditComplete = useCallback(() => { refreshData(); }, [refreshData])`
- This is a JavaScript best practice that avoids TDZ exposure in bundler transformations

### 3. Ensure schema DDL ordering respects table dependencies
- Indexes must appear AFTER their corresponding `CREATE TABLE` statements
- All references to a table in DDL (indexes, triggers, foreign keys) must follow the table definition

## Consequences
- Circular dependency eliminated — production build works correctly
- Schema handles fresh database instances correctly
- No performance impact
- Prefer explicit `import; export` over `export from` in any file that participates in import cycles

## Verification
- `pnpm run build` produces valid JavaScript
- `PLAYWRIGHT_MODE=production npx playwright test tests/e2e/smoke.spec.ts --project=chromium` passes
- Fresh database initialization succeeds
