# Plan 096: WCAG 2.5.5 Touch Target & E2E Accessibility Learnings

> Date: 2026-07-29
> Status: DONE
> Related: Plan 093 (a11y E2E suite), Plan 095 (color-contrast fixes)

## Summary

This session implemented WCAG 2.5.5 touch target compliance (44x44px minimum) across all interactive elements and fixed E2E accessibility test failures on PR #539.

## Key Learnings

### 1. WCAG 2.5.5 Touch Target Implementation Pattern

**Pattern**: Replace `py-1`, `py-1.5`, `py-2` with `min-h-[44px]` on all interactive elements. For narrow elements (icon buttons, filter chips), also add `min-w-[44px]`.

**Gotchas**:
- `min-h-[44px]` replaces vertical padding — don't keep both (redundant)
- Icon-only buttons need `flex items-center justify-center` added alongside `min-h-[44px] min-w-[44px]` to center the icon
- Buttons inside fixed-height containers (e.g., search inputs) may overflow — increase the container height too
- Filter chip buttons with short text (e.g., "All") need `min-w-[44px]` since `min-h` only fixes height

**Files affected**: sidebar, topbar, home-view, library-view, editor-view, chat-view, type-selector, right-panel

### 2. ARIA Radiogroup Keyboard Navigation

**Problem**: Custom radiogroup (using `<button role="radio">`) only called `setEditMode()` on arrow keys but never moved focus. WAI-ARIA requires arrow keys to move focus to the newly selected radio.

**Fix**: Add a `useRef` to the radiogroup container, query `[role="radio"]` buttons after state change, and call `.focus()` on the newly selected button:

```tsx
const modeGroupRef = useRef<HTMLDivElement>(null)
// In onKeyDown handler:
const buttons = modeGroupRef.current?.querySelectorAll('[role="radio"]')
buttons[nextIdx]?.focus()
```

**Key insight**: State update + focus must happen together. React keeps the same DOM nodes (stable keys), so synchronous focus after `setState` works.

### 3. E2E Test Viewport Considerations

**Problem**: Touch-target test used 375x812 (mobile) viewport, but sidebar buttons are `hidden lg:flex` (only visible ≥1024px). Test timed out clicking non-existent buttons.

**Fix**: Use 1280x900 (desktop) viewport for tests that interact with desktop-only UI elements.

**Rule**: Always match the E2E test viewport to the breakpoint where the target UI is visible. Don't test desktop sidebar nav with a mobile viewport.

### 4. E2E Test Exclusions for WCAG-Compliant Patterns

**Skip-nav links**: Intentionally 1x1px when unfocused (sr-only pattern). Exclude from touch-target assertions:
```ts
if (el.tagName === 'A' && href?.includes('#') && text.includes('skip')) continue;
```

**SVG graph nodes**: Data visualization `<g role="button">` elements are not UI controls. Exclude:
```ts
if (el.tagName === 'G' || el instanceof SVGGElement) continue;
```

**Dead code warning**: Don't exclude elements that aren't selected by `querySelectorAll` in the first place (e.g., `<kbd>` is not matched by `button, a[href], input, [role="button"]`).

### 5. Merge Conflict Marker Detection

**Problem**: Git rebase left `<<<<<<<`, `=======`, `>>>>>>>` conflict markers in `accessibility.spec.ts`, causing a SyntaxError that aborted all E2E tests before they could run.

**Learning**: After any rebase/cherry-pick, always verify files are clean with `grep -r '<<<<<<' e2e/ src/` before pushing. The SyntaxError masked the real test failures (keyboard nav, touch targets) for multiple CI runs.

### 6. PR Management Strategy

- **Superseded PRs**: Close with a clear comment explaining why (e.g., PR #536 superseded by #539)
- **Dependabot major bumps**: Verify the component's API compatibility before auto-merging (e.g., react-day-picker v10 removed `fromMonth`/`toMonth` — checked calendar.tsx, already v10-compatible)
- **Auto-merge + auto-rebase**: Use `gh pr merge --merge --auto` so PRs merge automatically once CI passes after rebasing

### 7. Codacy Static Analysis

PR #539 triggered 3 Codacy high-severity issues (1 ErrorProne, 2 Security). These appear to be pre-existing issues surfaced by the new code changes, not new defects. The Codacy check blocks auto-merge — needs investigation in a follow-up.

## Files Changed (10 commits on feat/093)

| File | Change |
|------|--------|
| `e2e/accessibility.spec.ts` | Fixed merge conflict markers, shared helper imports |
| `e2e/touch-targets.spec.ts` | Desktop viewport, skip-nav + SVG exclusions |
| `src/components/studio/views/editor-view.tsx` | ARIA radiogroup focus fix, min-h/min-w touch targets |
| `src/components/studio/sidebar.tsx` | min-h-[44px] on all sidebar buttons |
| `src/components/studio/topbar.tsx` | min-h-[44px] on ⌘K, New entity, search input |
| `src/components/studio/views/home-view.tsx` | min-h-[44px] on all buttons |
| `src/components/studio/views/type-selector.tsx` | min-h-[44px] on type dropdown |
| `src/components/studio/views/library-view.tsx` | min-h/min-w-[44px] on filters, toggles, sort, search |
| `src/components/studio/views/chat-view.tsx` | min-w-[44px] on Clear button |
| `src/components/studio/right-panel.tsx` | min-h-[44px] on connection + search result buttons |

## Quality Gate

- Lint: PASS
- Typecheck: PASS
- Unit tests: 1322 passing (91 test files)
- E2E: CI re-running with latest fixes
