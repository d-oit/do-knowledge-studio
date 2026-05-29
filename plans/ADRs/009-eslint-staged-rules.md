# ADR 009: Staged ESLint Rule Enforcement with Type-Checked Rules

## Status
IMPLEMENTED

## Context
The codebase had 141 pre-existing ESLint errors and 4 warnings with `--max-warnings 0` enforcement. These fell into systematic categories:

- **`@typescript-eslint/no-unsafe-*` (~62 errors)**: Worker message passing, test mocks, third-party API calls (TipTap, sigma.js) all pass `any` values. The underlying types are correct at runtime but the linter can't resolve them.
- **`@typescript-eslint/no-misused-promises` (~18 errors)**: Async `onClick` handlers return `Promise<void>` where `void` is expected.
- **`jsx-a11y/*` (~15 errors)**: Modal overlays missing keyboard handlers, labels unassociated, autoFocus usage.
- **`@typescript-eslint/unbound-method` (~17 errors)**: Test assertions using `expect(repository.method)` without arrow function or `vi.mocked()`.
- **`@typescript-eslint/no-floating-promises` (~8 errors)**: `animatedReset()` and similar async calls without `void` prefix.
- **`react-refresh/only-export-components`**: `DbContext` exported alongside `DbProvider` component.
- **Various smaller categories**: `require-await`, `no-unused-vars`, `exhaustive-deps`.

## Decision

### Phase 1 — Mechanical fixes (applied)
Apply the following patterns systematically across all files:

1. **Async event handlers**: `onClick={() => void handler()}` — void-wrapping prevents unhandled promise rejections while preserving the async behavior.

2. **Floating promises**: Prefix with `void` when the promise is intentionally fire-and-forget (e.g., `sigma.getCamera().animatedReset()`).

3. **Worker message typing**: Define typed interfaces (`WorkerRequest`, `WorkerResponse`, `ExecPayload`, `TransactionPayload`) and cast `event.data` instead of suppressing the rule.

4. **vi.mocked() for test assertions**: Replace `expect(repository.method)` with `expect(vi.mocked(repository.method))` to properly type mock assertions.

5. **Modal accessibility**: Use `e.target === e.currentTarget` for overlay click handling + `role="button" tabIndex={0} onKeyDown` for interactive elements.

### Phase 2 — Suppression with justification (applied)
Use `eslint-disable-next-line` with documented reasons where the rule is overly strict:

- **TipTap chain API**: `.chain().focus().toggleBold().run()` — third-party library types are too complex for full resolution
- **Test `unbound-method`**: Use disable comments where vi.mocked() would require restructuring
- **react-refresh**: Single disable for `DbContext` export (it's shared between files by design)

### Phase 3 — Hook dependencies (applied)
Add all referenced variables to React `useEffect`/`useCallback` dependency arrays. Where adding deps could cause infinite loops (e.g., `editor?.commands`), use targeted suppression.

## Specific Patterns

### Worker message typing
```typescript
interface WorkerRequest {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}
const { type, payload, id } = event.data as WorkerRequest;
```

### Async event handlers
```typescript
// Before:
<button onClick={handleExport}>Export</button>
// After:  
<button onClick={() => void handleExport()}>Export</button>
```

### Test mock typing
```typescript
// Before:
expect(repository.getWebCache).toHaveBeenCalledWith(url);
// After:
expect(vi.mocked(repository.getWebCache)).toHaveBeenCalledWith(url);
```

### Modal overlay a11y
```typescript
<div
  onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
  role="button"
  tabIndex={0}
>
```

## Consequences
- ESLint enforces `--max-warnings 0` with zero false positives
- `SKIP_LINT` env var removed from `quality_gate.sh` (no longer needed)
- All code paths have proper type safety except where explicitly suppressed with documented reasons
- Accessibility baseline established — all interactive elements have keyboard handlers and proper ARIA attributes

## Verification
- `pnpm run lint` exits with code 0
- `pnpm run typecheck` passes
- `pnpm run build` succeeds
