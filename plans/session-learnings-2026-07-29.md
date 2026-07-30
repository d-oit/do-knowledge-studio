# Session Learnings — 2026-07-29

> Extracted from a 13-PR session covering a11y E2E suite, plan reconciliation, error boundary testing, and release policy hardening.

## 1. Error Boundary Testing Pattern (ConditionalThrow)

**Problem**: Testing error boundary reset behavior in React Testing Library is tricky. After clicking "Try again", the boundary's `setState` triggers an immediate re-render with the original throwing children — `rerender` with safe children comes too late.

**Pattern**: Use a `ConditionalThrow` component that accepts a `shouldThrow` prop. Update children via `rerender` with `shouldThrow={false}` BEFORE triggering the reset click:

```tsx
function ConditionalThrow({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('Test error')
  return <p>Recovered content</p>
}

// In test:
const { rerender } = render(
  <ErrorBoundary>
    <ConditionalThrow shouldThrow={true} />
  </ErrorBoundary>,
)

rerender(
  <ErrorBoundary>
    <ConditionalThrow shouldThrow={false} />
  </ErrorBoundary>,
)
fireEvent.click(screen.getByText('Try again'))
expect(screen.getByText('Recovered content')).toBeDefined()
```

**Gotcha**: Don't use a simple `ThrowError` component for reset tests — the boundary re-renders the throwing children before `rerender` can update them.

## 2. Error Boundary Architecture — Per-View + Global

**Pattern**: Wrap each view in a `ViewErrorBoundary` (per-view named fallback, `AppError.userMessage`, "Reload view" button) inside a global `ErrorBoundary` safety net. In `app-shell.tsx`:

```tsx
<ErrorBoundary key={currentView}>
  <ViewErrorBoundary viewName={currentView}>
    {renderView(currentView)}
  </ViewErrorBoundary>
</ErrorBoundary>
```

**Key**: `ViewErrorBoundary` calls `onError` callback for logging/telemetry. `AppError.userMessage` provides user-facing messages separate from internal error details.

## 3. .gitignore Cleanup Approach

**Pattern**: When cleaning up `.gitignore`:
- Remove duplicate entries silently (don't leave placeholder comments — they're noise)
- Keep wildcard entries (`*.log`) and remove specific entries they cover (`dev.log`, `server.log`)
- Add `*.tsbuildinfo` under Build artifacts, not OS files
- Verify no patterns were accidentally removed by checking `git diff` carefully

**Gotcha**: Removing a `*.log` line from one section while another section has it is fine — gitignore patterns are global. But don't remove the only `*.log` line thinking the other section still has it.

## 4. Plan Reconciliation Methodology

**Pattern**: For plans marked DONE/COMPLETE with unchecked items:
1. Code-search for evidence the work was done (component names, function names, test files)
2. Check off items with specific notes referencing the evidence
3. Add `Status: DONE` lines to plans missing them (place at top after title)
4. Add `Historical Note` blockquotes to superseded plans referencing retired architecture

**Key**: Always verify with code search — never assume unchecked means undone. Some items are implementation-plan checkboxes (development workflow), not final success criteria.

## 5. Release Policy — Hard Rule

**Learning**: The previous AGENTS.md release rule ("coordinated manually") was ambiguous. Agents interpreted it as "the agent does it manually." The new rule is explicit: **"Never create a GitHub release without explicit human instruction."** This must be unambiguous in both AGENTS.md and VERSION.md.

## 6. Version File — Single Source of Truth

**Learning**: The `VERSION` file was documented as "single source of truth" in `agents-docs/VERSION.md` but didn't actually exist. Package.json had `0.2.0`, git tags went up to `v0.2.5`, and the user stated the version was `0.1.0`. Reconciliation required creating the VERSION file AND updating package.json AND the MIGRATION.md badge.

## 7. Git Workflow — Branch Discipline

**Problem**: Multiple times, commits landed on `main` instead of the feature branch (quality gate script switched branches). Branch protection caught the push, but the fix (cherry-pick + reset) was manual.

**Prevention**: Always verify `git branch --show-current` before committing. The `--no-verify` flag on commit bypasses the pre-commit hook but doesn't prevent branch mistakes.

## 8. Playwright Selector Strategy — Prefer Semantic over CSS

**Problem**: E2E tests broke in CI because `getByText('Ready')` matched 3 elements ("Offline ready", the status "Ready", and "AI agent ready to assist"). Similarly, `getByText('Lab')` matched sidebar badges and view badges. CSS class selectors (`.rounded-full`) worked but were brittle.

**Selector hierarchy (preferred order)**:
1. `getByRole('heading', { name: '...' })` — semantic, most resilient
2. `getByText('...', { exact: true })` — fast, avoids substring matches
3. `getByLabelText('...')` / `getByPlaceholderText('...')` — for form elements
4. `locator('...').filter({ hasText: ... })` — when scoping to a parent
5. CSS class selectors — last resort, breaks on Tailwind changes

**Pattern for disambiguating common text**: Scope to a parent element using the heading's parent:
```ts
// BAD — matches 3 elements
text
await expect(page.getByText('Lab')).toBeVisible();

// GOOD — exact match for standalone text
await expect(page.getByText('Lab', { exact: true })).toBeVisible();

// BEST — scope to the heading's parent container
await expect(
  page.getByRole('heading', { name: 'AI Harness' }).locator('..').getByText('Lab'),
).toBeVisible();
```

**Gotcha**: The sidebar repeats the same badges ("Lab", "Experimental") for multiple nav items. Always scope E2E selectors to the main content area, not the full page.

## 9. Unit Test Isolation — always use `beforeEach` with shared `vi.fn()`

**Problem**: Tests in `ai-harness-chat.test.tsx` shared `vi.fn()` instances in `defaultProps` without `beforeEach(() => vi.clearAllMocks())`. Mock call counts accumulated across tests, causing false positives/negatives.

**Rule**: Any test file that uses `vi.fn()` in shared `defaultProps` must have:
```ts
beforeEach(() => { vi.clearAllMocks() })
```

**Exception**: If every test creates its own local `vi.fn()`, `beforeEach` is optional (e.g., `import-dropzone.test.tsx` uses local mocks per test).
