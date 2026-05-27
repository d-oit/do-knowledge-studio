# Pre-existing ESLint Error Cleanup — 2026-05-27

> **Goal**: Fix 141 pre-existing ESLint errors (4 warnings) so `SKIP_LINT` is no longer needed
> **Pattern**: Many errors are systematic and can be fixed with targeted refactors

## Error Breakdown

| Rule | Count | Category |
|------|-------|----------|
| `@typescript-eslint/no-unsafe-assignment` | ~40 | Type safety |
| `@typescript-eslint/no-unsafe-member-access` | ~20 | Type safety |
| `@typescript-eslint/no-unsafe-call` | ~15 | Type safety |
| `@typescript-eslint/no-unsafe-argument` | ~10 | Type safety |
| `@typescript-eslint/no-misused-promises` | ~15 | Async hygiene |
| `@typescript-eslint/unbound-method` | ~12 | Test patterns |
| `@typescript-eslint/no-floating-promises` | ~8 | Async hygiene |
| `@typescript-eslint/require-await` | ~5 | Code cleanup |
| `@typescript-eslint/no-unnecessary-type-assertion` | ~2 | Cleanup |
| `@typescript-eslint/no-unused-vars` | ~2 | Cleanup |
| `jsx-a11y/*` | ~10 | Accessibility |
| `react-hooks/exhaustive-deps` | ~4 | React hooks |
| `react/no-unescaped-entities` | ~1 | JSX |
| `react-refresh/only-export-components` | ~1 | HMR |

## Files with Most Errors

| File | Errors | Primary Issue |
|------|--------|---------------|
| `src/db/__tests__/repository.test.ts` | 18 | `no-unsafe-*` (mock patterns) |
| `src/db/db-worker.ts` | 14 | `no-unsafe-*` (generic messages) |
| `src/features/editor/Editor.tsx` | 12 | `no-unsafe-*`, `no-misused-promises` |
| `src/features/search/SearchPanel.tsx` | 18 | `no-unsafe-*`, `no-misused-promises` |
| `src/features/graph/GraphControls.tsx` | 15 | `jsx-a11y`, `no-misused-promises` |
| `src/features/graph/GraphView.tsx` | 8 | `no-unsafe-*`, floating promises |
| `src/features/ai/AIHarness.tsx` | 8 | mix |
| `src/db/connection-pool.ts` | 5 | `no-unsafe-*` (message passing) |
| `src/lib/jobs.ts` | 4 | `no-misused-promises`, `unbound-method` |

## Fix Strategies

### 1. Test file mocks (repository.test.ts, concurrency.test.ts, etc.)
**Strategy**: Cast mocks properly or use `vi.mocked()` from Vitest
```ts
// Before
const mockRepo = vi.fn();
// After
const mockRepo = vi.fn() as unknown as Repository;
```

### 2. Worker message passing (db-worker.ts, connection-pool.ts)
**Strategy**: Type the message payloads with discriminated unions
```ts
// Before
const msg = event.data;
// After
interface WorkerMessage { type: string; payload: unknown; }
const msg = event.data as WorkerMessage;
```

### 3. Event handler promises (GraphControls.tsx, ExportPanel.tsx, etc.)
**Strategy**: Wrap handler in `void` or use `onClick={() => { handler().catch(...) }}` pattern
```ts
// Before
onClick={handleSubmit}
// After
onClick={() => { void handleSubmit(); }}
```

### 4. `unbound-method` in tests
**Strategy**: Use arrow functions or `.bind(this)` in test fixtures
```ts
// Before
const callback = obj.method;
// After
const callback = () => obj.method();
```

### 5. `no-floating-promises`
**Strategy**: Add explicit `void` or `.catch()` handlers to unawaited promises

## Priority Order

1. **Worker message typing** (db-worker, connection-pool) — lowest risk, highest impact
2. **Event handler promises** — mechanical fix, low risk
3. **Test mocks** — mechanical but needs careful review
4. **Accessibility (jsx-a11y)** — needs semantic review per element
5. **Remaining** — individual fixes

## Effort Estimate

- Pure mechanical fixes (worker types, event handlers, `void`): ~30 min
- Test mock fixes: ~20 min
- Accessibility fixes: ~30 min
- Total: ~1.5 hours

## Verification

```bash
pnpm run lint  # Should show 0 errors
pnpm run typecheck
pnpm run test
pnpm run build
```
