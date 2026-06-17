# GOAP Plan: Fix Flaky E2E Tests — 2026-06-17

**Generated**: 2026-06-17
**Source**: PR #327 — E2E test failures in `modern-shell.spec.ts` and `features.spec.ts`
**Method**: Goal-Oriented Action Planning with swarm execution
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm + `web-search-researcher`

---

## 1. Task Analysis

**Primary Goal**: Fix all flaky E2E tests so CI passes with zero failures on PR #327.

**Constraints** (from AGENTS.md):
- Local-first only — no required backend
- Strict TypeScript — no `any`
- Max 500 LOC per source file
- All planning artifacts go in `plans/`, not repo root
- `pnpm` only

**Complexity**: **Medium** (4 files, 6 root causes, parallel investigation + sequential fixes)

**Repository state observed**:
- E2E tests failing on `modern-shell.spec.ts` (command palette) and `features.spec.ts` (entity CRUD, mobile)
- `tests/e2e/utils.ts` uses `waitForTimeout(500)` — #1 cause of flaky tests industry-wide
- `modern-shell.spec.ts:29` uses `evaluate(el => el.click())` — bypasses Playwright actionability checks
- `CommandPalette.tsx:55` has `setTimeout(10ms)` focus leak without cleanup
- `playwright.config.ts` missing `actionTimeout`, `expect.timeout`, `viewport`

---

## 2. Goal Hierarchy

```
G-FIX-E2E (P0)
    │
    ├─→ G-RESEARCH (Playwright best practices, flaky test patterns)
    │
    ├─→ G-ANALYZE (read failing tests, identify root causes)
    │
    └─→ G-IMPLEMENT (fix utils.ts, modern-shell.spec.ts, CommandPalette.tsx, playwright.config.ts)
```

---

## 3. Root Cause Analysis (Swarm Output)

### 3.1 `tests/e2e/utils.ts` — `waitForTimeout(500)` (CRITICAL)

**Both `ensureNavVisible` and `closeNav` use `waitForTimeout(500)`** — the #1 cause of flaky E2E tests industry-wide. The 500ms is arbitrary: too short on slow CI, wastes time on fast machines.

**Impact**: Affects 6+ test files (`features.spec.ts`, `smoke.spec.ts`, `library.spec.ts`, `skeletons.spec.ts`)

**Fix**: Replace with Playwright auto-waiting assertions:
- `ensureNavVisible`: After clicking "Open menu", assert `getByLabel('Close menu')` is visible
- `closeNav`: After clicking "Close menu", assert `getByLabel('Close menu')` is not visible

### 3.2 `modern-shell.spec.ts:29` — Programmatic overlay click

```ts
await page.locator('.command-palette-overlay').evaluate(el => (el as HTMLElement).click())
```

**Why it fails**: `evaluate()` dispatches an untrusted click that bypasses Playwright's actionability checks. The overlay's `handleOverlayClick` checks `e.target === e.currentTarget`, which may fail with synthetic events.

**Fix**: Use Playwright native `.click()` with position coordinates.

### 3.3 `modern-shell.spec.ts` — No body focus before keyboard shortcuts

```ts
await page.keyboard.press('Control+k');
```

**Why it fails**: In headless CI, focus may not be on the page body. Keyboard events may not reach the global `keydown` handler in `App.tsx`.

**Fix**: Click `page.locator('body')` before sending keyboard shortcuts.

### 3.4 `modern-shell.spec.ts` — No palette-hidden check in `beforeEach`

**Why it fails**: If a previous test leaves the palette in a stale state (e.g., crash/timeout), the `not.toBeVisible()` assertion at line 11 may fail immediately.

**Fix**: Add explicit `await expect(palette).not.toBeVisible()` in `beforeEach` after layout is visible.

### 3.5 `CommandPalette.tsx:55` — `setTimeout` focus leak

```tsx
useEffect(() => {
  if (isOpen) {
    setTimeout(() => inputRef.current?.focus(), 10);
  }
}, [isOpen]);
```

**Why it's a problem**: The `setTimeout` is not cleaned up. If `isOpen` is toggled rapidly (e.g., quick Ctrl+K, Ctrl+K), a stale timeout from the first open could fire after the component unmounts and re-mounts, potentially focusing the wrong element.

**Fix**: Return a cleanup function: `return () => clearTimeout(timer)`.

