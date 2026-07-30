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

## 10. Vitest `vi.hoisted()` for Mock Dependencies

**Problem**: When a `vi.mock()` factory references variables defined in module scope, Vitest throws `ReferenceError: Cannot access 'X' before initialization` because `vi.mock` is hoisted above all imports and top-level declarations.

**Pattern**: Use `vi.hoisted()` to define mock components/variables that need to be available when `vi.mock` executes:

```ts
// WRONG — MockCommand is defined after vi.mock is hoisted
const MockCommand = ({ children }) => <div>{children}</div>
MockCommand.Input = (props) => <input {...props} />
vi.mock('cmdk', () => ({ Command: MockCommand }))

// RIGHT — vi.hoisted runs before vi.mock
const { MockCommand } = vi.hoisted(() => {
  const Root = ({ children }) => <div>{children}</div>
  Root.Input = (props) => <input {...props} />
  return { MockCommand: Root }
})
vi.mock('cmdk', () => ({ Command: MockCommand }))
```

**Gotcha**: Don't define mock components with sub-properties (`.Input`, `.List`) outside `vi.hoisted` — the hoisted mock factory runs first, so all dependencies must be in the hoisted scope.

## 11. Disambiguating Text in Unit Tests — `getAllByText` for Overlapping Labels

**Problem**: Labels like "Lab", "Library", "Navigate" appear both as group headings and as item labels (or badges) in the same component. `getByText` throws "strict mode violation: resolved to N elements."

**Pattern**: Use `getAllByText` with a count assertion:

```ts
// BAD — throws when 'Lab' appears as both group heading and experimental badge
expect(screen.getByText('Lab')).toBeDefined()

// GOOD — assert at least the expected number of matches
expect(screen.getAllByText('Lab').length).toBeGreaterThanOrEqual(2)
```

**When to use**: Any time a text label appears in multiple contexts within the same component — group headings + items, badges + labels, or filter text + display text. Prefer `getByRole` with `name` when possible; fall back to `getAllByText` only when semantic selectors are unavailable.

## 12. Overlay Mock Split — Backdrop/Content for Click Isolation

**Problem**: Mocking `Overlay` with `onClick={onClose}` on the container div means ANY child click (tabs, nav items, buttons) bubbles up and fires onClose, making it impossible to test interactive content inside the overlay.

**Pattern**: Split the mock into a backdrop div (fires onClose) and a content div (stops propagation):

```ts
vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose, 'aria-label': ariaLabel }) =>
    open ? (
      <div data-testid="overlay-backdrop" onClick={onClose}>
        <div data-testid="overlay" role="dialog" aria-label={ariaLabel}
             onClick={(e) => { e.stopPropagation() }}>
          {children}
        </div>
      </div>
    ) : null,
}))
```

**Test pattern**: Click the backdrop to test close behavior, click children to test interactive content:
```ts
// Close via backdrop
fireEvent.click(screen.getByTestId('overlay-backdrop'))
expect(mockClose).toHaveBeenCalled()

// Child clicks don't close
fireEvent.click(screen.getByText('Navigate')) // tab inside drawer
expect(mockClose).not.toHaveBeenCalled()
```

## 13. `window.matchMedia` Mock for JSDOM

**Problem**: `window.matchMedia` is not available in JSDOM. Components using `matchMedia` for responsive behavior (e.g., auto-closing a mobile drawer on resize to desktop) throw `TypeError: window.matchMedia is not a function`.

**Pattern**: Define the mock before the component import:

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
```

**Gotcha**: Must be defined before the component module is imported, not just before the test runs. Place it at the top of the file after `vi.mock` calls but before the component import.

## 14. `React.lazy` in Tests — Async Rendering Required

**Problem**: Even when `vi.mock` provides a synchronous implementation for a lazy-loaded component, `React.lazy` still wraps it in a promise. `render()` alone doesn't resolve the lazy promise, so the component doesn't appear in the DOM.

**Pattern**: Wrap lazy-loaded view renders in `await act(async () => { ... })`:

```ts
// WRONG — lazy component may not render
it('renders GraphView', () => {
  currentView = 'graph'
  render(<AppShell />)
  expect(screen.getByTestId('graph-view')).toBeDefined() // FAILS
})

// RIGHT — async act resolves the lazy promise
it('renders GraphView', async () => {
  currentView = 'graph'
  await act(async () => { render(<AppShell />) })
  expect(screen.getByTestId('graph-view')).toBeDefined() // PASSES
})
```

**When to use**: Any component wrapped in `React.lazy()` or `<Suspense>`. Non-lazy synchronous components don't need this.

## 15. JSDOM Style Values Include 'px' Suffix

**Problem**: JSDOM normalizes numeric CSS style values to include the 'px' suffix. `element.style.left` returns `'150px'` not `'150'`.

**Pattern**: Always expect the 'px' suffix when asserting numeric style values:

```ts
// WRONG
expect(overlay?.style.left).toBe('150')
expect(overlay?.style.top).toBe('250')

// RIGHT
expect(overlay?.style.left).toBe('150px')
expect(overlay?.style.top).toBe('250px')
```

**Gotcha**: This only applies to JSDOM's style normalization. Browser environments return the value as set. Also, the `as HTMLElement` cast is needed when accessing `.style` on a `querySelector` result (TypeScript types `querySelector` as returning `Element`, not `HTMLElement`).