### 3.6 `playwright.config.ts` — Missing timeouts

**Missing settings**:
- No `actionTimeout` — slow CI clicks may time out at default 30s
- No `expect.timeout` — default 5s may be too tight for CI
- No explicit `viewport` — headed vs headless drift
- `retries: 2` — masks flakes instead of fixing them

**Fix**: Add `timeout: 60s`, `expect.timeout: 10s`, `actionTimeout: 10s`, explicit `viewport`, `webServer.timeout: 30s`, reduce `retries` to 1.

---

## 4. Execution Plan

**Strategy**: Sequential fixes with quality gates

### Phase 1: Fix utils.ts (highest impact — affects 6+ files)
- [x] Replace `waitForTimeout(500)` with auto-waiting assertions
- [x] Quality gate: `pnpm run lint && pnpm run typecheck`

### Phase 2: Fix modern-shell.spec.ts
- [x] Replace `evaluate(el => el.click())` with native `.click()`
- [x] Add `body.click()` before keyboard shortcuts
- [x] Add palette-hidden check in `beforeEach`
- [x] Quality gate: `pnpm run lint && pnpm run typecheck`

### Phase 3: Fix CommandPalette.tsx
- [x] Add `clearTimeout` cleanup to focus `useEffect`
- [x] Quality gate: `pnpm run lint && pnpm run typecheck`

### Phase 4: Fix playwright.config.ts
- [x] Add `timeout`, `expect.timeout`, `actionTimeout`, `viewport`, `webServer.timeout`
- [x] Reduce `retries` from 2 to 1
- [x] Quality gate: `pnpm run lint && pnpm run typecheck`

### Phase 5: Validate
- [x] Run `pnpm run build` — passed
- [x] Run `PLAYWRIGHT_MODE=production pnpm exec playwright test --project=chromium` — **30/30 passed**
- [x] Run `pnpm run lint` — passed
- [x] Run `pnpm run typecheck` — passed

---

## 5. Files Modified

| File | Change | Lines Changed |
|------|--------|---------------|
| `tests/e2e/utils.ts` | Replace `waitForTimeout(500)` with auto-waiting assertions | 30 → 31 |
| `tests/e2e/modern-shell.spec.ts` | Fix overlay click, add body focus, add palette check | 63 → 73 |
| `src/components/CommandPalette.tsx` | Add `clearTimeout` cleanup to focus `useEffect` | 245 → 246 |
| `playwright.config.ts` | Add timeouts, viewport, reduce retries | 60 → 72 |

---

## 6. Remaining Pre-existing Issues

These issues were identified during investigation but are NOT caused by this PR:

### Codacy: False positive on `new RegExp(...)`
- **File**: `src/lib/nlp.ts:18`
- **Rule**: `dos_rule-non-literal-regexp` (Opengrep)
- **Status**: False positive — the regex is constructed from a fixed set of stop words, not user input
- **Action**: Needs suppression via Codacy UI or code restructuring

### DeepSource JavaScript: 7 pre-existing issues
- **File**: `src/components/CommandPalette.tsx`
- **Issues**: Cyclomatic complexity (10), hoisting (`executeSelected` used before defined), JSX nesting depth (5), `void` vs `undefined`
- **File**: `tests/e2e/utils.ts`
- **Issues**: Function declaration in global scope (exported functions)
- **Status**: Pre-existing code quality issues, not regressions
- **Action**: Separate cleanup PR needed

---

## 7. GOAP Lessons Learned

1. **`waitForTimeout` is the #1 enemy of E2E reliability** — always use Playwright auto-waiting assertions
2. **`evaluate(el => el.click())` bypasses actionability** — use native `.click()` or `page.mouse.click()`
3. **Keyboard shortcuts need explicit focus** — click `body` first in headless CI
4. **`beforeEach` must reset state** — don't assume clean state between tests
5. **`useEffect` timeouts need cleanup** — stale timeouts cause focus races
6. **CI needs explicit timeouts** — don't rely on defaults
7. **`retries: 2` masks flakes** — reduce to 1 and fix root causes

---

## 8. Verification Commands

```bash
# Run E2E tests (chromium only, production mode)
pnpm run build && PLAYWRIGHT_MODE=production pnpm exec playwright test --project=chromium

# Run all quality gates
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build

# Run E2E tests (all browsers, CI mode)
pnpm run test:e2e:ci
```
